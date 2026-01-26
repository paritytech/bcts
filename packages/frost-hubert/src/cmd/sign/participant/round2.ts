/**
 * Sign participant round 2 command.
 *
 * Port of cmd/sign/participant/round2.rs from frost-hubert-rust.
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
  JSON as JSONComponent,
  type Digest,
} from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { Envelope, Function as EnvelopeFunction } from "@bcts/envelope";
import { type XIDDocument } from "@bcts/xid";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator, putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";
import {
  signingRound2,
  createSigningPackage,
  deserializeKeyPackage,
  deserializeSigningCommitments,
  serializeSignatureShare,
  serializeSigningCommitments,
  identifierFromU16,
  type SerializedKeyPackage,
  type SerializedSigningCommitments,
  type FrostIdentifier,
  type FrostKeyPackage,
  type Ed25519SigningCommitments,
  type Ed25519SignatureShare,
} from "../../../frost/index.js";

// Import nonces from @frosts/core
import { Nonce, SigningNonces } from "@frosts/core";
import { Ed25519Sha512, serde } from "@frosts/ed25519";

/**
 * Options for the sign round2 command.
 */
export interface SignRound2Options {
  registryPath?: string;
  sessionId: string;
  groupId?: string;
  timeoutSeconds?: number;
  preview?: boolean;
  verbose?: boolean;
}

/**
 * Result of the sign round2 command.
 */
export interface SignRound2Result {
  listeningArid: string;
}

/**
 * ReceiveState loaded from sign_receive.json.
 *
 * Port of `struct ReceiveState` from cmd/sign/participant/round2.rs.
 */
interface ReceiveState {
  groupId: ARID;
  participants: XID[];
  minSigners: number;
  targetUr: string;
}

/**
 * CommitState loaded from commit.json.
 *
 * Port of `struct CommitState` from cmd/sign/participant/round2.rs.
 */
interface CommitState {
  nextShareArid: ARID;
  targetUr: string;
  signingNonces: SigningNonces<typeof Ed25519Sha512>;
  signingCommitments: Ed25519SigningCommitments;
}

/**
 * Sealed request interface for GSTP.
 */
interface SealedRequestInstance {
  function: () => unknown;
  id: () => ARID;
  sender: () => { xid: () => XID };
  extractObjectForParameter: <T>(name: string) => T;
  objectsForParameter: (name: string) => Envelope[];
}

/**
 * Load receive state from sign_receive.json.
 *
 * Port of `load_receive_state()` from cmd/sign/participant/round2.rs.
 */
function loadReceiveState(registryPath: string, sessionId: ARID, groupHint?: ARID): ReceiveState {
  const base = path.dirname(registryPath);
  const groupStateDir = path.join(base, "group-state");

  // Find candidate paths
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

  const [groupId, statePath] = candidates[0];
  const raw = JSON.parse(fs.readFileSync(statePath, "utf-8")) as Record<string, unknown>;

  const getStr = (key: string): string => {
    const value = raw[key];
    if (typeof value !== "string") {
      throw new Error(`Missing or invalid ${key} in sign_receive.json`);
    }
    return value;
  };

  // Validate session matches
  const sessionInState = parseAridUr(getStr("session"));
  if (sessionInState.urString() !== sessionId.urString()) {
    throw new Error(
      `Session ${sessionInState.urString()} in sign_receive.json does not match requested session ${sessionId.urString()}`,
    );
  }

  // Validate group matches
  const groupInState = parseAridUr(getStr("group"));
  if (groupInState.urString() !== groupId.urString()) {
    throw new Error(
      `Group ${groupInState.urString()} in sign_receive.json does not match directory group ${groupId.urString()}`,
    );
  }

  // Parse participants
  const participantsVal = raw["participants"] as string[] | undefined;
  if (!participantsVal || !Array.isArray(participantsVal)) {
    throw new Error("Missing participants in sign_receive.json");
  }

  const participants: XID[] = [];
  for (const entry of participantsVal) {
    if (typeof entry !== "string") {
      throw new Error("Invalid participant entry in sign_receive.json");
    }
    participants.push(XIDClass.fromURString(entry));
  }

  // Parse min_signers
  const minSigners = raw["min_signers"];
  if (typeof minSigners !== "number") {
    throw new Error("Missing min_signers in sign_receive.json");
  }

  const targetUr = getStr("target");

  return {
    groupId,
    participants,
    minSigners,
    targetUr,
  };
}

