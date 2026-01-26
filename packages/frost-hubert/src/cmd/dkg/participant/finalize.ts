/**
 * DKG participant finalize command.
 *
 * Port of cmd/dkg/participant/finalize.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, JSON as JSONWrapper, XID } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { Envelope, Function as EnvelopeFunction } from "@bcts/envelope";
import { SealedRequest, SealedResponse } from "@bcts/gstp";
import type { XIDDocument } from "@bcts/xid";

import { type GroupRecord, Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator, putWithIndicator } from "../../busy.js";
import { groupStateDir, isVerbose } from "../../common.js";
import { createStorageClient, type StorageClient, type StorageSelection } from "../../storage.js";
import { parseAridUr, signingKeyFromVerifying } from "../common.js";
import {
  dkgPart3,
  identifierFromU16,
  identifierToHex,
  hexToBytes,
  bytesToHex,
  serializeKeyPackage,
  serializePublicKeyPackage,
  type DkgRound1Package,
  type DkgRound2Package,
  type DkgRound2SecretPackage,
  type FrostIdentifier,
  type FrostKeyPackage,
  type FrostPublicKeyPackage,
} from "../../../frost/index.js";
import { Ed25519Sha512, serde } from "@frosts/ed25519";
import { round2, CoefficientCommitment, VerifiableSecretSharingCommitment } from "@frosts/core";

/**
 * Options for the DKG finalize command.
 */
export interface DkgFinalizeOptions {
  registryPath?: string;
  groupId: string;
  timeoutSeconds?: number;
  preview?: boolean;
  storageSelection?: StorageSelection;
  verbose?: boolean;
}

/**
 * Result of the DKG finalize command.
 */
export interface DkgFinalizeResult {
  verifyingKey: string;
  keyPackagePath: string;
  publicKeyPackagePath: string;
}

/**
 * Persisted round 2 state loaded from disk.
 */
interface Round2State {
  secretPackage: DkgRound2SecretPackage;
  round1Packages: Map<string, DkgRound1Package>;
}

/**
 * Load persisted round 2 state from disk.
 *
 * Port of round2_secret loading from cmd/dkg/participant/finalize.rs lines 82-106.
 */
function loadRound2State(registryPath: string, groupId: ARID): Round2State {
  const stateDir = groupStateDir(registryPath, groupId.hex());

  // Load Round 2 secret
  const round2SecretPath = path.join(stateDir, "round2_secret.json");
  if (!fs.existsSync(round2SecretPath)) {
    throw new Error(`Round 2 secret not found at ${round2SecretPath}. Did you run round2?`);
  }

  const secretJson = JSON.parse(fs.readFileSync(round2SecretPath, "utf-8")) as {
    identifier: number;
    commitment: {
      coefficients: string[];
    };
    secretShare: string;
    minSigners: number;
    maxSigners: number;
  };

  // Reconstruct the round 2 secret package
  const identifier = identifierFromU16(secretJson.identifier);

  const coefficientCommitments = secretJson.commitment.coefficients.map((hex) =>
    CoefficientCommitment.deserialize(Ed25519Sha512, hexToBytes(hex)),
  );

  const commitment = new VerifiableSecretSharingCommitment(Ed25519Sha512, coefficientCommitments);

  const secretShareScalar = Ed25519Sha512.deserializeScalar(hexToBytes(secretJson.secretShare));

  const secretPackage: DkgRound2SecretPackage = new round2.SecretPackage(
    Ed25519Sha512,
    identifier,
    commitment,
    secretShareScalar,
    secretJson.minSigners,
    secretJson.maxSigners,
  );

  // Load collected Round 1 packages (from round2 phase)
  const round1Path = path.join(stateDir, "collected_round1.json");
  if (!fs.existsSync(round1Path)) {
    throw new Error(`Round 1 packages not found at ${round1Path}. Did you receive earlier phases?`);
  }

  const round1Json = JSON.parse(fs.readFileSync(round1Path, "utf-8")) as Record<string, unknown>;

  // Convert to Map<string, DkgRound1Package> - keyed by XID UR string
  const round1Packages = new Map<string, DkgRound1Package>();
  for (const [xidStr, value] of Object.entries(round1Json)) {
    const packageJson = value as {
      header: { version: number; ciphersuite: string };
      commitment: string[];
      proof_of_knowledge: string;
    };
    const pkg = serde.round1PackageFromJson(packageJson);
    round1Packages.set(xidStr, pkg);
  }

  return { secretPackage, round1Packages };
}

