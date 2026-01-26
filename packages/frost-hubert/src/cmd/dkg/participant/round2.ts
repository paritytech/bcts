/**
 * DKG participant round 2 command.
 *
 * Port of cmd/dkg/participant/round2.rs from frost-hubert-rust.
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
import { parseAridUr } from "../common.js";
import {
  dkgPart2,
  serializeDkgRound2Package,
  identifierFromU16,
  identifierToHex,
  hexToBytes,
  bytesToHex,
  type DkgRound1Package,
  type DkgRound1SecretPackage,
  type DkgRound2SecretPackage,
  type FrostIdentifier,
} from "../../../frost/index.js";
import { Ed25519Sha512, serde } from "@frosts/ed25519";
import { round1, CoefficientCommitment, VerifiableSecretSharingCommitment } from "@frosts/core";

/**
 * Options for the DKG round2 command.
 */
export interface DkgRound2Options {
  registryPath?: string;
  groupId: string;
  timeoutSeconds?: number;
  preview?: boolean;
  storageSelection?: StorageSelection;
  verbose?: boolean;
}

/**
 * Result of the DKG round2 command.
 */
export interface DkgRound2Result {
  listeningArid: string;
  envelopeUr?: string;
}

/**
 * Persisted round 1 state loaded from disk.
 */
interface Round1State {
  secretPackage: DkgRound1SecretPackage;
  ourRound1Package: DkgRound1Package;
}

/**
 * Extracted round 1 packages from coordinator request.
 */
type Round1Packages = [Map<FrostIdentifier, DkgRound1Package>, [XID, DkgRound1Package][]];

/**
 * Load persisted round 1 state from disk.
 *
 * Port of round1_secret loading from cmd/dkg/participant/round2.rs lines 86-97.
 */
function loadRound1State(registryPath: string, groupId: ARID): Round1State {
  const packagesDir = groupStateDir(registryPath, groupId.hex());
  const round1SecretPath = path.join(packagesDir, "round1_secret.json");

  if (!fs.existsSync(round1SecretPath)) {
    throw new Error(
      `Round 1 secret not found at ${round1SecretPath}. Did you respond to the invite?`,
    );
  }

  const secretJson = JSON.parse(fs.readFileSync(round1SecretPath, "utf-8")) as {
    header: { version: number; ciphersuite: string };
    identifier: string;
    coefficients: string[];
    commitment: string[];
    min_signers: number;
    max_signers: number;
  };

  // Deserialize coefficients (scalars)
  const coefficients = secretJson.coefficients.map((hex) =>
    Ed25519Sha512.deserializeScalar(hexToBytes(hex)),
  );

  // Deserialize commitment (coefficient commitments)
  const coefficientCommitments = secretJson.commitment.map((hex) =>
    CoefficientCommitment.deserialize(Ed25519Sha512, hexToBytes(hex)),
  );

  const commitment = new VerifiableSecretSharingCommitment(Ed25519Sha512, coefficientCommitments);

  // Create the secret package
  // Need to find the actual identifier u16 value from the coefficients array length or saved state
  // The identifier is typically serialized as a scalar, but we need the u16 value
  // Parse it from the hex string - first 2 bytes as little-endian u16
  const idBytes = hexToBytes(secretJson.identifier);
  let identifierU16 = 1;
  if (idBytes.length >= 2) {
    identifierU16 = idBytes[0] | (idBytes[1] << 8);
  }
  if (identifierU16 === 0) {
    identifierU16 = 1; // Default to 1 if parsing failed
  }

  const parsedIdentifier = identifierFromU16(identifierU16);

  const secretPackage: DkgRound1SecretPackage = new round1.SecretPackage(
    Ed25519Sha512,
    parsedIdentifier,
    coefficients,
    commitment,
    secretJson.min_signers,
    secretJson.max_signers,
  );

  // Load the round 1 package as well
  const round1PackagePath = path.join(packagesDir, "round1_package.json");
  const packageJson = JSON.parse(fs.readFileSync(round1PackagePath, "utf-8")) as {
    header: { version: number; ciphersuite: string };
    commitment: string[];
    proof_of_knowledge: string;
  };

  const ourRound1Package = serde.round1PackageFromJson(packageJson);

  return { secretPackage, ourRound1Package };
}