/**
 * Load commit state from commit.json (includes nonces).
 *
 * Port of `load_commit_state()` from cmd/sign/participant/round2.rs.
 */
function loadCommitState(registryPath: string, groupId: ARID, sessionId: ARID): CommitState {
  const dir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  const statePath = path.join(dir, "commit.json");

  if (!fs.existsSync(statePath)) {
    throw new Error(
      `Commit state not found at ${statePath}. Run \`frost sign participant commit\` first.`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(statePath, "utf-8")) as Record<string, unknown>;

  const getStr = (key: string): string => {
    const value = raw[key];
    if (typeof value !== "string") {
      throw new Error(`Missing or invalid ${key} in commit.json`);
    }
    return value;
  };

  // Validate session matches
  const sessionInState = parseAridUr(getStr("session"));
  if (sessionInState.urString() !== sessionId.urString()) {
    throw new Error(
      `Session ${sessionInState.urString()} in commit.json does not match requested session ${sessionId.urString()}`,
    );
  }

  const nextShareArid = parseAridUr(getStr("next_share_arid"));
  const targetUr = getStr("target");

  // Deserialize signing nonces
  const noncesRaw = raw["signing_nonces"] as Record<string, string> | undefined;
  if (!noncesRaw) {
    throw new Error("Missing signing_nonces in commit.json");
  }

  const hidingNonce = Nonce.deserialize(Ed25519Sha512, serde.hexToBytes(noncesRaw["hiding"]));
  const bindingNonce = Nonce.deserialize(Ed25519Sha512, serde.hexToBytes(noncesRaw["binding"]));
  const signingNonces = SigningNonces.fromNonces(Ed25519Sha512, hidingNonce, bindingNonce);

  // Deserialize signing commitments
  const commitmentsRaw = raw["signing_commitments"] as SerializedSigningCommitments | undefined;
  if (!commitmentsRaw) {
    throw new Error("Missing signing_commitments in commit.json");
  }
  const signingCommitments = deserializeSigningCommitments(commitmentsRaw);

  return {
    nextShareArid,
    targetUr,
    signingNonces,
    signingCommitments,
  };
}

/**
 * Validate the incoming GSTP request.
 *
 * Port of request validation logic from cmd/sign/participant/round2.rs.
 */
function validateShareRequest(
  sealedRequest: SealedRequestInstance,
  sessionId: ARID,
  expectedCoordinator: XID,
): void {
  // Check function
  const expectedFunction = EnvelopeFunction.fromString("signRound2");
  const actualFunction = sealedRequest.function();
  // @ts-expect-error - function() returns unknown, but it should have .equals()
  if (actualFunction.equals(expectedFunction) !== true) {
    throw new Error(`Unexpected request function: ${String(sealedRequest.function())}`);
  }

  // Check session ID
  if (sealedRequest.id().urString() !== sessionId.urString()) {
    throw new Error(
      `Session ID mismatch (request ${sealedRequest.id().urString()}, expected ${sessionId.urString()})`,
    );
  }

  // Check sender (coordinator)
  if (sealedRequest.sender().xid().urString() !== expectedCoordinator.urString()) {
    throw new Error(
      `Unexpected request sender: ${sealedRequest.sender().xid().urString()} (expected coordinator ${expectedCoordinator.urString()})`,
    );
  }
}

/**
 * Extract all commitments from the signRound2 request.
 *
 * Port of `parse_commitments()` from cmd/sign/participant/round2.rs.
 */
function extractCommitments(
  sealedRequest: SealedRequestInstance,
  receiveState: ReceiveState,
): Map<string, Ed25519SigningCommitments> {
  const commitments = new Map<string, Ed25519SigningCommitments>();

  const commitmentObjects = sealedRequest.objectsForParameter("commitment");

  for (const entry of commitmentObjects) {
    // Extract XID subject
    const xid = XIDClass.fromTaggedCbor(entry.subject().tryLeaf());

    // Extract commitments from the "commitments" predicate
    const commitmentsObjects = entry.objectsForPredicate("commitments");
    if (commitmentsObjects.length === 0) {
      throw new Error(`Missing commitments for participant ${xid.urString()}`);
    }

    const commitmentsJson = JSONComponent.fromTaggedCbor(commitmentsObjects[0].subject().tryLeaf());
    const serializedCommitments = JSON.parse(
      commitmentsJson.asStr(),
    ) as SerializedSigningCommitments;
    const signingCommitments = deserializeSigningCommitments(serializedCommitments);

    const xidUr = xid.urString();
    if (commitments.has(xidUr)) {
      throw new Error(`Duplicate commitments for participant ${xidUr}`);
    }
    commitments.set(xidUr, signingCommitments);
  }

  if (commitments.size === 0) {
    throw new Error("signRound2 request contains no commitments");
  }

  // Validate expected participant set
  const expectedSet = new Set(receiveState.participants.map((p) => p.urString()));
  const actualSet = new Set(commitments.keys());

  const missing: string[] = [];
  const extra: string[] = [];

  for (const xid of expectedSet) {
    if (!actualSet.has(xid)) {
      missing.push(xid);
    }
  }
  for (const xid of actualSet) {
    if (!expectedSet.has(xid)) {
      extra.push(xid);
    }
  }

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `signRound2 commitments do not match session participants (missing: ${missing.join(", ")}; extra: ${extra.join(", ")})`,
    );
  }

  return commitments;
}

