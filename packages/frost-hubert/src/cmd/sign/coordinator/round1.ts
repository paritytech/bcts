/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Sign coordinator round 1 command.
 *
 * Port of cmd/sign/coordinator/round1.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  type ARID,
  type XID,
  ARID as ARIDClass,
  XID as XIDClass,
  JSON as JSONClass,
  type PrivateKeys,
} from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { SealedRequest, SealedResponse } from "@bcts/gstp";
import { type XIDDocument } from "@bcts/xid";

import { Registry, resolveRegistryPath, type OwnerRecord } from "../../../registry/index.js";
import {
  parallelFetch,
  parallelSend,
  type CollectionResult,
  type ParallelFetchConfig,
} from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";
import { isVerbose } from "../../common.js";

/**
 * Options for the sign round1 command.
 */
export interface SignRound1Options {
  registryPath?: string;
  groupId?: string;
  sessionId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  verbose?: boolean;
  previewShare?: boolean;
}

/**
 * Result of the sign round1 command.
 */
export interface SignRound1Result {
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
}

/**
 * Data extracted from a successful sign round1 response.
 *
 * Port of `struct SignRound1ResponseData` from cmd/sign/coordinator/round1.rs.
 */
export interface SignRound1ResponseData {
  /** The signing commitments from this participant */
  commitments: unknown; // frost::round1::SigningCommitments equivalent
  /** The ARID where the participant expects the next request */
  nextRequestArid: ARID;
}

/**
 * State for a participant in the signing session.
 *
 * Port of `struct StartParticipant` from cmd/sign/coordinator/round1.rs.
 */
export interface StartParticipant {
  commitArid: ARID;
  shareArid: ARID;
}

/**
 * Start state for a signing session.
 *
 * Port of `struct StartState` from cmd/sign/coordinator/round1.rs.
 */
export interface StartState {
  groupId: ARID;
  targetUr: string;
  participants: Map<string, StartParticipant>; // Map by XID UR string
}

/**
 * Load the start state for a signing session.
 *
 * Port of `load_start_state()` from cmd/sign/coordinator/round1.rs.
 */
function loadStartState(registryPath: string, sessionId: ARID, groupHint?: ARID): StartState {
  const base = path.dirname(registryPath);
  const groupStateDir = path.join(base, "group-state");

  const candidatePaths: [ARID, string][] = [];
  let groupDirs: [ARID, string][];

  if (groupHint !== undefined) {
    groupDirs = [[groupHint, path.join(groupStateDir, groupHint.hex())]];
  } else {
    groupDirs = [];
    if (fs.existsSync(groupStateDir)) {
      for (const entry of fs.readdirSync(groupStateDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          if (dirName.length === 64 && /^[0-9a-fA-F]+$/.test(dirName)) {
            const groupId = ARIDClass.fromHex(dirName);
            groupDirs.push([groupId, path.join(groupStateDir, dirName)]);
          }
        }
      }
    }
  }

  for (const [groupId, groupDir] of groupDirs) {
    const candidate = path.join(groupDir, "signing", sessionId.hex(), "start.json");
    if (fs.existsSync(candidate)) {
      candidatePaths.push([groupId, candidate]);
    }
  }

  if (candidatePaths.length === 0) {
    throw new Error("No sign start state found; run `frost sign coordinator start` first");
  }
  if (candidatePaths.length > 1) {
    throw new Error("Multiple signing sessions found; specify --group to disambiguate");
  }

  const [groupId, statePath] = candidatePaths[0];
  const raw = JSON.parse(fs.readFileSync(statePath, "utf-8")) as Record<string, unknown>;

  const getStr = (key: string): string => {
    const value = raw[key];
    if (typeof value !== "string") {
      throw new Error(`Missing or invalid ${key} in start.json`);
    }
    return value;
  };

  const sessionInState = parseAridUr(getStr("session_id"));
  const groupInState = parseAridUr(getStr("group"));

  if (sessionInState.hex() !== sessionId.hex()) {
    throw new Error(
      `start.json session ${sessionInState.urString()} does not match requested session ${sessionId.urString()}`,
    );
  }
  if (groupInState.hex() !== groupId.hex()) {
    throw new Error(
      `start.json group ${groupInState.urString()} does not match directory group ${groupId.urString()}`,
    );
  }

  const targetUr = getStr("target");

  const participantsVal = raw["participants"] as Record<string, Record<string, string>> | undefined;
  if (participantsVal === undefined || typeof participantsVal !== "object") {
    throw new Error("Missing participants in start.json");
  }

  const participants = new Map<string, StartParticipant>();
  for (const [xidStr, value] of Object.entries(participantsVal)) {
    const xid = XIDClass.fromURString(xidStr);
    if (typeof value !== "object" || value === null) {
      throw new Error("Participant entry is not an object in start.json");
    }

    const commitAridStr = value["commit_arid"];
    const shareAridStr = value["share_arid"];

    if (typeof commitAridStr !== "string") {
      throw new Error("Missing commit_arid in start.json");
    }
    if (typeof shareAridStr !== "string") {
      throw new Error("Missing share_arid in start.json");
    }

    participants.set(xid.urString(), {
      commitArid: parseAridUr(commitAridStr),
      shareArid: parseAridUr(shareAridStr),
    });
  }

  return { groupId, targetUr, participants };
}