/**
 * Validate the finalize request from the coordinator.
 *
 * Port of request validation from cmd/dkg/participant/finalize.rs lines 139-161.
 */
function validateFinalizeRequest(
  sealedRequest: SealedRequest,
  groupId: ARID,
  expectedCoordinator: XID,
): ARID {
  // Validate the request function
  if (!sealedRequest.function().equals(EnvelopeFunction.fromString("dkgFinalize"))) {
    throw new Error(`Unexpected request function: ${sealedRequest.function().toString()}`);
  }

  // Validate the sender is the expected coordinator
  if (sealedRequest.sender().xid().urString() !== expectedCoordinator.urString()) {
    throw new Error(
      `Unexpected request sender: ${sealedRequest.sender().xid().urString()} ` +
        `(expected coordinator ${expectedCoordinator.urString()})`,
    );
  }

  // Validate the group ID matches
  const requestGroupIdEnvelope = sealedRequest.objectForParameter("group");
  if (requestGroupIdEnvelope === undefined) {
    throw new Error("Request missing group parameter");
  }
  const requestGroupId = requestGroupIdEnvelope.extractSubject((cbor) => ARID.fromTaggedCbor(cbor));
  if (requestGroupId.urString() !== groupId.urString()) {
    throw new Error(
      `Request group ID ${requestGroupId.urString()} does not match expected ${groupId.urString()}`,
    );
  }

  // Extract where we should post our response
  const responseAridEnvelope = sealedRequest.objectForParameter("responseArid");
  if (responseAridEnvelope === undefined) {
    throw new Error("Request missing responseArid parameter");
  }
  const responseArid = responseAridEnvelope.extractSubject((cbor) => ARID.fromTaggedCbor(cbor));

  return responseArid;
}

/**
 * Extract round 2 packages from the finalize request.
 *
 * Port of round2 package extraction from cmd/dkg/participant/finalize.rs lines 209-229.
 */
function extractFinalizePackages(
  request: SealedRequest,
  groupRecord: GroupRecord,
  ownerXid: XID,
): Map<string, DkgRound2Package> {
  // Build XID -> Identifier mapping based on sorted participant order
  const sortedXids: XID[] = groupRecord.participants().map((p) => p.xid());

  // Add owner if not already in list
  const ownerUrString = ownerXid.urString();
  if (!sortedXids.some((xid) => xid.urString() === ownerUrString)) {
    sortedXids.push(ownerXid);
  }

  // Sort by XID UR string
  sortedXids.sort((a, b) => a.urString().localeCompare(b.urString()));

  // Deduplicate
  const deduped: XID[] = [];
  for (const xid of sortedXids) {
    if (deduped.length === 0 || deduped[deduped.length - 1].urString() !== xid.urString()) {
      deduped.push(xid);
    }
  }

  // Build XID -> Identifier mapping (1-indexed)
  const xidToIdentifier = new Map<string, FrostIdentifier>();
  for (let i = 0; i < deduped.length; i++) {
    const identifier = identifierFromU16(i + 1);
    xidToIdentifier.set(deduped[i].urString(), identifier);
  }

  const myXidStr = ownerXid.urString();

  // Extract all round2Package parameters
  const packages = new Map<string, DkgRound2Package>();

  const packageEnvelopes = request.objectsForParameter("round2Package");
  for (const packageEnvelope of packageEnvelopes) {
    // Extract sender XID from the envelope
    const senderEnvelope = packageEnvelope.objectForPredicate("sender");
    if (senderEnvelope === undefined) {
      throw new Error("round2Package missing sender predicate");
    }
    const senderXid = senderEnvelope.extractSubject((cbor) => XID.fromTaggedCbor(cbor));

    // Skip our own package
    if (senderXid.urString() === myXidStr) {
      continue;
    }

    // Get the identifier for this sender
    const identifier = xidToIdentifier.get(senderXid.urString());
    if (identifier === undefined) {
      throw new Error(`Unknown sender XID in round2Package: ${senderXid.urString()}`);
    }

    // Extract the package bytes (stored as JSON tag)
    const packageJson = packageEnvelope.extractSubject((cbor) => JSONWrapper.fromTaggedCbor(cbor));
    const packageData = JSON.parse(new TextDecoder().decode(packageJson.toData())) as {
      header: { version: number; ciphersuite: string };
      signing_share: string;
    };

    const pkg = serde.round2PackageFromJson(packageData);
    packages.set(identifierToHex(identifier), pkg);
  }

  return packages;
}

