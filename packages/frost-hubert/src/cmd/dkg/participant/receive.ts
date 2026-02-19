/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * DKG participant receive command.
 *
 * Port of cmd/dkg/participant/receive.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, XID } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { type Envelope, Function as EnvelopeFunction } from "@bcts/envelope";
import { SealedRequest } from "@bcts/gstp";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";

import { DkgInvitation } from "../../../dkg/index.js";
import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator } from "../../busy.js";
import { createStorageClient, type StorageClient, type StorageSelection } from "../../storage.js";
import {
  dkgStateDir,
  parseAridUr,
  parseEnvelopeUr,
  participantNamesFromRegistry,
  resolveSenderName,
} from "../common.js";

/**
 * Options for the DKG receive command.
 */
export interface DkgReceiveOptions {
  registryPath?: string;
  timeoutSeconds?: number;
  noEnvelope?: boolean;
  info?: boolean;
  sender?: string;
  invite: string;
  storageSelection?: StorageSelection;
  verbose?: boolean;
}

/**
 * Result of the DKG receive command.
 */
export interface DkgReceiveResult {
  groupId: string;
  requestId: string;
  minSigners: number;
  charter: string;
  validUntil: string;
  responseArid: string;
  envelopeUr?: string | undefined;
  coordinatorName?: string | undefined;
  participantNames?: string[] | undefined;
}

/**
 * Details extracted from a DKG invite.
 *
 * Port of `struct InviteDetails` from cmd/dkg/participant/receive.rs lines 117-120.
 */
export interface InviteDetails {
  invitation: DkgInvitation;
  participants: XIDDocument[];
}

/**
 * Resolve an invite envelope from either storage (ARID) or direct UR.
 *
 * Port of `resolve_invite_envelope()` from cmd/dkg/participant/receive.rs lines 122-152.
 */
