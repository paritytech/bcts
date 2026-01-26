/**
 * Sign coordinator round 2 command.
 *
 * Port of cmd/sign/coordinator/round2.rs from frost-hubert-rust.
 *
 * @module
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  type ARID,
  type XID,
  XID as XIDClass,
  ARID as ARIDClass,
  Signature,
  type PrivateKeys,
  JSON as JSONComponent,
} from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { type XIDDocument } from "@bcts/xid";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { parallelFetch, parallelSend, type CollectionResult } from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, signingKeyFromVerifying } from "../../dkg/common.js";
import { signingStateDir, SignFinalizeContent } from "../common.js";
import { putWithIndicator } from "../../busy.js";
import {
  aggregateSignatures,
  createSigningPackage,
  deserializeSigningCommitments,
  deserializeSignatureShare,
  deserializePublicKeyPackage,
  identifierFromU16,
  serializeSignature,
  serializeSignatureShare,
  type SerializedPublicKeyPackage,
  type SerializedSigningCommitments,
  type FrostIdentifier,
  type Ed25519SigningCommitments,
  type Ed25519SignatureShare,
  type FrostPublicKeyPackage,
} from "../../../frost/index.js";

/**
 * Options for the sign round2 command.
 */
export interface SignRound2Options {
  registryPath?: string;
  groupId?: string;
  sessionId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  previewFinalize?: boolean;
  verbose?: boolean;
}

/**
 * Result of the sign round2 command.
 */
export interface SignRound2Result {
  signature: string;
  signedEnvelope: string;
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
}

/**
 * Data extracted from a successful signature share response.
 *
 * Port of `struct SignRound2ResponseData` from cmd/sign/coordinator/round2.rs.
 */
interface SignRound2ResponseData {
  signatureShare: Ed25519SignatureShare;
  finalizeArid: ARID;
}

/**
 * State loaded from start.json.
 *
 * Port of `struct StartState` from cmd/sign/coordinator/round2.rs.
 */
interface StartState {
  groupId: ARID;
  minSigners: number;
  participants: XID[];
  targetUr: string;
}

/**
 * Individual participant's commitment data.
 *
 * Port of `struct ParticipantCommitment` from cmd/sign/coordinator/round2.rs.
 */
interface ParticipantCommitment {
  commitments: Ed25519SigningCommitments;
  shareArid: ARID;
}

/**
 * State loaded from commitments.json.
 *
 * Port of `struct CommitmentsState` from cmd/sign/coordinator/round2.rs.
 */
interface CommitmentsState {
  commitments: Map<string, ParticipantCommitment>; // XID UR string -> commitment
}

/**
 * Validate envelope and extract signature share data (for parallel fetch).
 *
 * Port of `validate_and_extract_share_response()` from cmd/sign/coordinator/round2.rs.
 */
function validateAndExtractShareResponse(
  envelope: Envelope,
  _coordinatorKeys: PrivateKeys,
  expectedSender: XID,
  expectedSessionId: ARID,
): SignRound2ResponseData | { rejected: string } {
  // In the full implementation, we would decrypt the sealed response here
  // For now, we extract the data from the envelope directly

  try {
    // Check the response type
    envelope.checkSubjectUnit();
    envelope.checkType("signRound2Response");

    // Extract session ID using objectsForPredicate and then extract subjects
    const sessionObjects = envelope.objectsForPredicate("session");
    if (sessionObjects.length === 0) {
      return { rejected: "Missing session in response" };
    }
    const responseSession = ARIDClass.fromTaggedCbor(sessionObjects[0].subject().tryLeaf());
    if (responseSession.urString() !== expectedSessionId.urString()) {
      return {
        rejected: `Response session ${responseSession.urString()} does not match expected ${expectedSessionId.urString()}`,
      };
    }

    // Extract participant XID (sender check)
    const participantObjects = envelope.objectsForPredicate("participant");
    if (participantObjects.length === 0) {
      return { rejected: "Missing participant in response" };
    }
    const participantXid = XIDClass.fromTaggedCbor(participantObjects[0].subject().tryLeaf());
    if (participantXid.urString() !== expectedSender.urString()) {
      return {
        rejected: `Unexpected response sender: ${participantXid.urString()} (expected ${expectedSender.urString()})`,
      };
    }

    // Extract signature share (JSON-serialized)
    const shareObjects = envelope.objectsForPredicate("signature_share");
    if (shareObjects.length === 0) {
      return { rejected: "Missing signature_share in response" };
    }
    const signatureShareJson = JSONComponent.fromTaggedCbor(shareObjects[0].subject().tryLeaf());
    const signatureShareData = JSON.parse(signatureShareJson.toString()) as { share: string };
    const signatureShare = deserializeSignatureShare(signatureShareData.share);

    // Extract finalize ARID (response_arid)
    const responseAridObjects = envelope.objectsForPredicate("response_arid");
    if (responseAridObjects.length === 0) {
      return { rejected: "Missing response_arid in response" };
    }
    const finalizeArid = ARIDClass.fromTaggedCbor(responseAridObjects[0].subject().tryLeaf());

    return { signatureShare, finalizeArid };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { rejected: `Failed to parse response: ${message}` };
  }
}