/**
 * Build the response body for the finalize response.
 *
 * Port of `build_response_body()` from cmd/dkg/participant/finalize.rs lines 344-359.
 */
function buildResponseBody(
  groupId: ARID,
  participantXid: XID,
  keyPackage: FrostKeyPackage,
  publicKeyPackage: FrostPublicKeyPackage,
): Envelope {
  // Serialize key packages to JSON
  const keyPackageJson = serializeKeyPackage(keyPackage);
  const publicKeyPackageJson = serializePublicKeyPackage(publicKeyPackage);

  const keyJsonBytes = new TextEncoder().encode(JSON.stringify(keyPackageJson));
  const keyJsonWrapper = JSONWrapper.fromData(keyJsonBytes);

  const pubJsonBytes = new TextEncoder().encode(JSON.stringify(publicKeyPackageJson));
  const pubJsonWrapper = JSONWrapper.fromData(pubJsonBytes);

  return Envelope.unit()
    .addType("dkgFinalizeResponse")
    .addAssertion("group", groupId)
    .addAssertion("participant", participantXid)
    .addAssertion("key_package", keyJsonWrapper)
    .addAssertion("public_key_package", pubJsonWrapper);
}

/**
 * Persist finalize state (key packages) to disk.
 *
 * Port of key package persistence from cmd/dkg/participant/finalize.rs lines 251-257.
 */