export async function resolveInviteEnvelope(
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
 * Decode and validate invite details from an envelope.
 *
 * Port of `decode_invite_details()` from cmd/dkg/participant/receive.rs lines 154-256.
 */
export function decodeInviteDetails(
  invite: Envelope,
  now: Date,
  registry: Registry,
  recipient: XIDDocument,
  expectedSender?: XIDDocument,
): InviteDetails {
  const recipientPrivateKeys = recipient.inceptionPrivateKeys();

  if (recipientPrivateKeys === undefined) {
    throw new Error("Recipient XID document has no inception private keys");
  }

  const sealedRequest = SealedRequest.tryFromEnvelope(invite, undefined, now, recipientPrivateKeys);

  const senderDocument = sealedRequest.sender();
  if (expectedSender !== undefined) {
    if (senderDocument.xid().urString() !== expectedSender.xid().urString()) {
      throw new Error("Invite sender does not match expected sender");
    }
  } else {
    const senderXid = senderDocument.xid();
    const owner = registry.owner();
    const knownOwner = owner?.xidDocument().xid().urString() === senderXid.urString();
    const knownParticipant = registry.participant(senderXid) !== undefined;

    if (!knownOwner && !knownParticipant) {
      throw new Error(`Invite sender not found in registry: ${senderXid.urString()}`);
    }
  }

  if (!sealedRequest.request().function().equals(EnvelopeFunction.fromString("dkgInvite"))) {
    throw new Error("Unexpected invite function");
  }

  const validUntil = sealedRequest.extractObjectForParameter<Date>("validUntil");
  if (validUntil <= now) {
    throw new Error("Invitation expired");
  }

  const minSigners = sealedRequest.extractObjectForParameter<number>("minSigners");
  sealedRequest.extractObjectForParameter<string>("charter");
  sealedRequest.extractObjectForParameter<ARID>("group");
  const participantObjects = sealedRequest.objectsForParameter("participant");

  if (minSigners < 2) {
    throw new Error("min_signers must be at least 2");
  }

  if (minSigners > participantObjects.length) {
    throw new Error("min_signers exceeds participant count");
  }

  const participantDocs: XIDDocument[] = [];
  let responseArid: ARID | undefined;
  const recipientXid = recipient.xid();

  for (const participant of participantObjects) {
    const xidDocumentEnvelope = participant.tryUnwrap();
    const xidDocument = XIDDocument.fromEnvelope(
      xidDocumentEnvelope,
      undefined,
      XIDVerifySignature.Inception,
    );

    if (xidDocument.xid().urString() === recipientXid.urString()) {
      const encryptedResponseArid = participant.objectForPredicate("response_arid");
      const responseAridEnvelope = encryptedResponseArid.decryptToRecipient(recipientPrivateKeys);
      responseArid = responseAridEnvelope.extractSubject((cbor) => ARID.fromTaggedCbor(cbor));
    }

    participantDocs.push(xidDocument);
  }

  const invitation = DkgInvitation.fromInvite(invite, now, expectedSender, recipient);

  if (responseArid === undefined) {
    throw new Error("Invite does not include a response ARID for this recipient");
  }

  return { invitation, participants: participantDocs };
}

/**
 * Resolve a sender XID document from the registry by UR or pet name.
 *
 * Port of `resolve_sender()` usage in receive.rs for expected sender.
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

/**
 * Execute the DKG participant receive command.
 *
 * Fetches and validates a DKG invite from the coordinator.
 *
 * Port of `receive()` from cmd/dkg/participant/receive.rs.
 */
export async function receive(
  _client: StorageClient | undefined,
  options: DkgReceiveOptions,
  cwd: string,
): Promise<DkgReceiveResult> {
  if (options.storageSelection === undefined && options.timeoutSeconds !== undefined) {
    throw new Error("--timeout requires Hubert storage parameters");
  }

  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (!owner) {
    throw new Error("Registry owner with private keys is required");
  }

  const expectedSender = options.sender
    ? resolveSenderXidDocument(registry, options.sender)
    : undefined;

  const inviteEnvelope = await resolveInviteEnvelope(
    options.storageSelection,
    options.invite,
    options.timeoutSeconds,
  );

  const now = CborDate.now().datetime();
  const details = decodeInviteDetails(
    inviteEnvelope,
    now,
    registry,
    owner.xidDocument(),
    expectedSender,
  );

  const participantNames = participantNamesFromRegistry(
    registry,
    details.participants,
    owner.xid(),
    owner.petName(),
  );

  const coordinatorName = resolveSenderName(registry, details.invitation.sender());

  // Save receive state
  const stateDir = dkgStateDir(registryPath, details.invitation.groupId().hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const validUntilStr: string = (
    details.invitation.validUntil() as { toString(): string }
  ).toString();
  const receiveState = {
    group: details.invitation.groupId().urString(),
    request_id: details.invitation.requestId().urString(),
    response_arid: details.invitation.responseArid().urString(),
    valid_until: validUntilStr,
    min_signers: details.invitation.minSigners(),
    charter: details.invitation.charter(),
    sender: details.invitation.sender().xid().urString(),
  };

  fs.writeFileSync(path.join(stateDir, "receive.json"), JSON.stringify(receiveState, null, 2));

  // Output based on options
  let envelopeUr: string | undefined;
  if (options.noEnvelope !== true) {
    envelopeUr = inviteEnvelope.urString();
    console.log(envelopeUr);
  }

  if (options.info === true) {
    console.error(`Charter: ${details.invitation.charter()}`);
    console.error(`Min signers: ${details.invitation.minSigners()}`);
    if (coordinatorName !== undefined) {
      console.error(`Coordinator: ${coordinatorName}`);
    }
    console.error(`Participants: ${participantNames.join(", ")}`);
  }

  if (options.verbose === true) {
    console.log(`Group ID: ${details.invitation.groupId().urString()}`);
    console.log(`Min signers: ${details.invitation.minSigners()}`);
    console.log(`Charter: ${details.invitation.charter()}`);
    console.log(`Valid until: ${String(details.invitation.validUntil())}`);
    console.log(`Response ARID: ${details.invitation.responseArid().urString()}`);
  }

  const resultValidUntilStr: string = (
    details.invitation.validUntil() as { toString(): string }
  ).toString();

  return {
    groupId: details.invitation.groupId().urString(),
    requestId: details.invitation.requestId().urString(),
    minSigners: details.invitation.minSigners(),
    charter: details.invitation.charter(),
    validUntil: resultValidUntilStr,
    responseArid: details.invitation.responseArid().urString(),
    envelopeUr,
    coordinatorName,
    participantNames,
  };
}