/**
 * Collect signature shares in parallel with progress display.
 *
 * Port of `collect_shares_parallel()` from cmd/sign/coordinator/round2.rs.
 */
async function collectSharesParallel(
  client: StorageClient,
  registry: Registry,
  commitmentsState: CommitmentsState,
  coordinator: XIDDocument,
  sessionId: ARID,
  timeoutSeconds?: number,
): Promise<CollectionResult<SignRound2ResponseData>> {
  // Build requests from commitments
  const requests: [XID, ARID, string][] = [];

  for (const [xidUr, entry] of commitmentsState.commitments) {
    const xid = XIDClass.fromURString(xidUr);
    const participant = registry.participant(xid);
    const name = participant?.petName() ?? xid.urString();
    requests.push([xid, entry.shareArid, name]);
  }

  const coordinatorKeys = coordinator.inceptionPrivateKeys();
  if (!coordinatorKeys) {
    throw new Error("Coordinator XID document has no inception private keys");
  }

  const session = sessionId;

  return parallelFetch(
    client,
    requests,
    (envelope: Envelope, xid: XID) => {
      return validateAndExtractShareResponse(envelope, coordinatorKeys, xid, session);
    },
    {
      timeoutSeconds,
      verbose: false,
    },
  );
}

/**
 * Build a finalize event containing all signature shares.
 *
 * Port of `build_finalize_event()` from cmd/sign/coordinator/round2.rs.
 */
function buildFinalizeEvent(
  _sender: XIDDocument,
  sessionId: ARID,
  signatureSharesByXid: Map<string, Ed25519SignatureShare>,
): SignFinalizeContent {
  // Build the content with session and all signature shares
  let content = SignFinalizeContent.new().addAssertion("session", sessionId);

  for (const [xidUr, share] of signatureSharesByXid) {
    const xid = XIDClass.fromURString(xidUr);
    const shareHex = serializeSignatureShare(share);
    const shareJson = JSONComponent.fromString(JSON.stringify({ share: shareHex }));
    const entry = Envelope.new(xid).addAssertion("share", shareJson);
    content = content.addAssertion("signature_share", entry);
  }

  return content;
}

/**
 * Aggregate signature shares and verify the result.
 *
 * Port of signature aggregation logic from cmd/sign/coordinator/round2.rs.
 */
function aggregateAndVerifySignature(
  signingCommitments: Map<FrostIdentifier, Ed25519SigningCommitments>,
  signatureSharesByIdentifier: Map<FrostIdentifier, Ed25519SignatureShare>,
  publicKeyPackage: FrostPublicKeyPackage,
  targetDigest: Uint8Array,
): { signature: Signature; signatureUr: string } {
  // Create signing package
  const signingPackage = createSigningPackage(signingCommitments, targetDigest);

  // Aggregate signature shares
  const aggregatedSignature = aggregateSignatures(
    signingPackage,
    signatureSharesByIdentifier,
    publicKeyPackage,
  );

  // Serialize the aggregated signature
  const signatureBytes = serializeSignature(aggregatedSignature);

  // Verify the signature is 64 bytes
  if (signatureBytes.length !== 64) {
    throw new Error("Aggregated signature is not 64 bytes");
  }

  // Create bc-components Signature
  const signature = Signature.ed25519FromData(signatureBytes);
  const signatureUr = signature.urString();

  return { signature, signatureUr };
}

