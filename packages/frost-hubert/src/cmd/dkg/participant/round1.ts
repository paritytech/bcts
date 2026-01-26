/**
 * DKG participant round 1 command.
 *
 * Port of cmd/dkg/participant/round1.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, JSON as JSONWrapper, XID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { SealedResponse } from "@bcts/gstp";
import type { XIDDocument } from "@bcts/xid";

import {
  ContributionPaths,
  GroupRecord,
  Registry,
  resolveRegistryPath,
} from "../../../registry/index.js";
import { getWithIndicator, putWithIndicator } from "../../busy.js";
import { createStorageClient, type StorageClient, type StorageSelection } from "../../storage.js";
import { groupStateDir } from "../../common.js";
import {
  buildGroupParticipants,
  groupParticipantFromRegistry,
  parseAridUr,
  parseEnvelopeUr,
} from "../common.js";
import {
  dkgPart1,
  identifierFromU16,
  createRng,
  bytesToHex,
  type DkgRound1Package,
  type DkgRound1SecretPackage,
} from "../../../frost/index.js";
import { Ed25519Sha512, serde } from "@frosts/ed25519";
import { decodeInviteDetails } from "./receive.js";
import { CborDate } from "@bcts/dcbor";

/**
 * Options for the DKG round1 command.
 */
export interface DkgRound1Options {
  registryPath?: string;
  timeoutSeconds?: number;
  responseArid?: string;
  preview?: boolean;
  rejectReason?: string;
  sender?: string;
  invite: string;
  storageSelection?: StorageSelection;
  verbose?: boolean;
}

/**
 * Result of the DKG round1 command.
 */
export interface DkgRound1Result {
  accepted: boolean;
  listeningArid?: string;
  envelopeUr?: string;
}

/**
 * Resolve an invite envelope from either storage (ARID) or direct UR.
 *
 * Port of `resolve_invite_envelope()` from cmd/dkg/participant/round1.rs lines 256-288.
 */
async function resolveInviteEnvelope(
  selection: StorageSelection | undefined,
  invite: string,
  timeout?: number,
): Promise<Envelope> {
  if (selection !== undefined) {
    // Try to parse as ARID
    try {
      const arid = parseAridUr(invite);
      const client = await createStorageClient(selection);
      const envelope = await getWithIndicator(client, arid, "Invite", timeout, false);
      if (envelope === null || envelope === undefined) {
        throw new Error("Invite not found in Hubert storage");
      }
      return envelope;
    } catch (e) {
      // Not an ARID, fall through to envelope parsing
      if (e instanceof Error && e.message.includes("Invite not found in Hubert storage")) {
        throw e;
      }
    }

    if (timeout !== undefined) {
      throw new Error("--timeout is only valid when retrieving invites from Hubert");
    }

    return parseEnvelopeUr(invite);
  }

  // No storage selection
  try {
    parseAridUr(invite);
    throw new Error("Hubert storage parameters are required to retrieve invites by ARID");
  } catch (e) {
    // Not an ARID, parse as envelope
    if (e instanceof Error && e.message.includes("Hubert storage parameters are required")) {
      throw e;
    }
  }

  return parseEnvelopeUr(invite);
}

/**
 * Build the response body envelope.
 *
 * Port of `build_response_body()` from cmd/dkg/participant/round1.rs lines 290-308.
 */
function buildResponseBody(
  groupId: ARID,
  participant: XID,
  responseArid: ARID,
  round1Package: DkgRound1Package | undefined,
): Envelope {
  let envelope = Envelope.unit()
    .addType("dkgRound1Response")
    .addAssertion("group", groupId)
    .addAssertion("participant", participant)
    .addAssertion("response_arid", responseArid);

  if (round1Package !== undefined) {
    // Serialize the package to JSON and wrap as CBOR JSON
    const packageJson = serde.round1PackageToJson(round1Package);
    const jsonStr = globalThis.JSON.stringify(packageJson);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonWrapper = JSONWrapper.fromData(jsonBytes);
    // Pass the JSONWrapper directly - it implements CborTaggedEncodable
    envelope = envelope.addAssertion("round1_package", jsonWrapper);
  }

  return envelope;
}

/**
 * Serialize round 1 secret package to JSON-compatible format.
 *
 * The @frosts/ed25519 serde module doesn't provide a serializer for SecretPackage,
 * so we manually serialize it here.
 */
