/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Sign participant round 1 command.
 *
 * Port of cmd/sign/participant/round1.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, JSON as JSONWrapper, type PrivateKeys, XID } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { Envelope, Function as EnvelopeFunction } from "@bcts/envelope";
import { SealedRequest, SealedResponse } from "@bcts/gstp";
import type { XIDDocument } from "@bcts/xid";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { putWithIndicator } from "../../busy.js";
import { createStorageClient, type StorageClient, type StorageSelection } from "../../storage.js";
import { parseAridUr } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";
import {
  signingRound1,
  deserializeKeyPackage,
  serializeSigningNonces,
  serializeSigningCommitments,
  createRng,
  type SerializedKeyPackage,
  type SerializedSigningNonces,
  type SerializedSigningCommitments,
  type Ed25519SigningNonces,
  type Ed25519SigningCommitments,
} from "../../../frost/index.js";

/**
 * Options for the sign round1 command.
 */
export interface SignRound1Options {
  registryPath?: string;
  sessionId: string;
  groupId?: string;
  preview?: boolean;
  rejectReason?: string;
  storageSelection?: StorageSelection;
  verbose?: boolean;
}

/**
 * Result of the sign round1 command.
 */
export interface SignRound1Result {
  accepted: boolean;
  listeningArid?: string;
  envelopeUr?: string;
}

/**
 * Persisted receive state from sign_receive.json.
 *
 * Port of `struct ReceiveState` from cmd/sign/participant/round1.rs.
 */
interface ReceiveState {
  groupId: ARID;
  coordinatorDoc: XIDDocument;
  responseArid: ARID;
  targetUr: string;
  participants: XID[];
  requestEnvelope: Envelope;
}

/**
 * Load receive state from persisted sign_receive.json.
 *
 * Port of `load_receive_state()` from cmd/sign/participant/round1.rs lines 285-411.
 */