/**
 * Persist final signing state to disk.
 *
 * Port of `persist_final_state()` from cmd/sign/coordinator/round2.rs.
 */
function persistSigningState(
  registryPath: string,
  groupId: ARID,
  sessionId: ARID,
  signature: Signature,
  signatureSharesByXid: Map<string, Ed25519SignatureShare>,
  finalizeArids: Map<string, ARID>,
): void {
  const dir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(dir, { recursive: true });

  // Build signature shares JSON object
  const sharesJson: Record<string, unknown> = {};
  for (const [xidUr, share] of signatureSharesByXid) {
    sharesJson[xidUr] = { share: serializeSignatureShare(share) };
  }

  // Build finalize ARIDs JSON object
  const finalizeJson: Record<string, string> = {};
  for (const [xidUr, arid] of finalizeArids) {
    finalizeJson[xidUr] = arid.urString();
  }

  // Build root JSON object
  const root = {
    group: groupId.urString(),
    session: sessionId.urString(),
    signature: signature.urString(),
    signature_shares: sharesJson,
    finalize_arids: finalizeJson,
  };

  fs.writeFileSync(path.join(dir, "final.json"), JSON.stringify(root, null, 2));
}

/**
 * Load start state from disk.
 *
 * Port of `load_start_state()` from cmd/sign/coordinator/round2.rs.
 */