function serializeRound1SecretPackage(secret: DkgRound1SecretPackage): Record<string, unknown> {
  // Access the coefficients and serialize them
  const coefficients = secret.coefficients();
  const serializedCoefficients = coefficients.map((c: unknown) =>
    bytesToHex(
      Ed25519Sha512.serializeScalar(c as Parameters<typeof Ed25519Sha512.serializeScalar>[0]),
    ),
  );

  // Get the commitment coefficients
  const commitment = secret.commitment;
  const commitmentCoefficients = commitment.serialize().map((c: Uint8Array) => bytesToHex(c));

  return {
    header: serde.DEFAULT_HEADER,
    identifier: bytesToHex(secret.identifier.serialize()),
    coefficients: serializedCoefficients,
    commitment: commitmentCoefficients,
    min_signers: secret.minSigners,
    max_signers: secret.maxSigners,
  };
}

/**
 * Persist round 1 state to disk.
 *
 * Port of `persist_round1_state()` from cmd/dkg/participant/round1.rs lines 310-337.
 */
function persistRound1State(
  registryPath: string,
  groupId: ARID,
  round1Secret: DkgRound1SecretPackage,
  round1Package: DkgRound1Package,
): ContributionPaths {
  const dir = groupStateDir(registryPath, groupId.hex());
  fs.mkdirSync(dir, { recursive: true });

  const secretPath = path.join(dir, "round1_secret.json");
  const packagePath = path.join(dir, "round1_package.json");

  // Serialize the secret package manually since serde doesn't provide it
  const secretJson = serializeRound1SecretPackage(round1Secret);
  // Serialize the public package using the standard serde function
  const packageJson = serde.round1PackageToJson(round1Package);

  fs.writeFileSync(secretPath, globalThis.JSON.stringify(secretJson, null, 2));
  fs.writeFileSync(packagePath, globalThis.JSON.stringify(packageJson, null, 2));

  return new ContributionPaths({
    round1Secret: secretPath,
    round1Package: packagePath,
    round2Secret: undefined,
    keyPackage: undefined,
  });
}

/**
 * Execute the DKG participant round 1 command.
 *
 * Responds to the DKG invite with commitment packages.
 *
 * Port of `CommandArgs::exec()` from cmd/dkg/participant/round1.rs lines 66-254.
 */