/**
 * Validate and extract data from a sign commit response.
 *
 * Port of `validate_and_extract_sign_round1_response()` from cmd/sign/coordinator/round1.rs.
 */
export function validateAndExtractCommitResponse(
  envelope: Envelope,
  coordinatorKeys: PrivateKeys,
  expectedSender: XID,
  expectedSessionId: ARID,
): SignRound1ResponseData {
  const now = new Date();
  const sealedResponse = SealedResponse.tryFromEncryptedEnvelope(
    envelope,
    undefined,
    now,
    coordinatorKeys,
  );

  if (!sealedResponse.sender().xid().equals(expectedSender)) {
    throw new Error(
      `Unexpected response sender: ${sealedResponse.sender().xid().urString()} (expected ${expectedSender.urString()})`,
    );
  }

  if (sealedResponse.isErr()) {
    const errorEnvelope = sealedResponse.error();
    let reason = "unknown reason";
    try {
      const reasonEnv = errorEnvelope.objectForPredicate("reason");
      if (reasonEnv !== undefined) {
        reason = reasonEnv.extractString();
      }
    } catch {
      // Keep default reason
    }
    throw new Error(`Participant rejected signInvite: ${reason}`);
  }

  const result = sealedResponse.result();

  result.checkSubjectUnit();
  result.checkType("signRound1Response");

  const responseSession = result.tryObjectForPredicate("session", (cbor) =>
    ARIDClass.fromTaggedCbor(cbor),
  );
  if (responseSession.hex() !== expectedSessionId.hex()) {
    throw new Error(
      `Response session ${responseSession.urString()} does not match expected ${expectedSessionId.urString()}`,
    );
  }

  const commitmentsJson = result.tryObjectForPredicate("commitments", (cbor) =>
    JSONClass.fromTaggedCbor(cbor),
  );
  const commitments = JSON.parse(new TextDecoder().decode(commitmentsJson.toData())) as Record<
    string,
    unknown
  >;

  const nextRequestArid = result.tryObjectForPredicate("response_arid", (cbor) =>
    ARIDClass.fromTaggedCbor(cbor),
  );

  return { commitments, nextRequestArid };
}

/**
 * Collect signing commitments in parallel.
 *
 * Port of `collect_sign_round1_parallel()` from cmd/sign/coordinator/round1.rs.
 */
export async function collectCommitmentsParallel(
  client: StorageClient,
  registry: Registry,
  startState: StartState,
  coordinator: XIDDocument,
  sessionId: ARID,
  timeout?: number,
): Promise<CollectionResult<SignRound1ResponseData>> {
  const requests: [XID, ARID, string][] = [];

  for (const [xidStr, state] of startState.participants) {
    const xid = XIDClass.fromURString(xidStr);
    const participant = registry.participant(xid);
    const name = participant?.petName() ?? xid.urString();
    requests.push([xid, state.commitArid, name]);
  }

  const coordinatorKeys = coordinator.inceptionPrivateKeys();
  if (coordinatorKeys === undefined) {
    throw new Error("Missing coordinator private keys");
  }

  const config: ParallelFetchConfig = { timeoutSeconds: timeout };

  return parallelFetch(
    client,
    requests,
    (envelope: Envelope, xid: XID) => {
      try {
        return validateAndExtractCommitResponse(envelope, coordinatorKeys, xid, sessionId);
      } catch (e) {
        return { rejected: e instanceof Error ? e.message : String(e) };
      }
    },
    config,
  );
}