function loadReceiveState(
  registryPath: string,
  sessionId: ARID,
  groupHint: ARID | undefined,
  registry: Registry,
): ReceiveState {
  const base = path.dirname(registryPath);
  const groupStateDir = path.join(base, "group-state");

  // Collect candidate directories
  let groupDirs: [ARID, string][];
  if (groupHint !== undefined) {
    groupDirs = [[groupHint, path.join(groupStateDir, groupHint.hex())]];
  } else {
    groupDirs = [];
    if (fs.existsSync(groupStateDir)) {
      for (const entry of fs.readdirSync(groupStateDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          // Check if it's a 64-character hex string (ARID hex)
          if (dirName.length === 64 && /^[0-9a-fA-F]+$/.test(dirName)) {
            const groupId = ARID.fromHex(dirName);
            groupDirs.push([groupId, path.join(groupStateDir, dirName)]);
          }
        }
      }
    }
  }

  // Search for sign_receive.json
  const candidates: [ARID, string][] = [];
  for (const [groupId, groupDir] of groupDirs) {
    const candidate = path.join(groupDir, "signing", sessionId.hex(), "sign_receive.json");
    if (fs.existsSync(candidate)) {
      candidates.push([groupId, candidate]);
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      "No sign_receive.json found for this session; run `frost sign participant receive` first",
    );
  }
  if (candidates.length > 1) {
    throw new Error("Multiple groups contain this session; use --group to disambiguate");
  }

  const [groupId, filePath] = candidates[0];

  // Parse the JSON file
  interface SignReceiveJson {
    session: string;
    group: string;
    response_arid: string;
    target: string;
    coordinator: string;
    participants: string[];
    request_envelope: string;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SignReceiveJson;

  // Validate session matches
  const sessionInState = parseAridUr(raw.session);
  if (sessionInState.urString() !== sessionId.urString()) {
    throw new Error(
      `Session ${sessionInState.urString()} in sign_receive.json does not match requested session ${sessionId.urString()}`,
    );
  }

  const responseArid = parseAridUr(raw.response_arid);
  const targetUr = raw.target;
  const coordinatorUr = raw.coordinator;
  const coordinatorXid = XID.fromURString(coordinatorUr);

  // Resolve coordinator document from registry
  let coordinatorDoc: XIDDocument;
  const participantRecord = registry.participant(coordinatorXid);
  if (participantRecord !== null && participantRecord !== undefined) {
    coordinatorDoc = participantRecord.xidDocument();
  } else {
    const owner = registry.owner();
    if (owner?.xid().urString() === coordinatorXid.urString()) {
      coordinatorDoc = owner.xidDocument();
    } else {
      throw new Error(
        `Coordinator ${coordinatorXid.urString()} not found in registry and cannot resolve encryption key`,
      );
    }
  }

  // Parse request envelope
  const requestEnvelope = Envelope.fromURString(raw.request_envelope);

  // Parse participants
  const participants: XID[] = raw.participants.map((s: string) => XID.fromURString(s));

  return {
    groupId,
    coordinatorDoc,
    responseArid,
    targetUr,
    participants,
    requestEnvelope,
  };
}

/**
 * Validate the commit request from persisted state.
 *
 * Port of request validation in `CommandArgs::exec()` from cmd/sign/participant/round1.rs lines 100-138.
 */
function validateCommitRequest(
  receiveState: ReceiveState,
  sessionId: ARID,
  ownerXid: XID,
  ownerPrivateKeys: PrivateKeys,
): SealedRequest {
  const now = CborDate.now();

  // Decrypt and parse the request
  const sealedRequest = SealedRequest.tryFromEnvelope(
    receiveState.requestEnvelope,
    undefined,
    now.datetime(),
    ownerPrivateKeys,
  );

  // Validate function
  if (!sealedRequest.request().function().equals(EnvelopeFunction.fromString("signInvite"))) {
    throw new Error(`Unexpected request function: ${String(sealedRequest.request().function())}`);
  }

  // Validate session ID
  if (sealedRequest.request().id().urString() !== sessionId.urString()) {
    throw new Error(
      `Session ID mismatch (state ${sessionId.urString()}, request ${sealedRequest.request().id().urString()})`,
    );
  }

  // Validate group ID
  const requestGroup = sealedRequest.extractObjectForParameter<ARID>("group");
  if (requestGroup.urString() !== receiveState.groupId.urString()) {
    throw new Error(
      `Group ID mismatch (state ${receiveState.groupId.urString()}, request ${requestGroup.urString()})`,
    );
  }

  // Validate participant is included
  const participantUrStrings = receiveState.participants.map((p) => p.urString());
  if (!participantUrStrings.includes(ownerXid.urString())) {
    throw new Error("Persisted signInvite request does not include this participant");
  }

  return sealedRequest;
}

/**
 * Build the response body envelope.
 *
 * Port of response body building from cmd/sign/participant/round1.rs lines 191-195.
 */
function buildResponseBody(
  sessionId: ARID,
  commitments: Ed25519SigningCommitments,
  responseArid: ARID,
): Envelope {
  // Serialize commitments to JSON and wrap as CBOR JSON
  const serializedCommitments = serializeSigningCommitments(commitments);
  const jsonStr = JSON.stringify(serializedCommitments);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const commitmentsJson = JSONWrapper.fromData(jsonBytes);

  // Build response body: unit subject with type and assertions
  return Envelope.unit()
    .addType("signRound1Response")
    .addAssertion("session", sessionId)
    .addAssertion("commitments", commitmentsJson.taggedCborData())
    .addAssertion("response_arid", responseArid);
}

/**
 * Persist commit state (nonces and commitments) to disk.
 *
 * Port of `persist_commit_state()` from cmd/sign/participant/round1.rs lines 413-461.
 */
function persistCommitState(
  registryPath: string,
  groupId: ARID,
  sessionId: ARID,
  receiveState: ReceiveState,
  signingNonces: Ed25519SigningNonces,
  signingCommitments: Ed25519SigningCommitments,
  targetEnvelope: Envelope,
  nextShareArid: ARID,
): void {
  const dir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(dir, { recursive: true });

  // Serialize nonces and commitments
  const serializedNonces = serializeSigningNonces(signingNonces);
  const serializedCommitments = serializeSigningCommitments(signingCommitments);

  // Build commit state JSON
  const commitState: {
    session: string;
    response_arid: string;
    next_share_arid: string;
    target: string;
    signing_nonces: SerializedSigningNonces;
    signing_commitments: SerializedSigningCommitments;
  } = {
    session: sessionId.urString(),
    response_arid: receiveState.responseArid.urString(),
    next_share_arid: nextShareArid.urString(),
    target: targetEnvelope.urString(),
    signing_nonces: serializedNonces,
    signing_commitments: serializedCommitments,
  };

  fs.writeFileSync(path.join(dir, "commit.json"), JSON.stringify(commitState, null, 2));
}

/**
 * Execute the sign participant round 1 command.
 *
 * Responds to the sign invite with signing commitments.
 *
 * Port of `CommandArgs::exec()` from cmd/sign/participant/round1.rs lines 58-273.
 */
export async function round1(
  _client: StorageClient | undefined,
  options: SignRound1Options,
  cwd: string,
): Promise<SignRound1Result> {
  // Validate options
  if (options.storageSelection === undefined && options.preview !== true) {
    throw new Error("Hubert storage is required for sign commit");
  }
  if (options.storageSelection !== undefined && options.preview === true) {
    throw new Error("--preview cannot be used with Hubert storage options");
  }

  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (!owner) {
    throw new Error("Registry owner is required");
  }

  const sessionId = parseAridUr(options.sessionId);
  const groupHint = options.groupId !== undefined ? parseAridUr(options.groupId) : undefined;

  // Load receive state
  const receiveState = loadReceiveState(registryPath, sessionId, groupHint, registry);
  const groupId = receiveState.groupId;

  // Get group record
  const groupRecord = registry.group(groupId);
  if (groupRecord === null || groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }

  // Get owner private keys
  const ownerKeys = owner.xidDocument().inceptionPrivateKeys();
  if (ownerKeys === undefined) {
    throw new Error("Owner XID document has no private keys");
  }

  // Validate the commit request
  const sealedRequest = validateCommitRequest(receiveState, sessionId, owner.xid(), ownerKeys);

  // Load key package
  const contributions = groupRecord.contributions();
  if (contributions === null || contributions === undefined) {
    throw new Error("Key package path not found; did you finish DKG?");
  }
  const keyPackagePath = contributions.keyPackage;
  if (keyPackagePath === undefined) {
    throw new Error("Key package path not found; did you finish DKG?");
  }

  interface KeyPackageFile {
    group: string;
    key_package: SerializedKeyPackage;
  }

  const keyPackageFile = JSON.parse(fs.readFileSync(keyPackagePath, "utf-8")) as KeyPackageFile;
  const keyPackage = deserializeKeyPackage(keyPackageFile.key_package);

  // Parse target envelope
  const targetEnvelope = Envelope.fromURString(receiveState.targetUr);

  const signerPrivateKeys = owner.xidDocument().inceptionPrivateKeys();
  if (signerPrivateKeys === undefined) {
    throw new Error("Owner XID document has no signing keys");
  }

  let sealedResponse: SealedResponse;
  let nextShareArid: ARID | undefined;

  if (options.rejectReason !== undefined) {
    // Build rejection response
    const errorBody = Envelope.new("signCommitReject")
      .addAssertion("group", groupId)
      .addAssertion("session", sessionId)
      .addAssertion("reason", options.rejectReason);

    sealedResponse = SealedResponse.newFailure(sealedRequest.request().id(), owner.xidDocument())
      .withError(errorBody)
      .withPeerContinuation(sealedRequest.peerContinuation());
  } else {
    // Run signing round 1 - generate nonces and commitments
    const rng = createRng();
    const [signingNonces, signingCommitments] = signingRound1(keyPackage, rng);

    const nextShare = ARID.new();
    nextShareArid = nextShare;

    // Build response body
    const responseBody = buildResponseBody(sessionId, signingCommitments, nextShare);

    // Persist commit state (unless preview mode)
    if (options.preview !== true) {
      persistCommitState(
        registryPath,
        groupId,
        sessionId,
        receiveState,
        signingNonces,
        signingCommitments,
        targetEnvelope,
        nextShare,
      );

      // Update listening ARID for next request
      const groupRecordMut = registry.group(groupId);
      if (groupRecordMut !== null && groupRecordMut !== undefined) {
        groupRecordMut.setListeningAtArid(nextShare);
        registry.save(registryPath);
      }
    }

    sealedResponse = SealedResponse.newSuccess(sealedRequest.request().id(), owner.xidDocument())
      .withResult(responseBody)
      .withPeerContinuation(sealedRequest.peerContinuation());
  }

  // Handle preview mode
  if (options.preview === true) {
    const unsealed = sealedResponse.toEnvelope(undefined, signerPrivateKeys, undefined);
    const envelopeUr = unsealed.urString();
    console.log(envelopeUr);
    return {
      accepted: options.rejectReason === undefined,
      envelopeUr,
    };
  }

  // Build encrypted response envelope
  const validUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const responseEnvelope = sealedResponse.toEnvelope(
    validUntil,
    signerPrivateKeys,
    receiveState.coordinatorDoc,
  );

  // Post response to Hubert storage
  if (options.storageSelection === undefined) {
    throw new Error("Storage selection is required to post response");
  }
  const client = await createStorageClient(options.storageSelection);

  if (options.verbose === true) {
    console.error(`Posting signInvite response to ${receiveState.responseArid.urString()}`);
  }

  await putWithIndicator(
    client,
    receiveState.responseArid,
    responseEnvelope,
    "Commitments",
    options.verbose ?? false,
  );

  // On reject, clear listening ARID
  if (options.rejectReason !== undefined) {
    const groupRecordMut = registry.group(groupId);
    if (groupRecordMut !== null && groupRecordMut !== undefined) {
      groupRecordMut.clearListeningAtArid();
      registry.save(registryPath);
    }
  }

  const result: SignRound1Result = {
    accepted: options.rejectReason === undefined,
  };
  if (nextShareArid !== undefined) {
    result.listeningArid = nextShareArid.urString();
  }
  return result;
}