export async function round1(
  _client: StorageClient | undefined,
  options: DkgRound1Options,
  cwd: string,
): Promise<DkgRound1Result> {
  // Validate options
  if (options.storageSelection === undefined && options.timeoutSeconds !== undefined) {
    throw new Error("--timeout requires Hubert storage parameters");
  }
  if (options.storageSelection !== undefined && options.preview === true) {
    throw new Error("--preview cannot be used with Hubert storage options");
  }

  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (!owner) {
    throw new Error("Registry owner with private keys is required");
  }

  // Resolve expected sender if provided
  let expectedSender: XIDDocument | undefined;
  if (options.sender !== undefined) {
    expectedSender = resolveSenderXidDocument(registry, options.sender);
  }

  const nextResponseArid =
    options.responseArid !== undefined ? parseAridUr(options.responseArid) : ARID.new();

  // Resolve the invite envelope
  const inviteEnvelope = await resolveInviteEnvelope(
    options.storageSelection,
    options.invite,
    options.timeoutSeconds,
  );

  // Decode the invite details
  const now = CborDate.now().datetime();
  const details = decodeInviteDetails(
    inviteEnvelope,
    now,
    registry,
    owner.xidDocument(),
    expectedSender,
  );

  // Sort participants by XID and find our position
  const sortedParticipants = [...details.participants].sort((a, b) =>
    a.xid().urString().localeCompare(b.xid().urString()),
  );

  const ownerIndex = sortedParticipants.findIndex(
    (doc) => doc.xid().urString() === owner.xid().urString(),
  );
  if (ownerIndex === -1) {
    throw new Error("Invite does not include the registry owner");
  }

  const identifierIndex = ownerIndex + 1; // FROST uses 1-indexed identifiers
  if (identifierIndex > 65535) {
    throw new Error("Too many participants for identifiers");
  }
  const identifier = identifierFromU16(identifierIndex);

  const total = sortedParticipants.length;
  if (total > 65535) {
    throw new Error("Too many participants for FROST identifiers");
  }

  const minSigners = details.invitation.minSigners();
  if (minSigners > 65535) {
    throw new Error("min_signers does not fit into identifier space");
  }

  // Build group participants for the registry
  const groupParticipants = buildGroupParticipants(registry, owner, sortedParticipants);
  const coordinator = groupParticipantFromRegistry(registry, owner, details.invitation.sender());

  // Check if we're posting to storage
  const isPosting = options.storageSelection !== undefined;

  // Build the response body
  let responseBody: Envelope;
  let contributions: ContributionPaths | undefined;

  if (options.rejectReason === undefined && isPosting) {
    // Actually posting - generate and persist round1 state
    const [round1Secret, round1Package] = dkgPart1(identifier, total, minSigners, createRng());

    contributions = persistRound1State(
      registryPath,
      details.invitation.groupId(),
      round1Secret,
      round1Package,
    );

    responseBody = buildResponseBody(
      details.invitation.groupId(),
      owner.xid(),
      nextResponseArid,
      round1Package,
    );

    // Create and save group record
    const groupRecord = new GroupRecord(
      details.invitation.charter(),
      details.invitation.minSigners(),
      coordinator,
      groupParticipants,
    );
    groupRecord.setContributions(contributions);
    groupRecord.setListeningAtArid(nextResponseArid);

    registry.recordGroup(details.invitation.groupId(), groupRecord);
    registry.save(registryPath);
  } else if (options.rejectReason === undefined) {
    // Preview mode - generate dummy round1 for envelope structure only
    const [, round1Package] = dkgPart1(identifier, total, minSigners, createRng());

    responseBody = buildResponseBody(
      details.invitation.groupId(),
      owner.xid(),
      nextResponseArid,
      round1Package,
    );
  } else {
    // Rejecting - no round1 needed
    responseBody = buildResponseBody(
      details.invitation.groupId(),
      owner.xid(),
      nextResponseArid,
      undefined,
    );
  }

  // Build the sealed response
  const signerPrivateKeys = owner.xidDocument().inceptionPrivateKeys();
  if (signerPrivateKeys === undefined) {
    throw new Error("Owner XID document has no signing keys");
  }

  let sealed: SealedResponse;
  if (options.rejectReason !== undefined) {
    // Build rejection error body
    const errorBody = Envelope.new("dkgInviteReject")
      .addAssertion("group", details.invitation.groupId())
      .addAssertion("response_arid", nextResponseArid)
      .addAssertion("reason", options.rejectReason);

    sealed = SealedResponse.newFailure(details.invitation.requestId(), owner.xidDocument())
      .withError(errorBody)
      .withState(nextResponseArid);
  } else {
    sealed = SealedResponse.newSuccess(details.invitation.requestId(), owner.xidDocument())
      .withResult(responseBody)
      .withState(nextResponseArid);
  }

  // Add peer continuation if present
  const peerContinuation = details.invitation.peerContinuation();
  if (peerContinuation !== undefined) {
    sealed = sealed.withPeerContinuation(peerContinuation);
  }

  // Handle output based on storage selection
  if (options.storageSelection !== undefined) {
    const responseEnvelope = sealed.toEnvelope(
      details.invitation.validUntil(),
      signerPrivateKeys,
      details.invitation.sender(),
    );

    const responseTarget = details.invitation.responseArid();
    const client = await createStorageClient(options.storageSelection);

    await putWithIndicator(
      client,
      responseTarget,
      responseEnvelope,
      "Round 1 Response",
      options.verbose ?? false,
    );

    if (options.verbose === true) {
      console.log(`Sent round 1 response`);
      console.log(`Listening at: ${nextResponseArid.urString()}`);
    }

    return {
      accepted: options.rejectReason === undefined,
      listeningArid: nextResponseArid.urString(),
    };
  } else if (options.preview === true) {
    // Show the GSTP response structure without encryption
    const unsealedEnvelope = sealed.toEnvelope(undefined, signerPrivateKeys, undefined);
    const envelopeUr = unsealedEnvelope.urString();
    console.log(envelopeUr);

    return {
      accepted: options.rejectReason === undefined,
      envelopeUr,
    };
  } else {
    // Print the sealed envelope
    const responseEnvelope = sealed.toEnvelope(
      details.invitation.validUntil(),
      signerPrivateKeys,
      details.invitation.sender(),
    );
    const envelopeUr = responseEnvelope.urString();
    console.log(envelopeUr);

    return {
      accepted: options.rejectReason === undefined,
      envelopeUr,
    };
  }
}

/**
 * Resolve a sender XID document from the registry by UR or pet name.
 */
function resolveSenderXidDocument(registry: Registry, raw: string): XIDDocument {
  // Try parsing as XID UR first
  try {
    const xid = XID.fromURString(raw.trim());
    const record = registry.participant(xid);
    if (record) {
      return record.xidDocument();
    }
    const owner = registry.owner();
    if (owner?.xid().urString() === xid.urString()) {
      return owner.xidDocument();
    }
    throw new Error(`Sender with XID ${xid.urString()} not found in registry`);
  } catch {
    // Try looking up by pet name
    const result = registry.participantByPetName(raw.trim());
    if (result) {
      const [, record] = result;
      return record.xidDocument();
    }
    const owner = registry.owner();
    if (owner?.petName() === raw.trim()) {
      return owner.xidDocument();
    }
    throw new Error(`Sender '${raw}' not found in registry`);
  }
}