/**
 * Build a map from XID to FROST identifier (sorted participant order).
 *
 * Port of `xid_identifier_map()` from cmd/sign/participant/round2.rs.
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
 * Port of `commitments_with_identifiers()` from cmd/sign/participant/round2.rs.
 */
function commitmentsWithIdentifiers(
  commitments: Map<string, Ed25519SigningCommitments>,
  xidToIdentifier: Map<string, FrostIdentifier>,
): Map<FrostIdentifier, Ed25519SigningCommitments> {
  const mapped = new Map<FrostIdentifier, Ed25519SigningCommitments>();
  for (const [xidUr, commits] of commitments) {
    const identifier = xidToIdentifier.get(xidUr);
    if (!identifier) {
      throw new Error(`Unknown participant ${xidUr}`);
    }
    mapped.set(identifier, commits);
  }
  return mapped;
}

/**
 * Build the signRound2Response body envelope.
 *
 * Port of response body construction from cmd/sign/participant/round2.rs.
 */
function buildResponseBody(
  sessionId: ARID,
  signatureShare: Ed25519SignatureShare,
  finalizeArid: ARID,
): Envelope {
  const shareHex = serializeSignatureShare(signatureShare);
  const shareJson = JSONComponent.fromString(JSON.stringify({ share: shareHex }));

  return Envelope.unit()
    .addType("signRound2Response")
    .addAssertion("session", sessionId)
    .addAssertion("signature_share", shareJson)
    .addAssertion("response_arid", finalizeArid);
}

/**
 * Persist share state to share.json.
 *
 * Port of `persist_share_state()` from cmd/sign/participant/round2.rs.
 */
function persistShareState(
  registryPath: string,
  groupId: ARID,
  sessionId: ARID,
  responseArid: ARID,
  finalizeArid: ARID,
  signatureShare: Ed25519SignatureShare,
  commitments: Map<string, Ed25519SigningCommitments>,
): void {
  const dir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(dir, { recursive: true });

  // Build commitments JSON object
  const commitmentsJson: Record<string, SerializedSigningCommitments> = {};
  for (const [xidUr, commits] of commitments) {
    commitmentsJson[xidUr] = serializeSigningCommitments(commits);
  }

  // Build root JSON object
  const root = {
    session: sessionId.urString(),
    response_arid: responseArid.urString(),
    finalize_arid: finalizeArid.urString(),
    signature_share: { share: serializeSignatureShare(signatureShare) },
    commitments: commitmentsJson,
  };

  fs.writeFileSync(path.join(dir, "share.json"), JSON.stringify(root, null, 2));
}

