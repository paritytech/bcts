/**
 * Sign coordinator invite command.
 *
 * Port of cmd/sign/coordinator/invite.rs from frost-hubert-rust.
 *
 * @module
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { Envelope } from "@bcts/envelope";
import { SealedRequest } from "@bcts/gstp";
import { type XIDDocument } from "@bcts/xid";

import {
  Registry,
  resolveRegistryPath,
  type GroupRecord,
  type GroupParticipant,
  type OwnerRecord,
} from "../../../registry/index.js";
import { putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

// -----------------------------------------------------------------------------
// Session ARID management
// -----------------------------------------------------------------------------

/**
 * Session ARIDs for tracking the signing session.
 *
 * Port of `struct SessionArids` from cmd/sign/coordinator/invite.rs lines 151-156.
 */
export interface SessionArids {
  sessionId: ARID;
  startArid: ARID;
  commitArids: Map<string, ARID>; // Map<XID.urString(), ARID>
  shareArids: Map<string, ARID>; // Map<XID.urString(), ARID>
}

/**
 * Create new session ARIDs for all participants.
 *
 * Port of `SessionArids::new()` from cmd/sign/coordinator/invite.rs lines 158-173.
 */
export function createSessionArids(participants: GroupParticipant[]): SessionArids {
  const commitArids = new Map<string, ARID>();
  const shareArids = new Map<string, ARID>();

  for (const participant of participants) {
    const xidKey = participant.xid().urString();
    commitArids.set(xidKey, ARID.new());
    shareArids.set(xidKey, ARID.new());
  }

  return {
    sessionId: ARID.new(),
    startArid: ARID.new(),
    commitArids,
    shareArids,
  };
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Validate that the owner is the coordinator of the group.
 *
 * Port of `validate_coordinator()` from cmd/sign/coordinator/invite.rs lines 179-192.
 */
export function validateCoordinator(groupRecord: GroupRecord, owner: OwnerRecord): void {
  if (groupRecord.coordinator().xid().urString() !== owner.xid().urString()) {
    throw new Error(
      `Only the coordinator can start signing. Coordinator: ${groupRecord.coordinator().xid().urString()}, Owner: ${owner.xid().urString()}`,
    );
  }
}

// -----------------------------------------------------------------------------
// Participant document gathering
// -----------------------------------------------------------------------------

/**
 * Gather XIDDocuments for all participants from the registry.
 *
 * Port of `gather_recipient_documents()` from cmd/sign/coordinator/invite.rs lines 198-222.
 */
export function gatherRecipientDocuments(
  participants: GroupParticipant[],
  owner: OwnerRecord,
  registry: Registry,
): XIDDocument[] {
  const recipientDocs: XIDDocument[] = [];

  for (const participant of participants) {
    const xid = participant.xid();
    if (xid.urString() === owner.xid().urString()) {
      recipientDocs.push(owner.xidDocument());
    } else {
      const record = registry.participant(xid);
      if (record === undefined) {
        throw new Error(`Participant ${xid.urString()} not found in registry`);
      }
      recipientDocs.push(record.xidDocument());
    }
  }

  return recipientDocs;
}

// -----------------------------------------------------------------------------
// Request building
// -----------------------------------------------------------------------------

/**
 * Context for building the sign invite request.
 *
 * Port of `struct SignInviteContext` from cmd/sign/coordinator/invite.rs lines 228-237.
 */
export interface SignInviteContext {
  arids: SessionArids;
  groupId: ARID;
  targetEnvelope: Envelope;
  groupRecord: GroupRecord;
  owner: OwnerRecord;
  registry: Registry;
  participants: GroupParticipant[];
  validUntil: Date;
}

/**
 * Build the sign invite request.
 *
 * Port of `build_sign_invite_request()` from cmd/sign/coordinator/invite.rs lines 239-284.
 */
export function buildSignInviteRequest(ctx: SignInviteContext): SealedRequest {
  let request = SealedRequest.new("signInvite", ctx.arids.sessionId, ctx.owner.xidDocument())
    .withParameter("group", ctx.groupId)
    .withParameter("session", ctx.arids.sessionId)
    .withParameter("target", ctx.targetEnvelope)
    .withParameter("minSigners", ctx.groupRecord.minSigners())
    .withDate(new Date())
    .withParameter("validUntil", CborDate.fromDatetime(ctx.validUntil));

  for (const participant of ctx.participants) {
    const xid = participant.xid();
    const xidKey = xid.urString();

    // Get participant document
    let participantDoc: XIDDocument;
    if (xidKey === ctx.owner.xid().urString()) {
      participantDoc = ctx.owner.xidDocument();
    } else {
      const record = ctx.registry.participant(xid);
      if (record === undefined) {
        throw new Error("Participant not found in registry");
      }
      participantDoc = record.xidDocument();
    }

    // Get encryption key
    const encryptionKey = participantDoc.encryptionKey();
    if (encryptionKey === undefined) {
      throw new Error("Participant XID document has no encryption key");
    }

    // Get commit ARID for this participant
    const responseArid = ctx.arids.commitArids.get(xidKey);
    if (responseArid === undefined) {
      throw new Error("commit ARID not found for participant");
    }

    // Encrypt response ARID to participant
    // @ts-expect-error TS2339 - API mismatch: toEnvelope/encryptToRecipient methods
    const encryptedResponseArid = responseArid.toEnvelope().encryptToRecipient(encryptionKey);

    // Build participant entry envelope
    const participantEntry = Envelope.new(xid).addAssertion("response_arid", encryptedResponseArid);

    request = request.withParameter("participant", participantEntry);
  }

  return request;
}

// -----------------------------------------------------------------------------
// State persistence
// -----------------------------------------------------------------------------

/**
 * Build the session state JSON for persistence.
 *
 * Port of `build_session_state_json()` from cmd/sign/coordinator/invite.rs lines 290-346.
 */
export function buildSessionStateJson(
  arids: SessionArids,
  groupId: ARID,
  groupRecord: GroupRecord,
  participants: GroupParticipant[],
  targetEnvelope: Envelope,
): Record<string, unknown> {
  const participantsMap: Record<string, unknown> = {};

  for (const participant of participants) {
    const xid = participant.xid();
    const xidKey = xid.urString();

    const commitArid = arids.commitArids.get(xidKey);
    const shareArid = arids.shareArids.get(xidKey);

    if (commitArid === undefined || shareArid === undefined) {
      throw new Error("ARID not found for participant");
    }

    participantsMap[xidKey] = {
      commit_arid: commitArid.urString(),
      share_arid: shareArid.urString(),
    };
  }

  return {
    session_id: arids.sessionId.urString(),
    start_arid: arids.startArid.urString(),
    group: groupId.urString(),
    min_signers: groupRecord.minSigners(),
    participants: participantsMap,
    target: targetEnvelope.urString(),
  };
}

/**
 * Persist the session state to disk.
 *
 * Port of `persist_session_state()` from cmd/sign/coordinator/invite.rs lines 348-356.
 */
export function persistSessionState(signingDir: string, stateJson: Record<string, unknown>): void {
  fs.mkdirSync(signingDir, { recursive: true });
  const startStatePath = path.join(signingDir, "start.json");
  fs.writeFileSync(startStatePath, JSON.stringify(stateJson, null, 2));
}

// -----------------------------------------------------------------------------
// File loading
// -----------------------------------------------------------------------------

/**
 * Load an envelope from a file path.
 *
 * Port of `load_envelope_from_path()` from cmd/sign/coordinator/invite.rs lines 385-392.
 */
export function loadEnvelopeFromPath(filePath: string): Envelope {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Failed to read target envelope from ${filePath}`);
  }

  const data = fs.readFileSync(filePath, "utf-8");
  const trimmed = data.trim();

  try {
    return Envelope.fromURString(trimmed);
  } catch (e) {
    throw new Error(`Failed to load target envelope from ${filePath}: ${String(e)}`);
  }
}

// -----------------------------------------------------------------------------
// Options and Result types
// -----------------------------------------------------------------------------

/**
 * Options for the sign invite command.
 */
export interface SignInviteOptions {
  registryPath?: string;
  groupId: string;
  targetFile: string;
  validDays?: number;
  verbose?: boolean;
  preview?: boolean;
}

/**
 * Result of the sign invite command.
 */
export interface SignInviteResult {
  sessionId: string;
  startArid: string;
}

// -----------------------------------------------------------------------------
// Main invite function
// -----------------------------------------------------------------------------

/**
 * Execute the sign coordinator invite command.
 *
 * Invites participants to sign a target envelope.
 *
 * Port of `CommandArgs::exec()` from cmd/sign/coordinator/invite.rs lines 44-144.
 */
export async function invite(
  client: StorageClient | undefined,
  options: SignInviteOptions,
  cwd: string,
): Promise<SignInviteResult> {
  // Validate preview mode
  if (client !== undefined && options.preview === true) {
    throw new Error("--preview cannot be used with Hubert storage options");
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
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  // Validate sender is coordinator
  validateCoordinator(groupRecord, owner);

  // Load target envelope
  const targetPath = path.resolve(cwd, options.targetFile);
  const targetEnvelope = loadEnvelopeFromPath(targetPath);

  // Get participants
  const participants = groupRecord.participants();

  // Gather recipient documents
  const recipientDocs = gatherRecipientDocuments(participants, owner, registry);

  // Get signer keys
  const signerKeys = owner.xidDocument().inceptionPrivateKeys();
  if (signerKeys === undefined) {
    throw new Error("Coordinator XID document has no signing keys");
  }

  // Generate session ARIDs
  const sessionArids = createSessionArids(participants);

  // Calculate valid until date (default 1 hour)
  const validDays = options.validDays ?? 1 / 24; // 1 hour default
  const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

  // Build request context
  const ctx: SignInviteContext = {
    arids: sessionArids,
    groupId,
    targetEnvelope,
    groupRecord,
    owner,
    registry,
    participants,
    validUntil,
  };

  // Build request
  const request = buildSignInviteRequest(ctx);

  // Build state for persistence
  const stateJson = buildSessionStateJson(
    sessionArids,
    groupId,
    groupRecord,
    participants,
    targetEnvelope,
  );

  // Build envelope for recipients
  const recipientRefs = recipientDocs;
  const sealedEnvelope = request.toEnvelopeForRecipients(validUntil, signerKeys, recipientRefs);

  // Handle preview mode
  if (options.preview === true) {
    const unsealed = request.toEnvelope(undefined, signerKeys, undefined);
    console.log(unsealed.urString());
    return {
      sessionId: sessionArids.sessionId.urString(),
      startArid: sessionArids.startArid.urString(),
    };
  }

  // Persist state
  const signingDir = signingStateDir(registryPath, groupId.hex(), sessionArids.sessionId.hex());
  persistSessionState(signingDir, stateJson);

  // Post to Hubert storage
  if (client === undefined) {
    throw new Error("Hubert storage is required for sign start");
  }

  await putWithIndicator(
    client,
    sessionArids.startArid,
    sealedEnvelope,
    "Signing invite",
    options.verbose ?? false,
  );

  if (options.verbose === true) {
    console.log(`Session ID: ${sessionArids.sessionId.urString()}`);
    console.log(`Start ARID: ${sessionArids.startArid.urString()}`);
  }

  // Output the start ARID
  console.log(sessionArids.startArid.urString());

  return {
    sessionId: sessionArids.sessionId.urString(),
    startArid: sessionArids.startArid.urString(),
  };
}