/**
 * Build a sign share request for a participant.
 *
 * Port of `build_sign_share_request()` from cmd/sign/coordinator/round1.rs.
 */
export function buildShareRequestForParticipant(
  sender: XIDDocument,
  _groupId: ARID,
  sessionId: ARID,
  responseArid: ARID,
  commitments: Map<string, unknown>, // Map<XID UR string, commitments>
): SealedRequest {
  let request = SealedRequest.new("signRound2", sessionId, sender)
    .withParameter("session", sessionId)
    .withParameter("response_arid", responseArid);

  for (const [xidStr, commits] of commitments) {
    const xid = XIDClass.fromURString(xidStr);
    const commitsJson = JSONClass.fromData(new TextEncoder().encode(JSON.stringify(commits)));
    // Create envelope with xid as subject, then add commitments assertion with JSON CBOR data
    const entry = Envelope.new(xid).addAssertion("commitments", commitsJson.taggedCborData());
    request = request.withParameter("commitment", entry);
  }

  return request;
}

/**
 * Dispatch share requests to participants in parallel.
 *
 * Port of parallel dispatch logic from cmd/sign/coordinator/round1.rs.
 */
export async function dispatchShareRequestsParallel(
  client: StorageClient,
  registry: Registry,
  owner: OwnerRecord,
  startState: StartState,
  sessionId: ARID,
  collection: CollectionResult<SignRound1ResponseData>,
  commitments: Map<string, unknown>,
  previewShare?: boolean,
  verbose?: boolean,
): Promise<[XID, Error | null][]> {
  const signerKeys = owner.xidDocument().inceptionPrivateKeys();
  if (signerKeys === undefined) {
    throw new Error("Coordinator XID document has no signing keys");
  }

  const validUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  const messages: [XID, ARID, Envelope, string][] = [];
  let previewPrinted = false;

  for (const [xid, data] of collection.successes) {
    const xidStr = xid.urString();
    const participantState = startState.participants.get(xidStr);
    if (participantState === undefined) {
      throw new Error(`Participant ${xidStr} not found in start state`);
    }

    const participant = registry.participant(xid);
    const participantName = participant?.petName() ?? xidStr;

    let recipientDoc: XIDDocument;
    if (xid.urString() === owner.xid().urString()) {
      recipientDoc = owner.xidDocument();
    } else {
      const record = registry.participant(xid);
      if (record === undefined) {
        throw new Error(`Participant ${xidStr} not found in registry`);
      }
      recipientDoc = record.xidDocument();
    }

    const request = buildShareRequestForParticipant(
      owner.xidDocument(),
      startState.groupId,
      sessionId,
      participantState.shareArid,
      commitments,
    );

    if (previewShare === true && !previewPrinted) {
      const preview = request.toEnvelope(validUntil, signerKeys, undefined);
      console.log(`# signRound2 preview for ${xidStr}`);
      console.log(preview.format());
      previewPrinted = true;
    }

    const sealedEnvelope = request.toEnvelopeForRecipients(validUntil, signerKeys, [recipientDoc]);

    messages.push([xid, data.nextRequestArid, sealedEnvelope, participantName]);
  }

  // Blank line to separate get phase from put phase
  console.error();

  return parallelSend(client, messages, verbose);
}

/**
 * Persist collected commitments to disk.
 *
 * Port of commitments persistence logic from cmd/sign/coordinator/round1.rs.
 */
export function persistCommitments(
  registryPath: string,
  groupId: ARID,
  sessionId: ARID,
  startState: StartState,
  commitments: Map<string, unknown>,
): string {
  const signingDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(signingDir, { recursive: true });

  const commitmentsPath = path.join(signingDir, "commitments.json");
  const commitmentsJson: Record<string, unknown> = {};

  for (const [xidStr, commits] of commitments) {
    const participantState = startState.participants.get(xidStr);
    if (participantState === undefined) {
      throw new Error(`Participant ${xidStr} not found in start state`);
    }

    commitmentsJson[xidStr] = {
      commitments: commits,
      share_arid: participantState.shareArid.urString(),
    };
  }

  const root = {
    group: groupId.urString(),
    session: sessionId.urString(),
    target: startState.targetUr,
    commitments: commitmentsJson,
  };

  fs.writeFileSync(commitmentsPath, JSON.stringify(root, null, 2));

  return commitmentsPath;
}