function loadStartState(registryPath: string, sessionId: ARID, groupHint?: ARID): StartState {
  const base = path.dirname(registryPath);
  const groupStateDir = path.join(base, "group-state");

  // Find candidate paths
  const candidatePaths: [ARID, string][] = [];
  let groupDirs: [ARID, string][];

  if (groupHint) {
    groupDirs = [[groupHint, path.join(groupStateDir, groupHint.hex())]];
  } else {
    groupDirs = [];
    if (fs.existsSync(groupStateDir)) {
      for (const entry of fs.readdirSync(groupStateDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.length === 64 && /^[0-9a-f]+$/i.test(entry.name)) {
          const groupId = ARIDClass.fromHex(entry.name);
          groupDirs.push([groupId, path.join(groupStateDir, entry.name)]);
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

  if (sessionInState.urString() !== sessionId.urString()) {
    throw new Error(
      `start.json session ${sessionInState.urString()} does not match requested session ${sessionId.urString()}`,
    );
  }
  if (groupInState.urString() !== groupId.urString()) {
    throw new Error(
      `start.json group ${groupInState.urString()} does not match directory group ${groupId.urString()}`,
    );
  }

  const minSigners = raw["min_signers"];
  if (typeof minSigners !== "number") {
    throw new Error("Missing min_signers in start.json");
  }

  const participantsVal = raw["participants"] as Record<string, unknown> | undefined;
  if (!participantsVal || typeof participantsVal !== "object") {
    throw new Error("Missing participants in start.json");
  }

  const participants: XID[] = [];
  for (const xidStr of Object.keys(participantsVal)) {
    participants.push(XIDClass.fromURString(xidStr));
  }
  participants.sort((a, b) => a.urString().localeCompare(b.urString()));

  const targetUr = getStr("target");

  return { groupId, minSigners, participants, targetUr };
}

/**
 * Load commitments state from disk.
 *
 * Port of `load_commitments_state()` from cmd/sign/coordinator/round2.rs.
 */
function loadCommitmentsState(
  registryPath: string,
  groupId: ARID,
  sessionId: ARID,
): CommitmentsState {
  const dir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  const statePath = path.join(dir, "commitments.json");

  if (!fs.existsSync(statePath)) {
    throw new Error(
      `Commitments not found at ${statePath}. Run \`frost sign coordinator collect\` first`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(statePath, "utf-8")) as Record<string, unknown>;

  const getStr = (key: string): string => {
    const value = raw[key];
    if (typeof value !== "string") {
      throw new Error(`Missing or invalid ${key} in commitments.json`);
    }
    return value;
  };

  const sessionInState = parseAridUr(getStr("session"));
  if (sessionInState.urString() !== sessionId.urString()) {
    throw new Error(
      `commitments.json session ${sessionInState.urString()} does not match requested session ${sessionId.urString()}`,
    );
  }

  const commitmentsVal = raw["commitments"] as Record<string, unknown> | undefined;
  if (!commitmentsVal || typeof commitmentsVal !== "object") {
    throw new Error("Missing commitments map in commitments.json");
  }

  const commitments = new Map<string, ParticipantCommitment>();

  for (const [xidStr, value] of Object.entries(commitmentsVal)) {
    const obj = value as Record<string, unknown>;
    const commitValue = obj["commitments"] as SerializedSigningCommitments | undefined;
    if (!commitValue) {
      throw new Error("Missing commitments value in commitments.json");
    }
    const commitmentsDeserialized = deserializeSigningCommitments(commitValue);

    const shareAridRaw = obj["share_arid"];
    if (typeof shareAridRaw !== "string") {
      throw new Error("Missing share_arid in commitments.json");
    }
    const shareArid = parseAridUr(shareAridRaw);

    commitments.set(xidStr, {
      commitments: commitmentsDeserialized,
      shareArid,
    });
  }

  return { commitments };
}

/**
 * Load public key package from collected_finalize.json.
 *
 * Port of `load_public_key_package()` from cmd/sign/coordinator/round2.rs.
 */
function loadPublicKeyPackage(registryPath: string, groupId: ARID): FrostPublicKeyPackage {
  const base = path.dirname(registryPath);
  const pkgPath = path.join(base, "group-state", groupId.hex(), "collected_finalize.json");

  if (!fs.existsSync(pkgPath)) {
    throw new Error(
      `collected_finalize.json not found at ${pkgPath}. Run \`frost dkg coordinator finalize collect\` first`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  const firstEntry = Object.values(raw)[0] as Record<string, unknown> | undefined;

  if (!firstEntry) {
    throw new Error("collected_finalize.json is empty");
  }

  const publicKeyValue = firstEntry["public_key_package"] as SerializedPublicKeyPackage | undefined;
  if (!publicKeyValue) {
    throw new Error("public_key_package missing in collected_finalize.json");
  }

  return deserializePublicKeyPackage(publicKeyValue);
}

/**
 * Build a map from XID to FROST identifier.
 *
 * Port of `xid_identifier_map()` from cmd/sign/coordinator/round2.rs.
 */
function xidIdentifierMap(participants: XID[]): Map<string, FrostIdentifier> {
  const map = new Map<string, FrostIdentifier>();
  for (let i = 0; i < participants.length; i++) {
    const identifier = identifierFromU16(i + 1);
    map.set(participants[i].urString(), identifier);
  }
  return map;
}

/**
 * Build signing commitments with identifiers.
 *
 * Port of `commitments_with_identifiers()` from cmd/sign/coordinator/round2.rs.
 */
function commitmentsWithIdentifiers(
  commitments: Map<string, ParticipantCommitment>,
  xidToIdentifier: Map<string, FrostIdentifier>,
): Map<FrostIdentifier, Ed25519SigningCommitments> {
  const mapped = new Map<FrostIdentifier, Ed25519SigningCommitments>();
  for (const [xidUr, entry] of commitments) {
    const identifier = xidToIdentifier.get(xidUr);
    if (!identifier) {
      throw new Error(`Unknown participant ${xidUr}`);
    }
    mapped.set(identifier, entry.commitments);
  }
  return mapped;
}

/**
 * Execute the sign coordinator round 2 command.
 *
 * Collects signature shares, aggregates the signature, and posts finalize packages.
 *
 * Port of `CommandArgs::exec()` from cmd/sign/coordinator/round2.rs.
 */
export async function round2(
  client: StorageClient,
  options: SignRound2Options,
  cwd: string,
): Promise<SignRound2Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (!owner) {
    throw new Error("Registry owner is required");
  }

  const sessionId = parseAridUr(options.sessionId);
  const groupHint = options.groupId ? parseAridUr(options.groupId) : undefined;

  // Load start state (finds group automatically if not specified)
  const startState = loadStartState(registryPath, sessionId, groupHint);
  const groupId = startState.groupId;

  const groupRecord = registry.group(groupId);
  if (!groupRecord) {
    throw new Error("Group not found in registry");
  }

  // Verify coordinator ownership
  if (groupRecord.coordinator().xid().urString() !== owner.xid().urString()) {
    throw new Error(
      `Only the coordinator can finalize signing. Coordinator: ${groupRecord.coordinator().xid().urString()}, Owner: ${owner.xid().urString()}`,
    );
  }

  // Load commitments state
  const commitmentsState = loadCommitmentsState(registryPath, groupId, sessionId);

  // Build XID to identifier map
  const xidToIdentifier = xidIdentifierMap(startState.participants);

  // Collect signature shares
  let signatureSharesByIdentifier: Map<FrostIdentifier, Ed25519SignatureShare>;
  let signatureSharesByXid: Map<string, Ed25519SignatureShare>;
  let finalizeArids: Map<string, ARID>;

  if (options.parallel === true) {
    // Parallel collection path
    const collection = await collectSharesParallel(
      client,
      registry,
      commitmentsState,
      owner.xidDocument(),
      sessionId,
      options.timeoutSeconds,
    );

    if (!collection.allSucceeded()) {
      // Report failures
      if (collection.rejections.length > 0) {
        console.error("\nRejections:");
        for (const [xid, reason] of collection.rejections) {
          console.error(`  ${xid.urString()}: ${reason}`);
        }
      }
      if (collection.errors.length > 0) {
        console.error("\nErrors:");
        for (const [xid, error] of collection.errors) {
          console.error(`  ${xid.urString()}: ${error}`);
        }
      }
      if (collection.timeouts.length > 0) {
        console.error("\nTimeouts:");
        for (const xid of collection.timeouts) {
          console.error(`  ${xid.urString()}`);
        }
      }
      throw new Error(
        `Signature share collection incomplete: ${collection.successes.length} succeeded, ` +
          `${collection.rejections.length} rejected, ${collection.errors.length} errors, ` +
          `${collection.timeouts.length} timeouts`,
      );
    }

    // Convert collection to maps
    signatureSharesByIdentifier = new Map();
    signatureSharesByXid = new Map();
    finalizeArids = new Map();

    for (const [xid, data] of collection.successes) {
      const xidUr = xid.urString();
      const identifier = xidToIdentifier.get(xidUr);
      if (!identifier) {
        throw new Error("Identifier mapping missing for participant");
      }
      signatureSharesByIdentifier.set(identifier, data.signatureShare);
      signatureSharesByXid.set(xidUr, data.signatureShare);
      finalizeArids.set(xidUr, data.finalizeArid);
    }
  } else {
    // Sequential collection path
    if (options.verbose === true) {
      console.error(
        `Collecting signature shares for session ${sessionId.urString()} from ${commitmentsState.commitments.size} participants...`,
      );
    }

    signatureSharesByIdentifier = new Map();
    signatureSharesByXid = new Map();
    finalizeArids = new Map();

    for (const [xidUr, entry] of commitmentsState.commitments) {
      const xid = XIDClass.fromURString(xidUr);
      const participant = registry.participant(xid);
      const participantName = participant?.petName() ?? xid.urString();

      const identifier = xidToIdentifier.get(xidUr);
      if (!identifier) {
        throw new Error("Identifier mapping missing for participant");
      }

      // Fetch the response
      const envelope = await client.get(entry.shareArid, options.timeoutSeconds);
      if (!envelope) {
        throw new Error(`Signature share response not found for ${participantName}`);
      }

      const coordinatorKeys = owner.xidDocument().inceptionPrivateKeys();
      if (!coordinatorKeys) {
        throw new Error("Coordinator XID document has no inception private keys");
      }

      const result = validateAndExtractShareResponse(envelope, coordinatorKeys, xid, sessionId);
      if ("rejected" in result) {
        throw new Error(`Participant rejected signRound2: ${result.rejected}`);
      }

      signatureSharesByIdentifier.set(identifier, result.signatureShare);
      signatureSharesByXid.set(xidUr, result.signatureShare);
      finalizeArids.set(xidUr, result.finalizeArid);
    }
  }

  // Verify we have enough shares
  if (signatureSharesByIdentifier.size < startState.minSigners) {
    throw new Error(
      `Only collected ${signatureSharesByIdentifier.size} signature shares, need at least ${startState.minSigners}`,
    );
  }

  // Build signing commitments with identifiers
  const signingCommitments = commitmentsWithIdentifiers(
    commitmentsState.commitments,
    xidToIdentifier,
  );

  // Get target digest
  const targetEnvelope = Envelope.fromURString(startState.targetUr);
  const targetDigest = targetEnvelope.subject().digest().data();

  // Load public key package
  const publicKeyPackage = loadPublicKeyPackage(registryPath, groupId);
  const verifyingKey = signingKeyFromVerifying(publicKeyPackage.verifyingKey);

  // Aggregate and verify signature
  const { signature, signatureUr } = aggregateAndVerifySignature(
    signingCommitments,
    signatureSharesByIdentifier,
    publicKeyPackage,
    targetDigest,
  );

  // Verify signature against target digest
  // @ts-expect-error - verifyingKey type mismatch
  if (verifyingKey.verify(signature, targetDigest) !== true) {
    throw new Error("Aggregated signature failed verification against target digest");
  }

  // Attach signature to target and verify

  const signedEnvelope = Envelope.fromURString(startState.targetUr).addAssertion(
    "signed",
    signature,
  );
  const signedEnvelopeUr = signedEnvelope.urString();

  // Persist final state
  persistSigningState(
    registryPath,
    groupId,
    sessionId,
    signature,
    signatureSharesByXid,
    finalizeArids,
  );

  if (options.verbose === true) {
    console.error();
    console.error(
      `Aggregated signature for session ${sessionId.urString()} and prepared ${finalizeArids.size} finalize packages.`,
    );
    console.error("Signature verified against target and group key.");
  }

  // Dispatch finalize events to participants
  const signerKeys = owner.xidDocument().inceptionPrivateKeys();
  if (!signerKeys) {
    throw new Error("Coordinator XID document has no signing keys");
  }

  if (options.verbose === true) {
    console.error(`Dispatching finalize packages to ${finalizeArids.size} participants...`);
  } else {
    // Blank line to separate get phase from put phase
    console.error();
  }

  // Build finalize messages
  const messages: [XID, ARID, Envelope, string][] = [];
  let previewPrinted = false;

  for (const [xidUr, finalizeArid] of finalizeArids) {
    const participantXid = XIDClass.fromURString(xidUr);
    const participant = registry.participant(participantXid);
    const participantName = participant?.petName() ?? xidUr;

    const recipientDoc =
      xidUr === owner.xid().urString() ? owner.xidDocument() : participant?.xidDocument();

    if (!recipientDoc) {
      throw new Error(`Participant ${xidUr} not found in registry`);
    }

    const event = buildFinalizeEvent(owner.xidDocument(), sessionId, signatureSharesByXid);

    if (options.previewFinalize === true && !previewPrinted) {
      // Preview as unsigned, unencrypted envelope
      console.log(`# signFinalize preview for ${participantXid.urString()}`);
      console.log(event.envelope().format());
      previewPrinted = true;
    }

    // For now, use the plain envelope (GSTP sealing would be applied in full implementation)
    const sealed = event.envelope();

    messages.push([participantXid, finalizeArid, sealed, participantName]);
  }

  // Dispatch messages
  if (options.parallel === true) {
    // Parallel send
    console.error();
    const results = await parallelSend(client, messages, options.verbose === true);

    // Check for errors
    const errors: string[] = [];
    for (const [xid, result] of results) {
      if (result !== null) {
        const participant = registry.participant(xid);
        const name = participant?.petName() ?? xid.urString();
        errors.push(`${name}: ${result.message}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`Failed to send finalize packages: ${errors.join("; ")}`);
    }
  } else {
    // Sequential send
    for (const [_xid, finalizeArid, sealed, participantName] of messages) {
      await putWithIndicator(
        client,
        finalizeArid,
        sealed,
        participantName,
        options.verbose ?? false,
      );
    }
  }

  // Print final signature and signed envelope UR
  console.log(signatureUr);
  console.log(signedEnvelopeUr);

  return {
    signature: signatureUr,
    signedEnvelope: signedEnvelopeUr,
    accepted: signatureSharesByIdentifier.size,
    rejected: 0,
    errors: 0,
    timeouts: 0,
  };
}