function persistFinalizeState(
  registryPath: string,
  groupId: ARID,
  keyPackage: FrostKeyPackage,
  publicKeyPackage: FrostPublicKeyPackage,
): { keyPackagePath: string; publicKeyPackagePath: string } {
  const stateDir = groupStateDir(registryPath, groupId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  // Serialize and save key package
  const serializedKeyPackage = serializeKeyPackage(keyPackage);
  const keyPackagePath = path.join(stateDir, "key_package.json");
  fs.writeFileSync(keyPackagePath, JSON.stringify(serializedKeyPackage, null, 2));

  // Serialize and save public key package
  const serializedPublicKeyPackage = serializePublicKeyPackage(publicKeyPackage);
  const publicKeyPackagePath = path.join(stateDir, "public_key_package.json");
  fs.writeFileSync(publicKeyPackagePath, JSON.stringify(serializedPublicKeyPackage, null, 2));

  return { keyPackagePath, publicKeyPackagePath };
}

/**
 * Execute the DKG participant finalize command.
 *
 * Responds to the finalize request from the coordinator, runs FROST DKG part3
 * to generate the final key package, and posts the response back.
 *
 * Port of `CommandArgs::exec()` from cmd/dkg/participant/finalize.rs lines 52-341.
 */
export async function finalize(
  _client: StorageClient | undefined,
  options: DkgFinalizeOptions,
  cwd: string,
): Promise<DkgFinalizeResult> {
  if (options.storageSelection === undefined) {
    throw new Error("Hubert storage is required for finalize respond");
  }

  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (owner === undefined) {
    throw new Error("Registry owner is required");
  }

  const groupId = parseAridUr(options.groupId);
  const groupRecord = registry.group(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }

  // Get the ARID where we're listening for the finalize request
  const listeningAtArid = groupRecord.listeningAtArid();
  if (listeningAtArid === undefined) {
    throw new Error("No listening ARID for this group. Did you receive finalize send?");
  }

  // Load Round 2 state (secret and collected round1 packages)
  const round2State = loadRound2State(registryPath, groupId);

  if (isVerbose() || options.verbose === true) {
    console.error("Fetching finalize request from Hubert...");
  }

  const client = await createStorageClient(options.storageSelection);

  // Fetch the finalize request from where we're listening
  const requestEnvelope = await getWithIndicator(
    client,
    listeningAtArid,
    "Finalize request",
    options.timeoutSeconds,
    options.verbose ?? false,
  );

  if (requestEnvelope === null || requestEnvelope === undefined) {
    throw new Error("Finalize request not found in Hubert storage");
  }

  // Decrypt and validate the request
  const ownerPrivateKeys = owner.xidDocument().inceptionPrivateKeys();
  if (ownerPrivateKeys === undefined) {
    throw new Error("Owner XID document has no private keys");
  }

  const now = CborDate.now().datetime();
  const sealedRequest = SealedRequest.tryFromEnvelope(
    requestEnvelope,
    undefined,
    now,
    ownerPrivateKeys,
  );

  // Validate the request and extract response ARID
  const expectedCoordinator = groupRecord.coordinator().xid();
  const responseArid = validateFinalizeRequest(sealedRequest, groupId, expectedCoordinator);

  // Build identifier mapping for round1 packages (XID UR -> Identifier hex)
  const sortedXids: XID[] = groupRecord.participants().map((p) => p.xid());

  // Add owner if not already in list
  const ownerUrString = owner.xid().urString();
  if (!sortedXids.some((xid) => xid.urString() === ownerUrString)) {
    sortedXids.push(owner.xid());
  }

  // Sort by XID UR string
  sortedXids.sort((a, b) => a.urString().localeCompare(b.urString()));

  // Deduplicate
  const deduped: XID[] = [];
  for (const xid of sortedXids) {
    if (deduped.length === 0 || deduped[deduped.length - 1].urString() !== xid.urString()) {
      deduped.push(xid);
    }
  }

  // Build XID -> Identifier mapping (1-indexed)
  const xidToIdentifier = new Map<string, FrostIdentifier>();
  for (let i = 0; i < deduped.length; i++) {
    const identifier = identifierFromU16(i + 1);
    xidToIdentifier.set(deduped[i].urString(), identifier);
  }

  // Convert round1 packages from XID-keyed to identifier-keyed (exclude self)
  const round1PackagesById = new Map<string, DkgRound1Package>();
  for (const [xidStr, pkg] of round2State.round1Packages) {
    if (xidStr === ownerUrString) {
      continue;
    }
    const identifier = xidToIdentifier.get(xidStr);
    if (identifier === undefined) {
      throw new Error(`Unknown participant XID ${xidStr}`);
    }
    round1PackagesById.set(identifierToHex(identifier), pkg);
  }

  // Extract Round 2 packages from the request (exclude self)
  const round2PackagesById = extractFinalizePackages(sealedRequest, groupRecord, owner.xid());

  if (isVerbose() || options.verbose === true) {
    console.error(`Received ${round2PackagesById.size} Round 2 packages. Running DKG part3...`);
  }

  // Run FROST DKG part3 (finalize)
  const [keyPackage, publicKeyPackage] = await dkgPart3(
    round2State.secretPackage,
    round1PackagesById,
    round2PackagesById,
  );

  // Get the group verifying key
  const verifyingKeyBytes = publicKeyPackage.verifyingKey as Uint8Array;
  const groupVerifyingKey = signingKeyFromVerifying(verifyingKeyBytes);

  if (isVerbose() || options.verbose === true) {
    console.error("Generated key package and public key package.");
  }

  // Persist key packages
  const { keyPackagePath, publicKeyPackagePath } = persistFinalizeState(
    registryPath,
    groupId,
    keyPackage,
    publicKeyPackage,
  );

  // Build response body
  const responseBody = buildResponseBody(groupId, owner.xid(), keyPackage, publicKeyPackage);

  const signerPrivateKeys = owner.xidDocument().inceptionPrivateKeys();
  if (signerPrivateKeys === undefined) {
    throw new Error("Owner XID document has no signing keys");
  }

  // Get coordinator's XID document for encryption
  const coordinatorXid = groupRecord.coordinator().xid();
  const coordinatorRecord = registry.participant(coordinatorXid);
  let coordinatorDoc: XIDDocument;
  if (coordinatorRecord !== undefined) {
    coordinatorDoc = coordinatorRecord.xidDocument();
  } else {
    // Check if coordinator is the owner
    if (owner.xid().urString() === coordinatorXid.urString()) {
      coordinatorDoc = owner.xidDocument();
    } else {
      throw new Error(`Coordinator ${coordinatorXid.urString()} not found in registry`);
    }
  }

  // Get peer continuation from the request
  const peerContinuation = sealedRequest.peerContinuation();

  let sealed = SealedResponse.newSuccess(sealedRequest.id(), owner.xidDocument()).withResult(
    responseBody,
  );

  if (peerContinuation !== undefined) {
    sealed = sealed.withPeerContinuation(peerContinuation);
  }

  if (options.preview === true) {
    // Show the response envelope structure without encryption
    if (isVerbose() || options.verbose === true) {
      // Cast to access urString method
      const verifyingKeyWithUrString = groupVerifyingKey as { urString?: () => string };
      if (typeof verifyingKeyWithUrString.urString === "function") {
        console.error(verifyingKeyWithUrString.urString());
      }
    }
    const unsealedEnvelope = sealed.toEnvelope(
      undefined, // No expiration for responses
      signerPrivateKeys,
      undefined,
    );
    console.log(unsealedEnvelope.urString());

    return {
      verifyingKey: bytesToHex(verifyingKeyBytes),
      keyPackagePath,
      publicKeyPackagePath,
    };
  }

  const responseEnvelope = sealed.toEnvelope(
    undefined, // No expiration for responses
    signerPrivateKeys,
    coordinatorDoc,
  );

  // Post the response
  await putWithIndicator(
    client,
    responseArid,
    responseEnvelope,
    "Finalize Response",
    options.verbose ?? false,
  );

  // Update registry: contributions and verifying key
  const updatedGroupRecord = registry.group(groupId);
  if (updatedGroupRecord !== undefined) {
    const contributions = updatedGroupRecord.contributions();
    contributions.keyPackage = keyPackagePath;
    updatedGroupRecord.setContributions(contributions);
    updatedGroupRecord.clearListeningAtArid();

    // Set verifying key if the method exists
    const recordWithVerifyingKey = updatedGroupRecord as {
      setVerifyingKey?: (key: unknown) => void;
    };
    if (typeof recordWithVerifyingKey.setVerifyingKey === "function") {
      recordWithVerifyingKey.setVerifyingKey(groupVerifyingKey);
    }

    registry.save(registryPath);
  }

  // Get verifying key for output
  const verifyingKeyHex = bytesToHex(verifyingKeyBytes);

  if (isVerbose() || options.verbose === true) {
    console.error(`Posted finalize response to ${responseArid.urString()}`);
    // Cast to access urString method
    const verifyingKeyWithUrString = groupVerifyingKey as { urString?: () => string };
    if (typeof verifyingKeyWithUrString.urString === "function") {
      console.error(verifyingKeyWithUrString.urString());
    }
  } else {
    // Cast to access urString method
    const verifyingKeyWithUrString = groupVerifyingKey as { urString?: () => string };
    if (typeof verifyingKeyWithUrString.urString === "function") {
      console.log(verifyingKeyWithUrString.urString());
    }
  }

  return {
    verifyingKey: verifyingKeyHex,
    keyPackagePath,
    publicKeyPackagePath,
  };
}
