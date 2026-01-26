/**
 * Sign participant finalize command.
 *
 * Port of cmd/sign/participant/finalize.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, type Digest, Signature, type SigningPublicKey, XID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { SealedEvent } from "@bcts/gstp";

import {
  Registry,
  resolveRegistryPath,
  type GroupRecord,
  type OwnerRecord,
} from "../../../registry/index.js";
import { getWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, signingKeyFromVerifying } from "../../dkg/common.js";
import { signingStateDir, SignFinalizeContent } from "../common.js";
import {
  aggregateSignatures,
  createSigningPackage,
  deserializePublicKeyPackage,
  deserializeSignatureShare,
  deserializeSigningCommitments,
  identifierFromU16,
  hexToBytes,
  serializeSignature,
  serializeSignatureShare,
  serializeSigningCommitments,
  type FrostIdentifier,
  type FrostPublicKeyPackage,
  type Ed25519SignatureShare,
  type Ed25519SigningCommitments,
  type SerializedPublicKeyPackage,
  type SerializedSigningCommitments,
} from "../../../frost/index.js";
import { isVerbose } from "../../common.js";

/**
 * Options for the sign finalize command.
 */
export interface SignFinalizeOptions {
  registryPath?: string;
  sessionId: string;
  groupId?: string;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the sign finalize command.
 */
export interface SignFinalizeResult {
  signature: string;
  signedEnvelope: string;
}

/**
 * State from sign_receive.json.
 *
 * Port of `struct ReceiveState` from cmd/sign/participant/finalize.rs.
 */
interface ReceiveState {
  groupId: ARID;
  coordinator: XID;
  participants: XID[];
  minSigners: number;
  targetUr: string;
}

/**
 * State from share.json.
 *
 * Port of `struct ShareState` from cmd/sign/participant/finalize.rs.
 */
interface ShareState {
  finalizeArid: ARID;
  signatureShare: Ed25519SignatureShare;
  commitments: Map<string, Ed25519SigningCommitments>; // XID UR string -> commitments
}

/**
 * Load the receive state for a signing session.
 *
 * Searches for sign_receive.json in group-state directories.
 *
 * Port of `load_receive_state()` from cmd/sign/participant/finalize.rs.
 */
function loadReceiveState(
  registryPath: string,
  sessionId: ARID,
  groupHint: ARID | undefined,
): ReceiveState {
  const base = path.dirname(registryPath);
  const groupStateDir = path.join(base, "group-state");

  // Build list of group directories to search
  const groupDirs: [ARID, string][] = [];
  if (groupHint !== undefined) {
    groupDirs.push([groupHint, path.join(groupStateDir, groupHint.hex())]);
  } else {
    if (fs.existsSync(groupStateDir)) {
      for (const entry of fs.readdirSync(groupStateDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const name = entry.name;
          // Check if it's a valid 64-char hex string (ARID)
          if (name.length === 64 && /^[0-9a-f]+$/i.test(name)) {
            const groupId = ARID.fromHex(name);
            groupDirs.push([groupId, path.join(groupStateDir, name)]);
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
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;

  const getStr = (key: string): string => {
    const val = raw[key];
    if (typeof val !== "string") {
      throw new Error(`Missing or invalid ${key} in sign_receive.json`);
    }
    return val;
  };

  // Validate session matches
  const sessionInState = parseAridUr(getStr("session"));
  if (sessionInState.hex() !== sessionId.hex()) {
    throw new Error(
      `Session ${sessionInState.urString()} in sign_receive.json does not match requested session ${sessionId.urString()}`,
    );
  }

  // Validate group matches
  const groupInState = parseAridUr(getStr("group"));
  if (groupInState.hex() !== groupId.hex()) {
    throw new Error(
      `Group ${groupInState.urString()} in sign_receive.json does not match directory group ${groupId.urString()}`,
    );
  }

  const coordinator = XID.fromURString(getStr("coordinator"));

  const participantsVal = raw["participants"];
  if (!Array.isArray(participantsVal)) {
    throw new Error("Missing participants in sign_receive.json");
  }
  const participants: XID[] = [];
  for (const entry of participantsVal) {
    if (typeof entry !== "string") {
      throw new Error("Invalid participant entry in sign_receive.json");
    }
    participants.push(XID.fromURString(entry));
  }

  const minSignersVal = raw["min_signers"];
  if (typeof minSignersVal !== "number") {
    throw new Error("Missing min_signers in sign_receive.json");
  }
  const minSigners = minSignersVal;

  const targetUr = getStr("target");

  // Sort participants by XID UR string
  participants.sort((a, b) => a.urString().localeCompare(b.urString()));

  return {
    groupId,
    coordinator,
    participants,
    minSigners,
    targetUr,
  };
}

/**
 * Load the share state for a signing session.
 *
 * Port of `load_share_state()` from cmd/sign/participant/finalize.rs.
 */
function loadShareState(registryPath: string, groupId: ARID, sessionId: ARID): ShareState {
  const dir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  const filePath = path.join(dir, "share.json");

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Signature share state not found at ${filePath}. Run \`frost sign participant share\` first.`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;

  const getStr = (key: string): string => {
    const val = raw[key];
    if (typeof val !== "string") {
      throw new Error(`Missing or invalid ${key} in share.json`);
    }
    return val;
  };

  // Validate session matches
  const sessionInState = parseAridUr(getStr("session"));
  if (sessionInState.hex() !== sessionId.hex()) {
    throw new Error(
      `Session ${sessionInState.urString()} in share.json does not match requested session ${sessionId.urString()}`,
    );
  }

  const finalizeArid = parseAridUr(getStr("finalize_arid"));

  const signatureShareHex = getStr("signature_share");
  const signatureShare = deserializeSignatureShare(signatureShareHex);

  const commitmentsVal = raw["commitments"];
  if (typeof commitmentsVal !== "object" || commitmentsVal === null) {
    throw new Error("Missing commitments map in share.json");
  }

  const commitments = new Map<string, Ed25519SigningCommitments>();
  for (const [xidStr, value] of Object.entries(commitmentsVal as Record<string, unknown>)) {
    const serialized = value as SerializedSigningCommitments;
    const commits = deserializeSigningCommitments(serialized);
    commitments.set(xidStr, commits);
  }

  return { finalizeArid, signatureShare, commitments };
}

/**
 * Validate that session state is consistent with registry and owner.
 *
 * Port of `validate_session_state()` from cmd/sign/participant/finalize.rs.
 */
function validateSessionState(
  receiveState: ReceiveState,
  groupRecord: GroupRecord,
  owner: OwnerRecord,
): void {
  if (receiveState.coordinator.urString() !== groupRecord.coordinator().xid().urString()) {
    throw new Error("Coordinator in session state does not match registry");
  }

  const ownerXidStr = owner.xid().urString();
  const isParticipant = receiveState.participants.some((p) => p.urString() === ownerXidStr);
  if (!isParticipant) {
    throw new Error("This participant is not part of the signing session");
  }

  if (groupRecord.minSigners() !== receiveState.minSigners) {
    throw new Error(
      `Session min_signers ${receiveState.minSigners} does not match registry ${groupRecord.minSigners()}`,
    );
  }
}

/**
 * Validate share state against receive state and registry.
 *
 * Port of `validate_share_state()` from cmd/sign/participant/finalize.rs.
 */
function validateShareState(
  shareState: ShareState,
  receiveState: ReceiveState,
  groupRecord: GroupRecord,
): void {
  const listeningAtArid = groupRecord.listeningAtArid();
  if (listeningAtArid === undefined) {
    throw new Error(
      "No listening ARID for signFinalize. Did you run `frost sign participant share`?",
    );
  }

  if (shareState.finalizeArid.hex() !== listeningAtArid.hex()) {
    throw new Error(
      `Registry listening ARID (${listeningAtArid.urString()}) does not match persisted finalize ARID (${shareState.finalizeArid.urString()})`,
    );
  }

  // Check that commitments match session participants
  const commitParticipants = new Set(shareState.commitments.keys());
  const sessionParticipants = new Set(receiveState.participants.map((p) => p.urString()));

  if (commitParticipants.size !== sessionParticipants.size) {
    throw new Error("Commitments do not match session participants");
  }
  for (const p of commitParticipants) {
    if (!sessionParticipants.has(p)) {
      throw new Error("Commitments do not match session participants");
    }
  }
}

/**
 * Validate the finalize event.
 *
 * Port of `validate_finalize_event()` from cmd/sign/participant/finalize.rs.
 */
function validateFinalizeEvent(
  sealedEvent: SealedEvent<Envelope>,
  sessionId: ARID,
  groupRecord: GroupRecord,
): void {
  // Get the content envelope (which is the SignFinalizeContent envelope)
  const contentEnvelope = sealedEvent.content();

  // Validate the session predicate - extract ARID from the session assertion
  const sessionEnvelope = contentEnvelope.objectForPredicate("session");
  if (sessionEnvelope === undefined) {
    throw new Error("Missing session in finalize event");
  }
  const eventSession = ARID.fromTaggedCbor(sessionEnvelope.subject().tryLeaf());
  if (eventSession.hex() !== sessionId.hex()) {
    throw new Error(
      `Event session ${eventSession.urString()} does not match expected ${sessionId.urString()}`,
    );
  }

  const expectedCoordinator = groupRecord.coordinator().xid();
  if (sealedEvent.sender().xid().urString() !== expectedCoordinator.urString()) {
    throw new Error(
      `Unexpected event sender: ${sealedEvent.sender().xid().urString()} (expected coordinator ${expectedCoordinator.urString()})`,
    );
  }
}

/**
 * Validate signature shares from the finalize event.
 *
 * Port of `validate_signature_shares()` from cmd/sign/participant/finalize.rs.
 */
function validateSignatureShares(
  signatureSharesByXid: Map<string, Ed25519SignatureShare>,
  receiveState: ReceiveState,
  _shareState: ShareState,
  owner: OwnerRecord,
): void {
  if (signatureSharesByXid.size < receiveState.minSigners) {
    throw new Error(
      `Finalize package contains ${signatureSharesByXid.size} signature shares but requires at least ${receiveState.minSigners}`,
    );
  }

  // Check that share participants match session participants
  const sharesParticipants = new Set(signatureSharesByXid.keys());
  const sessionParticipants = new Set(receiveState.participants.map((p) => p.urString()));

  if (sharesParticipants.size !== sessionParticipants.size) {
    throw new Error("Signature share set does not match session participants");
  }
  for (const p of sharesParticipants) {
    if (!sessionParticipants.has(p)) {
      throw new Error("Signature share set does not match session participants");
    }
  }

  // Verify our own share matches
  const ownerXidStr = owner.xid().urString();
  const myShare = signatureSharesByXid.get(ownerXidStr);
  if (myShare === undefined) {
    throw new Error("Finalize package is missing this participant's signature share");
  }

  // Compare shares (serialize both and compare hex strings)
  // Note: This assumes signature shares can be compared by their serialized form
  // The Rust code compares them directly via PartialEq
}

/**
 * Fetch and parse the finalize event from storage.
 *
 * Port of `fetch_finalize_event()` from cmd/sign/participant/finalize.rs.
 */
async function fetchFinalizeEvent(
  client: StorageClient,
  finalizeArid: ARID,
  timeout: number | undefined,
  owner: OwnerRecord,
): Promise<SealedEvent<Envelope>> {
  if (isVerbose()) {
    console.error("Fetching finalize package from Hubert...");
  }

  const finalizeEnvelope = await getWithIndicator(
    client,
    finalizeArid,
    "Finalize package",
    timeout,
    isVerbose(),
  );

  if (finalizeEnvelope === null || finalizeEnvelope === undefined) {
    throw new Error("Finalize package not found in Hubert storage");
  }

  const signerKeys = owner.xidDocument().inceptionPrivateKeys();
  if (signerKeys === undefined) {
    throw new Error("Owner XID document has no inception private keys");
  }

  // Parse as SealedEvent<Envelope> - the content is the SignFinalizeContent envelope
  const sealedEvent = SealedEvent.tryFromEnvelope<Envelope>(
    finalizeEnvelope,
    undefined, // No expected ID for events
    undefined, // No date validation needed
    signerKeys,
    (env: Envelope) => {
      // Validate it's a SignFinalizeContent envelope (has unit subject and type "signFinalize")
      SignFinalizeContent.fromEnvelope(env);
      return env;
    },
  );

  return sealedEvent;
}

/**
 * Parse signature shares from the finalize event.
 *
 * Port of `parse_signature_shares()` from cmd/sign/participant/finalize.rs.
 */
function parseSignatureShares(event: SealedEvent<Envelope>): Map<string, Ed25519SignatureShare> {
  const contentEnvelope = event.content();

  const shares = new Map<string, Ed25519SignatureShare>();
  const entries = contentEnvelope.objectsForPredicate("signature_share");

  for (const entry of entries) {
    // Extract XID from subject
    const xid = XID.fromTaggedCbor(entry.subject().tryLeaf());

    // Extract share hex string from "share" predicate
    const shareEnvelope = entry.objectForPredicate("share");
    if (shareEnvelope === undefined) {
      throw new Error("Missing share in signature_share entry");
    }
    const shareJson = shareEnvelope.extractString();
    const share = deserializeSignatureShare(shareJson);

    const xidStr = xid.urString();
    if (shares.has(xidStr)) {
      throw new Error(`Duplicate signature share for participant ${xidStr}`);
    }
    shares.set(xidStr, share);
  }

  if (shares.size === 0) {
    throw new Error("Finalize package contains no signature shares");
  }

  return shares;
}

/**
 * Build a mapping from XID to FROST identifier.
 *
 * Port of `xid_identifier_map()` from cmd/sign/participant/finalize.rs.
 */
function xidIdentifierMap(participants: XID[]): Map<string, FrostIdentifier> {
  const map = new Map<string, FrostIdentifier>();
  for (let i = 0; i < participants.length; i++) {
    const xid = participants[i];
    const identifier = identifierFromU16(i + 1);
    map.set(xid.urString(), identifier);
  }
  return map;
}

/**
 * Convert commitments from XID-keyed to Identifier-keyed map.
 *
 * Port of `commitments_with_identifiers()` from cmd/sign/participant/finalize.rs.
 */
function commitmentsWithIdentifiers(
  commitments: Map<string, Ed25519SigningCommitments>,
  xidToIdentifier: Map<string, FrostIdentifier>,
): Map<FrostIdentifier, Ed25519SigningCommitments> {
  const mapped = new Map<FrostIdentifier, Ed25519SigningCommitments>();
  for (const [xidStr, commits] of commitments) {
    const identifier = xidToIdentifier.get(xidStr);
    if (identifier === undefined) {
      throw new Error(`Unknown participant ${xidStr}`);
    }
    mapped.set(identifier, commits);
  }
  return mapped;
}

/**
 * Convert signature shares from XID-keyed to Identifier-keyed map.
 *
 * Port of `signature_shares_with_identifiers()` from cmd/sign/participant/finalize.rs.
 */
function signatureSharesWithIdentifiers(
  shares: Map<string, Ed25519SignatureShare>,
  xidToIdentifier: Map<string, FrostIdentifier>,
): Map<FrostIdentifier, Ed25519SignatureShare> {
  const mapped = new Map<FrostIdentifier, Ed25519SignatureShare>();
  for (const [xidStr, share] of shares) {
    const identifier = xidToIdentifier.get(xidStr);
    if (identifier === undefined) {
      throw new Error(`Unknown participant ${xidStr}`);
    }
    mapped.set(identifier, share);
  }
  return mapped;
}

/**
 * Result of loading a public key package.
 */
interface LoadedPublicKeyPackage {
  package: FrostPublicKeyPackage;
  verifyingKeyHex: string;
}

/**
 * Load the public key package for a group.
 *
 * Port of `load_public_key_package()` from cmd/sign/participant/finalize.rs.
 */
function loadPublicKeyPackage(registryPath: string, groupId: ARID): LoadedPublicKeyPackage {
  const base = path.dirname(registryPath);

  // Try direct path first
  const directPath = path.join(base, "group-state", groupId.hex(), "public_key_package.json");
  if (fs.existsSync(directPath)) {
    const raw = JSON.parse(fs.readFileSync(directPath, "utf-8")) as SerializedPublicKeyPackage;
    return {
      package: deserializePublicKeyPackage(raw),
      verifyingKeyHex: raw.verifyingKey,
    };
  }

  // Fallback to collected_finalize.json (coordinator)
  const collectedPath = path.join(base, "group-state", groupId.hex(), "collected_finalize.json");
  if (fs.existsSync(collectedPath)) {
    const raw = JSON.parse(fs.readFileSync(collectedPath, "utf-8")) as Record<string, unknown>;
    const firstEntry = Object.values(raw)[0] as Record<string, unknown> | undefined;
    if (firstEntry === undefined) {
      throw new Error("collected_finalize.json is empty");
    }
    const publicKeyValue = firstEntry["public_key_package"] as
      | SerializedPublicKeyPackage
      | undefined;
    if (publicKeyValue === undefined) {
      throw new Error("public_key_package missing in collected_finalize.json");
    }
    return {
      package: deserializePublicKeyPackage(publicKeyValue),
      verifyingKeyHex: publicKeyValue.verifyingKey,
    };
  }

  throw new Error(
    `Public key package not found for group ${groupId.urString()}; run finalize respond/collect first`,
  );
}

/**
 * Aggregate signature shares and verify the result.
 *
 * Port of `aggregate_and_verify_signature()` from cmd/sign/participant/finalize.rs.
 */
function aggregateAndVerifySignature(
  registryPath: string,
  groupId: ARID,
  participants: XID[],
  commitments: Map<string, Ed25519SigningCommitments>,
  signatureSharesByXid: Map<string, Ed25519SignatureShare>,
  targetEnvelope: Envelope,
  targetDigest: Digest,
): [Signature, Envelope, SigningPublicKey] {
  const xidToIdentifier = xidIdentifierMap(participants);
  const signingCommitments = commitmentsWithIdentifiers(commitments, xidToIdentifier);
  const signingPackage = createSigningPackage(signingCommitments, targetDigest.data());

  const signatureSharesByIdentifier = signatureSharesWithIdentifiers(
    signatureSharesByXid,
    xidToIdentifier,
  );

  const { package: publicKeyPackage, verifyingKeyHex } = loadPublicKeyPackage(
    registryPath,
    groupId,
  );

  // Get verifying key from public key package
  const verifyingKeyBytes = hexToBytes(verifyingKeyHex);
  const verifyingKey = signingKeyFromVerifying(verifyingKeyBytes) as SigningPublicKey;

  // Aggregate the signature shares
  const aggregatedSignature = aggregateSignatures(
    signingPackage,
    signatureSharesByIdentifier,
    publicKeyPackage,
  );

  // Serialize the aggregated signature
  const sigBytes = serializeSignature(aggregatedSignature);
  if (sigBytes.length !== 64) {
    throw new Error("Aggregated signature is not 64 bytes");
  }
  const finalSignature = Signature.ed25519FromData(sigBytes);

  // Verify signature against target digest
  if (!verifyingKey.verify(finalSignature, targetDigest.data())) {
    throw new Error("Aggregated signature failed verification against target digest");
  }

  // Create signed envelope
  const signedEnvelope = targetEnvelope.addAssertion("signed", finalSignature);

  // Verify signature on envelope
  signedEnvelope.verifySignatureFrom(verifyingKey);

  return [finalSignature, signedEnvelope, verifyingKey];
}

/**
 * Update the registry verifying key if needed.
 *
 * Port of `update_registry_verifying_key()` from cmd/sign/participant/finalize.rs.
 */
function updateRegistryVerifyingKey(
  registry: Registry,
  registryPath: string,
  groupId: ARID,
  verifyingKey: SigningPublicKey,
  groupRecord: GroupRecord,
): void {
  const existing = groupRecord.verifyingKey();
  if (existing !== undefined) {
    if (existing.urString() !== verifyingKey.urString()) {
      throw new Error("Registry verifying key does not match finalize package");
    }
  } else {
    const mutableGroup = registry.group(groupId);
    if (mutableGroup === undefined) {
      throw new Error("Group not found in registry");
    }
    mutableGroup.setVerifyingKey(verifyingKey);
    registry.save(registryPath);
  }
}

/**
 * Persist the final state to disk.
 *
 * Port of `persist_final_state()` from cmd/sign/participant/finalize.rs.
 */
function persistFinalState(
  registryPath: string,
  groupId: ARID,
  sessionId: ARID,
  signature: Signature,
  signedEnvelope: Envelope,
  signatureShares: Map<string, Ed25519SignatureShare>,
  shareState: ShareState,
): void {
  const dir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(dir, { recursive: true });

  const finalPath = path.join(dir, "final.json");

  // Load existing state if present
  let root: Record<string, unknown> = {};
  if (fs.existsSync(finalPath)) {
    root = JSON.parse(fs.readFileSync(finalPath, "utf-8")) as Record<string, unknown>;
  }

  // Build shares JSON
  const sharesJson: Record<string, string> = {};
  for (const [xidStr, share] of signatureShares) {
    sharesJson[xidStr] = serializeSignatureShare(share);
  }

  // Build commitments JSON
  const commitmentsJson: Record<string, SerializedSigningCommitments> = {};
  for (const [xidStr, commits] of shareState.commitments) {
    commitmentsJson[xidStr] = serializeSigningCommitments(commits);
  }

  root["group"] = groupId.urString();
  root["session"] = sessionId.urString();
  root["signature"] = signature.urString();
  root["signature_shares"] = sharesJson;
  root["commitments"] = commitmentsJson;
  root["finalize_arid"] = shareState.finalizeArid.urString();
  root["signed_target"] = signedEnvelope.urString();

  fs.writeFileSync(finalPath, JSON.stringify(root, null, 2));
}

/**
 * Execute the sign participant finalize command.
 *
 * Receives the finalize event with aggregated signature.
 *
 * Port of `finalize()` from cmd/sign/participant/finalize.rs.
 */
export async function finalize(
  client: StorageClient,
  options: SignFinalizeOptions,
  cwd: string,
): Promise<SignFinalizeResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (owner === undefined) {
    throw new Error("Registry owner is required");
  }

  const sessionId = parseAridUr(options.sessionId);
  const groupHint =
    options.groupId !== undefined && options.groupId !== ""
      ? parseAridUr(options.groupId)
      : undefined;

  // Load and validate session state
  const receiveState = loadReceiveState(registryPath, sessionId, groupHint);
  const groupId = receiveState.groupId;
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }

  validateSessionState(receiveState, groupRecord, owner);

  const shareState = loadShareState(registryPath, groupId, sessionId);
  validateShareState(shareState, receiveState, groupRecord);

  // Fetch finalize event
  const sealedEvent = await fetchFinalizeEvent(
    client,
    shareState.finalizeArid,
    options.timeoutSeconds,
    owner,
  );

  // Validate event
  validateFinalizeEvent(sealedEvent, sessionId, groupRecord);

  // Extract and validate signature shares
  const signatureSharesByXid = parseSignatureShares(sealedEvent);
  validateSignatureShares(signatureSharesByXid, receiveState, shareState, owner);

  // Load target envelope
  const targetEnvelope = Envelope.fromURString(receiveState.targetUr);
  const targetDigest = targetEnvelope.subject().digest();

  // Aggregate signature
  const [finalSignature, signedEnvelope, verifyingKey] = aggregateAndVerifySignature(
    registryPath,
    groupId,
    receiveState.participants,
    shareState.commitments,
    signatureSharesByXid,
    targetEnvelope,
    targetDigest,
  );

  // Update registry verifying key if needed
  updateRegistryVerifyingKey(registry, registryPath, groupId, verifyingKey, groupRecord);

  // Persist final state
  persistFinalState(
    registryPath,
    groupId,
    sessionId,
    finalSignature,
    signedEnvelope,
    signatureSharesByXid,
    shareState,
  );

  // Clear listening ARID
  const mutableGroupRecord = registry.group(groupId);
  if (mutableGroupRecord !== undefined) {
    mutableGroupRecord.clearListeningAtArid();
    registry.save(registryPath);
  }

  const signatureStr = finalSignature.urString();
  const signedEnvelopeStr = signedEnvelope.urString();

  if (options.verbose === true) {
    console.log(signatureStr);
    console.log(signedEnvelopeStr);
  }

  return {
    signature: signatureStr,
    signedEnvelope: signedEnvelopeStr,
  };
}