/**
 * Execute the sign participant round 2 command.
 *
 * Receives round 2 request and sends signature share.
 *
 * Port of `CommandArgs::exec()` from cmd/sign/participant/round2.rs.
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
  const ownerXidDocument = owner.xidDocument();

  const sessionId = parseAridUr(options.sessionId);
  const groupHint = options.groupId ? parseAridUr(options.groupId) : undefined;

  // Load receive state (finds group automatically if not specified)
  const receiveState = loadReceiveState(registryPath, sessionId, groupHint);
  const groupId = receiveState.groupId;

  const groupRecord = registry.group(groupId);
  if (!groupRecord) {
    throw new Error("Group not found in registry");
  }

  // Validate min_signers matches
  if (groupRecord.minSigners() !== receiveState.minSigners) {
    throw new Error(
      `Session min_signers ${receiveState.minSigners} does not match registry ${groupRecord.minSigners()}`,
    );
  }

  // Validate participants match
  const registryParticipants = new Set(groupRecord.participants().map((p) => p.xid().urString()));
  const sessionParticipants = new Set(receiveState.participants.map((p) => p.urString()));

  if (
    registryParticipants.size !== sessionParticipants.size ||
    ![...registryParticipants].every((p) => sessionParticipants.has(p))
  ) {
    throw new Error("Session participants do not match registry group participants");
  }

  // Validate owner participates in this session
  if (!sessionParticipants.has(owner.xid().urString())) {
    throw new Error("This participant is not part of the signing session");
  }

  // Get listening ARID from registry
  const listeningAtArid = groupRecord.listeningAtArid();
  if (!listeningAtArid) {
    throw new Error(
      "No listening ARID for signRound2. Did you run `frost sign participant commit`?",
    );
  }

  // Load commit state and validate
  const commitState = loadCommitState(registryPath, groupId, sessionId);

  if (commitState.nextShareArid.urString() !== listeningAtArid.urString()) {
    throw new Error(
      `Listening ARID in registry (${listeningAtArid.urString()}) does not match persisted commit state (${commitState.nextShareArid.urString()})`,
    );
  }

  if (commitState.targetUr !== receiveState.targetUr) {
    throw new Error("Target envelope in commit state does not match persisted signInvite request");
  }

  // Load key package
  const keyPackagePath = groupRecord.contributions().keyPackage;
  if (!keyPackagePath) {
    throw new Error("Key package path not found; did you finish DKG?");
  }

  interface KeyPackageFile {
    group?: string;
    key_package: SerializedKeyPackage;
  }

  const keyPackageFile = JSON.parse(fs.readFileSync(keyPackagePath, "utf-8")) as KeyPackageFile;
  const keyPackage: FrostKeyPackage = deserializeKeyPackage(keyPackageFile.key_package);

  // Create finalize ARID
  const finalizeArid = ARIDClass.new();

  // Compute target digest from persisted target envelope
  const targetEnvelope = Envelope.fromURString(receiveState.targetUr);
  const targetDigest: Digest = targetEnvelope.subject().digest();

  if (options.verbose === true) {
    console.error("Fetching signRound2 request from Hubert...");
  }

  // Fetch request from storage
  const requestEnvelope = await getWithIndicator(
    client,
    listeningAtArid,
    "signRound2 request",
    options.timeoutSeconds,
    options.verbose ?? false,
  );

  if (!requestEnvelope) {
    throw new Error("signRound2 request not found in Hubert storage");
  }

  // Parse sealed request
  const signerPrivateKeys = ownerXidDocument.inceptionPrivateKeys();
  if (!signerPrivateKeys) {
    throw new Error("Owner XID document has no private keys");
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { SealedRequest: SealedRequestClass } = require("@bcts/gstp") as {
    SealedRequest: {
      tryFromEnvelope: (
        envelope: Envelope,
        expectedSender: XID | undefined,
        now: CborDate,
        recipientPrivateKeys: unknown,
      ) => SealedRequestInstance;
    };
  };

  const now = CborDate.now();
  const sealedRequest = SealedRequestClass.tryFromEnvelope(
    requestEnvelope,
    undefined,
    now,
    signerPrivateKeys,
  );

  // Validate request
  const expectedCoordinator = groupRecord.coordinator().xid();
  validateShareRequest(sealedRequest, sessionId, expectedCoordinator);

  // Extract response ARID from request
  const responseArid: ARID = sealedRequest.extractObjectForParameter("response_arid");

  // Extract and validate commitments
  const commitmentsByXid = extractCommitments(sealedRequest, receiveState);

  // Verify our commitments match
  const myCommitments = commitmentsByXid.get(owner.xid().urString());
  if (!myCommitments) {
    throw new Error("signRound2 request missing commitments for this participant");
  }

  // Compare commitments using serialized form
  const myCommitmentsSerialized = serializeSigningCommitments(myCommitments);
  const storedCommitmentsSerialized = serializeSigningCommitments(commitState.signingCommitments);

  if (
    myCommitmentsSerialized.hiding !== storedCommitmentsSerialized.hiding ||
    myCommitmentsSerialized.binding !== storedCommitmentsSerialized.binding
  ) {
    throw new Error("signRound2 request commitments do not match locally stored commitments");
  }

  // Build XID to identifier map (sorted participant order)
  const xidToIdentifier = xidIdentifierMap(receiveState.participants);

  // Verify our identifier matches key package
  const myIdentifier = xidToIdentifier.get(owner.xid().urString());
  if (!myIdentifier) {
    throw new Error("Identifier for participant not found");
  }

  // Verify key package min_signers matches
  if (keyPackage.minSigners !== receiveState.minSigners) {
    throw new Error(
      `Key package min_signers ${keyPackage.minSigners} does not match session ${receiveState.minSigners}`,
    );
  }

  // Verify enough commitments
  if (commitmentsByXid.size < receiveState.minSigners) {
    throw new Error(
      `signRound2 request contained ${commitmentsByXid.size} commitments but requires at least ${receiveState.minSigners} signers`,
    );
  }

  // Build signing commitments with identifiers
  const signingCommitments = commitmentsWithIdentifiers(commitmentsByXid, xidToIdentifier);

  // Create signing package
  const signingPackage = createSigningPackage(signingCommitments, targetDigest.data());

  // Generate signature share using FROST round 2
  const signatureShare = signingRound2(signingPackage, commitState.signingNonces, keyPackage);

  // Build response body
  const responseBody = buildResponseBody(sessionId, signatureShare, finalizeArid);

  // Build sealed response
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { SealedResponse: SealedResponseClass } = require("@bcts/gstp") as {
    SealedResponse: {
      newSuccess: (
        requestId: ARID,
        sender: XIDDocument,
      ) => {
        withResult: (result: Envelope) => {
          withPeerContinuation: (continuation: unknown) => {
            toEnvelope: (
              expiry: CborDate | undefined,
              signerPrivateKeys: unknown,
              recipient: XIDDocument | undefined,
            ) => Envelope;
          };
          toEnvelope: (
            expiry: CborDate | undefined,
            signerPrivateKeys: unknown,
            recipient: XIDDocument | undefined,
          ) => Envelope;
        };
      };
    };
  };

  const sealedResponse = SealedResponseClass.newSuccess(
    sealedRequest.id(),
    ownerXidDocument,
  ).withResult(responseBody);

  // Preview mode - print unsealed response
  if (options.preview === true) {
    const unsealed = sealedResponse.toEnvelope(undefined, signerPrivateKeys, undefined);
    console.log(unsealed.urString());
    return {
      listeningArid: finalizeArid.urString(),
    };
  }

  // Get coordinator XID document for encryption
  let coordinatorDoc: XIDDocument;
  if (expectedCoordinator.urString() === owner.xid().urString()) {
    coordinatorDoc = ownerXidDocument;
  } else {
    const coordinatorRecord = registry.participant(expectedCoordinator);
    if (!coordinatorRecord) {
      throw new Error(`Coordinator ${expectedCoordinator.urString()} not found in registry`);
    }
    coordinatorDoc = coordinatorRecord.xidDocument();
  }

  // Create response envelope with expiry
  const expiry = CborDate.withDurationFromNow(60 * 60); // 1 hour
  const responseEnvelope = sealedResponse.toEnvelope(expiry, signerPrivateKeys, coordinatorDoc);

  // Send response
  await putWithIndicator(
    client,
    responseArid,
    responseEnvelope,
    "Signature Share",
    options.verbose ?? false,
  );

  // Persist share state
  persistShareState(
    registryPath,
    groupId,
    sessionId,
    responseArid,
    finalizeArid,
    signatureShare,
    commitmentsByXid,
  );

  // Update registry with finalize listening ARID
  const groupRecordMutable = registry.group(groupId);
  if (groupRecordMutable) {
    groupRecordMutable.setListeningAtArid(finalizeArid);
    registry.save(registryPath);
  }

  if (options.verbose === true) {
    console.error(`Posted signature share to ${responseArid.urString()}`);
  }

  return {
    listeningArid: finalizeArid.urString(),
  };
}