/**
 * Validate the round 2 request from the coordinator.
 *
 * Port of request validation from cmd/dkg/participant/round2.rs lines 118-158.
 */
function validateRound2Request(
  sealedRequest: SealedRequest,
  groupId: ARID,
  expectedCoordinator: XID,
): ARID {
  // Validate the request function
  if (!sealedRequest.function().equals(EnvelopeFunction.fromString("dkgRound2"))) {
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
 * Extract round 1 packages from the request and convert to Map<Identifier, Package>.
 *
 * Port of `extract_round1_packages()` from cmd/dkg/participant/round2.rs lines 291-366.
 */
function extractRound1Packages(
  request: SealedRequest,
  groupRecord: GroupRecord,
  ownerXid: XID,
): Round1Packages {
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

  // Extract all round1Package parameters
  const packages = new Map<FrostIdentifier, DkgRound1Package>();
  const packagesByXid: [XID, DkgRound1Package][] = [];

  const packageEnvelopes = request.objectsForParameter("round1Package");
  for (const packageEnvelope of packageEnvelopes) {
    // Extract participant XID from the envelope
    const participantEnvelope = packageEnvelope.objectForPredicate("participant");
    if (participantEnvelope === undefined) {
      throw new Error("round1Package missing participant predicate");
    }
    const participantXid = participantEnvelope.extractSubject((cbor) => XID.fromTaggedCbor(cbor));

    // Skip our own package
    if (participantXid.urString() === myXidStr) {
      continue;
    }

    // Extract the package bytes (stored as JSON tag)
    const packageJson = packageEnvelope.extractSubject((cbor) => JSONWrapper.fromTaggedCbor(cbor));
    const packageData = JSON.parse(new TextDecoder().decode(packageJson.toData())) as {
      header: { version: number; ciphersuite: string };
      commitment: string[];
      proof_of_knowledge: string;
    };

    const pkg = serde.round1PackageFromJson(packageData);

    // Get the identifier for this participant
    const identifier = xidToIdentifier.get(participantXid.urString());
    if (identifier === undefined) {
      throw new Error(`Unknown participant XID in round1Package: ${participantXid.urString()}`);
    }

    packages.set(identifier, pkg);
    packagesByXid.push([participantXid, pkg]);
  }

  // Validate we have the expected number of packages
  const expectedPackages = xidToIdentifier.size - 1; // Exclude ourselves
  if (packages.size !== expectedPackages) {
    throw new Error(`Expected ${expectedPackages} Round 1 packages, found ${packages.size}`);
  }

  return [packages, packagesByXid];
}

/**
 * Build the response body containing Round 2 packages.
 *
 * Port of `build_response_body()` from cmd/dkg/participant/round2.rs lines 373-425.
 */
function buildResponseBody(
  groupId: ARID,
  participantXid: XID,
  responseArid: ARID,
  round2Packages: Map<FrostIdentifier, unknown>,
  groupRecord: GroupRecord,
): Envelope {
  // Build Identifier -> XID mapping
  const sortedXids: XID[] = groupRecord.participants().map((p) => p.xid());

  // Add participant if not already in list
  const participantUrString = participantXid.urString();
  if (!sortedXids.some((xid) => xid.urString() === participantUrString)) {
    sortedXids.push(participantXid);
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

  // Build Identifier -> XID mapping (1-indexed)
  const identifierToXid = new Map<string, XID>();
  for (let i = 0; i < deduped.length; i++) {
    const identifier = identifierFromU16(i + 1);
    identifierToXid.set(identifierToHex(identifier), deduped[i]);
  }

  let envelope = Envelope.unit()
    .addType("dkgRound2Response")
    .addAssertion("group", groupId)
    .addAssertion("participant", participantXid)
    .addAssertion("response_arid", responseArid);

  // Add each Round 2 package with the recipient's XID
  for (const [identifier, pkg] of round2Packages) {
    const idHex = identifierToHex(identifier);
    const recipientXid = identifierToXid.get(idHex);
    if (recipientXid === undefined) {
      throw new Error("Unknown identifier in round2_packages");
    }

    // Serialize package to JSON and wrap in CBOR JSON tag
    const serialized = serializeDkgRound2Package(
      pkg as Parameters<typeof serializeDkgRound2Package>[0],
    );
    const jsonStr = JSON.stringify(serialized);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonWrapper = JSONWrapper.fromData(jsonBytes);

    const packageEnvelope = Envelope.new(jsonWrapper).addAssertion("recipient", recipientXid);

    envelope = envelope.addAssertion("round2Package", packageEnvelope);
  }

  return envelope;
}

/**
 * Serialize round 2 secret package to JSON format for persistence.
 *
 * The format matches what finalize.ts expects to deserialize.
 */
function serializeRound2SecretPackage(
  secret: DkgRound2SecretPackage,
  participantIndex: number,
): Record<string, unknown> {
  // Get the commitment coefficients
  const commitment = secret.commitment;
  const commitmentCoefficients = commitment.serialize().map((c: Uint8Array) => bytesToHex(c));

  // Serialize the secret share
  const secretShare = bytesToHex(Ed25519Sha512.serializeScalar(secret.secretShare()));

  return {
    identifier: participantIndex,
    commitment: {
      coefficients: commitmentCoefficients,
    },
    secretShare,
    minSigners: secret.minSigners,
    maxSigners: secret.maxSigners,
  };
}

/**
 * Persist round 2 state to disk.
 *
 * Port of round 2 secret persistence from cmd/dkg/participant/round2.rs lines 229-251.
 */
function persistRound2State(
  registryPath: string,
  groupId: ARID,
  round2Secret: DkgRound2SecretPackage,
  round1PackagesByXid: [XID, DkgRound1Package][],
  participantIndex: number,
): string {
  const packagesDir = groupStateDir(registryPath, groupId.hex());
  fs.mkdirSync(packagesDir, { recursive: true });

  // Persist Round 2 secret
  const round2SecretPath = path.join(packagesDir, "round2_secret.json");
  const round2SecretJson = serializeRound2SecretPackage(round2Secret, participantIndex);
  fs.writeFileSync(round2SecretPath, JSON.stringify(round2SecretJson, null, 2));

  // Persist received Round 1 packages for finalize phase
  const round1PackagesPath = path.join(packagesDir, "collected_round1.json");
  const round1Json: Record<string, unknown> = {};
  for (const [xid, pkg] of round1PackagesByXid) {
    const packageJson = serde.round1PackageToJson(pkg);
    round1Json[xid.urString()] = packageJson;
  }
  fs.writeFileSync(round1PackagesPath, JSON.stringify(round1Json, null, 2));

  return round2SecretPath;
}

/**
 * Execute the DKG participant round 2 command.
 *
 * Responds to the Round 2 request from the coordinator, runs FROST DKG part2
 * to generate Round 2 packages, and posts the response back.
 *
 * Port of `CommandArgs::exec()` from cmd/dkg/participant/round2.rs lines 55-288.
 */
export async function round2(
  _client: StorageClient | undefined,
  options: DkgRound2Options,
  cwd: string,
): Promise<DkgRound2Result> {
  if (options.storageSelection === undefined) {
    throw new Error("Hubert storage is required for round2");
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

  // Get the ARID where we're listening for the Round 2 request
  const listeningAtArid = groupRecord.listeningAtArid();
  if (listeningAtArid === undefined) {
    throw new Error("No listening ARID for this group. Did you respond to the invite?");
  }

  // Load our Round 1 secret
  const round1State = loadRound1State(registryPath, groupId);

  if (isVerbose() || options.verbose === true) {
    console.error("Fetching Round 2 request from Hubert...");
  }

  const client = await createStorageClient(options.storageSelection);

  // Fetch the Round 2 request from where we're listening
  const requestEnvelope = await getWithIndicator(
    client,
    listeningAtArid,
    "Round 2 request",
    options.timeoutSeconds,
    options.verbose ?? false,
  );

  if (requestEnvelope === null || requestEnvelope === undefined) {
    throw new Error("Round 2 request not found in Hubert storage");
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
  const responseArid = validateRound2Request(sealedRequest, groupId, expectedCoordinator);

  // Extract Round 1 packages from the request
  const [round1Packages, round1PackagesByXid] = extractRound1Packages(
    sealedRequest,
    groupRecord,
    owner.xid(),
  );

  if (isVerbose() || options.verbose === true) {
    console.error(`Received ${round1Packages.size} Round 1 packages. Running DKG part2...`);
  }

  // Allocate next response ARID for the finalize phase
  const nextResponseArid = ARID.new();

  // Run FROST DKG part2
  // Convert Map<Identifier, Package> to Map<string, Package> for dkgPart2
  const round1PackagesHex = new Map<string, DkgRound1Package>();
  for (const [id, pkg] of round1Packages) {
    round1PackagesHex.set(identifierToHex(id), pkg);
  }

  const [round2Secret, round2Packages] = dkgPart2(round1State.secretPackage, round1PackagesHex);

  if (isVerbose() || options.verbose === true) {
    console.error(`Generated ${round2Packages.size} Round 2 packages.`);
  }

  // Convert round2Packages back to use Identifier keys for buildResponseBody
  const round2PackagesById = new Map<FrostIdentifier, unknown>();
  for (const [idHex, pkg] of round2Packages) {
    // Find the identifier that matches this hex
    for (const [id] of round1Packages) {
      if (identifierToHex(id) === idHex) {
        round2PackagesById.set(id, pkg);
        break;
      }
    }
  }

  // Build response with Round 2 packages
  const responseBody = buildResponseBody(
    groupId,
    owner.xid(),
    nextResponseArid,
    round2PackagesById,
    groupRecord,
  );

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
    const unsealedEnvelope = sealed.toEnvelope(
      undefined, // No expiration for responses
      signerPrivateKeys,
      undefined,
    );
    const envelopeUr = unsealedEnvelope.urString();
    console.log(envelopeUr);

    return {
      listeningArid: nextResponseArid.urString(),
      envelopeUr,
    };
  }

  // Calculate participant index for serialization
  // Sort participants by XID to find our position
  const sortedXids = groupRecord.participants().map((p) => p.xid().urString());
  const ownerXidStr = owner.xid().urString();
  if (!sortedXids.includes(ownerXidStr)) {
    sortedXids.push(ownerXidStr);
  }
  sortedXids.sort();
  const participantIndex = sortedXids.indexOf(ownerXidStr) + 1; // 1-indexed

  // Persist Round 2 secret and collected round1 packages
  const round2SecretPath = persistRound2State(
    registryPath,
    groupId,
    round2Secret,
    round1PackagesByXid,
    participantIndex,
  );

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
    "Round 2 Response",
    options.verbose ?? false,
  );

  // Update contributions in registry
  const updatedGroupRecord = registry.group(groupId);
  if (updatedGroupRecord !== undefined) {
    const contributions = updatedGroupRecord.contributions();
    contributions.round2Secret = round2SecretPath;
    updatedGroupRecord.setContributions(contributions);
    // Set new listening ARID for finalize phase
    updatedGroupRecord.setListeningAtArid(nextResponseArid);
    registry.save(registryPath);
  }

  if (isVerbose() || options.verbose === true) {
    console.error(`Posted Round 2 response to ${responseArid.urString()}`);
  }

  return {
    listeningArid: nextResponseArid.urString(),
  };
}