/**
 * Update pending requests in the registry for share phase.
 *
 * Note: In the Rust implementation, the registry doesn't track pending ARIDs
 * directly on participant records. The pending state is managed through the
 * start.json and commitments.json files in the signing state directory.
 *
 * This function is provided for API compatibility but currently does nothing.
 */
export function updatePendingForShare(
  _registry: Registry,
  _collection: CollectionResult<SignRound1ResponseData>,
  _startState: StartState,
): void {
  // No-op: The Rust implementation manages pending state through files,
  // not through the registry. The share_arid values are already stored
  // in commitments.json and will be used for round 2 collection.
}

/**
 * Execute the sign coordinator round 1 command.
 *
 * Collects signing commitments from participants.
 *
 * Port of `round1()` from cmd/sign/coordinator/round1.rs.
 */
export async function round1(
  client: StorageClient,
  options: SignRound1Options,
  cwd: string,
): Promise<SignRound1Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (owner === undefined) {
    throw new Error("Registry owner is required");
  }

  const sessionId = parseAridUr(options.sessionId);
  const groupHint = options.groupId !== undefined ? parseAridUr(options.groupId) : undefined;

  const startState = loadStartState(registryPath, sessionId, groupHint);
  const groupId = startState.groupId;
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }

  if (groupRecord.coordinator().xid().urString() !== owner.xid().urString()) {
    throw new Error(
      `Only the coordinator can collect signInvite responses. ` +
        `Coordinator: ${groupRecord.coordinator().xid().urString()}, ` +
        `Owner: ${owner.xid().urString()}`,
    );
  }

  if (options.parallel === true) {
    // Parallel path with progress display
    const collection = await collectCommitmentsParallel(
      client,
      registry,
      startState,
      owner.xidDocument(),
      sessionId,
      options.timeoutSeconds,
    );

    // Report any failures
    if (collection.rejections.length > 0) {
      console.error();
      console.error("Rejections:");
      for (const [xid, reason] of collection.rejections) {
        console.error(`  ${xid.urString()}: ${reason}`);
      }
    }
    if (collection.errors.length > 0) {
      console.error();
      console.error("Errors:");
      for (const [xid, error] of collection.errors) {
        console.error(`  ${xid.urString()}: ${error}`);
      }
    }
    if (collection.timeouts.length > 0) {
      console.error();
      console.error("Timeouts:");
      for (const xid of collection.timeouts) {
        console.error(`  ${xid.urString()}`);
      }
    }

    if (!collection.allSucceeded()) {
      throw new Error(
        `Sign commit collection incomplete: ${collection.successes.length} succeeded, ` +
          `${collection.rejections.length} rejected, ${collection.errors.length} errors, ` +
          `${collection.timeouts.length} timeouts`,
      );
    }

    // Build commitments map
    const commitments = new Map<string, unknown>();
    for (const [xid, data] of collection.successes) {
      commitments.set(xid.urString(), data.commitments);
    }

    // Persist aggregated commitments
    const commitmentsPath = persistCommitments(
      registryPath,
      groupId,
      sessionId,
      startState,
      commitments,
    );

    // Dispatch share requests in parallel
    const sendResults = await dispatchShareRequestsParallel(
      client,
      registry,
      owner,
      startState,
      sessionId,
      collection,
      commitments,
      options.previewShare,
      options.verbose,
    );

    // Check for send failures
    const failures = sendResults.filter(([_, err]) => err !== null);
    if (failures.length > 0) {
      for (const [xid, error] of failures) {
        if (error !== null) {
          console.error(`Failed to send to ${xid.urString()}: ${error.message}`);
        }
      }
      throw new Error(`Failed to send signRound2 requests to ${failures.length} participants`);
    }

    // Update registry pending requests
    updatePendingForShare(registry, collection, startState);

    const displayPath = path.relative(cwd, commitmentsPath) || commitmentsPath;

    if (isVerbose() || options.verbose === true) {
      console.error();
      console.error(
        `Collected ${collection.successes.length} signInvite responses. Saved to ${displayPath}`,
      );
      console.error(`Dispatched ${collection.successes.length} signRound2 requests.`);
    }

    return {
      accepted: collection.successes.length,
      rejected: collection.rejections.length,
      errors: collection.errors.length,
      timeouts: collection.timeouts.length,
    };
  } else {
    // Sequential path (original behavior)
    if (isVerbose() || options.verbose === true) {
      console.error(
        `Collecting signInvite responses for session ${sessionId.urString()} ` +
          `from ${startState.participants.size} participants...`,
      );
    }

    const commitments = new Map<string, unknown>();
    const sendToArids = new Map<string, ARID>();
    const errors: [XID, string][] = [];

    const coordinatorKeys = owner.xidDocument().inceptionPrivateKeys();
    if (coordinatorKeys === undefined) {
      throw new Error("Coordinator XID document has no inception private keys");
    }

    for (const [xidStr, participantState] of startState.participants) {
      const xid = XIDClass.fromURString(xidStr);
      const participant = registry.participant(xid);
      const participantName = participant?.petName() ?? xidStr;

      try {
        const envelope = await client.get(participantState.commitArid, options.timeoutSeconds);

        if (envelope === undefined) {
          throw new Error("Response not found in Hubert storage");
        }

        const data = validateAndExtractCommitResponse(envelope, coordinatorKeys, xid, sessionId);

        commitments.set(xidStr, data.commitments);
        sendToArids.set(xidStr, data.nextRequestArid);

        if (isVerbose() || options.verbose === true) {
          console.error(`  ✓ ${participantName}`);
        }
      } catch (e) {
        errors.push([xid, e instanceof Error ? e.message : String(e)]);
        if (isVerbose() || options.verbose === true) {
          console.error(`  ✗ ${participantName}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Sign commit collection incomplete: ${errors.length} of ${startState.participants.size} responses failed`,
      );
    }

    if (commitments.size !== startState.participants.size) {
      const missing: string[] = [];
      for (const xidStr of startState.participants.keys()) {
        if (!commitments.has(xidStr)) {
          missing.push(xidStr);
        }
      }
      throw new Error(`Missing signInvite responses from: ${missing.join(", ")}`);
    }

    // Persist aggregated commitments
    const commitmentsPath = persistCommitments(
      registryPath,
      groupId,
      sessionId,
      startState,
      commitments,
    );

    // Build and send signRound2 requests
    const signerKeys = owner.xidDocument().inceptionPrivateKeys();
    if (signerKeys === undefined) {
      throw new Error("Owner XID document has no inception private keys");
    }
    const validUntil = new Date(Date.now() + 60 * 60 * 1000);

    if (isVerbose() || options.verbose === true) {
      console.error(`Dispatching signRound2 requests to ${sendToArids.size} participants...`);
    } else {
      // Blank line to separate get phase from put phase
      console.error();
    }

    let previewPrinted = false;
    for (const [xidStr, sendToArid] of sendToArids) {
      const xid = XIDClass.fromURString(xidStr);
      const participantState = startState.participants.get(xidStr);
      if (participantState === undefined) {
        throw new Error(`Participant state not found for ${xidStr}`);
      }
      const participant = registry.participant(xid);
      const participantName = participant?.petName() ?? xidStr;

      let recipientDoc: XIDDocument;
      if (xidStr === owner.xid().urString()) {
        recipientDoc = owner.xidDocument();
      } else {
        const record = registry.participant(xid);
        if (record === undefined) {
          throw new Error(`Participant ${xidStr} not found in registry`);
        }
        recipientDoc = record.xidDocument();
      }

      const request = buildShareRequestForParticipant(
        owner.xidDocument(),
        groupId,
        sessionId,
        participantState.shareArid,
        commitments,
      );

      if (options.previewShare === true && !previewPrinted) {
        const preview = request.toEnvelope(validUntil, signerKeys, undefined);
        console.log(`# signRound2 preview for ${xidStr}`);
        console.log(preview.format());
        previewPrinted = true;
      }

      const sealedEnvelope = request.toEnvelopeForRecipients(validUntil, signerKeys, [
        recipientDoc,
      ]);

      await client.put(sendToArid, sealedEnvelope);

      if (isVerbose() || options.verbose === true) {
        console.error(`  ✓ ${participantName}`);
      }
    }

    const displayPath = path.relative(cwd, commitmentsPath) || commitmentsPath;

    if (isVerbose() || options.verbose === true) {
      console.error();
      console.error(`Collected ${commitments.size} signInvite responses. Saved to ${displayPath}`);
      console.error(`Dispatched ${commitments.size} signRound2 requests.`);
    }

    return {
      accepted: commitments.size,
      rejected: 0,
      errors: errors.length,
      timeouts: 0,
    };
  }
}
