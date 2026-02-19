/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Sign participant receive command.
 *
 * Port of cmd/sign/participant/receive.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type XID } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import type { Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath, type OwnerRecord } from "../../../registry/index.js";
import { getWithIndicator } from "../../busy.js";
import { type StorageClient, type StorageSelection } from "../../storage.js";
import { parseAridUr, parseEnvelopeUr, formatNameWithOwnerMarker } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

/**
 * Options for the sign receive command.
 */
export interface SignReceiveOptions {
  registryPath?: string;
  /** ARID or envelope UR string */
  request: string;
  timeoutSeconds?: number;
  /** Show request details only (info mode) */
  info?: boolean;
  /** Expected sender (XID UR or pet name) */
  sender?: string;
}

/**
 * Result of the sign receive command.
 */
export interface SignReceiveResult {
  sessionId: string;
  groupId: string;
  targetUr: string;
  coordinatorName: string;
  minSigners: number;
  participantNames: string[];
}

/**
 * Resolve sender from XID UR or pet name in registry.
 *
 * Port of `resolve_sender()` from cmd/dkg/common.rs lines 76-94.
 */
function resolveSenderFromInput(registry: Registry, input: string): { xid: () => XID } {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("Sender is required");
  }

  // Try parsing as XID UR first
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
    const { XID: XIDClass } = require("@bcts/components");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const xid = XIDClass.fromURString(trimmed) as XID;
    const record = registry.participant(xid);
    if (!record) {
      throw new Error(`Sender with XID ${xid.urString()} not found`);
    }
    return record.xidDocument();
  } catch {
    // Try looking up by pet name
    const result = registry.participantByPetName(trimmed);
    if (!result) {
      throw new Error(`Sender with pet name '${trimmed}' not found`);
    }
    return result[1].xidDocument();
  }
}

/**
 * Resolve sign invite from ARID or envelope UR.
 *
 * Port of `resolve_sign_request()` from cmd/sign/participant/receive.rs lines 250-284.
 */
async function resolveSignInviteEnvelope(
  client: StorageClient | undefined,
  selection: StorageSelection | undefined,
  request: string,
  timeout: number | undefined,
): Promise<Envelope> {
  if (selection !== undefined && client !== undefined) {
    // Try to parse as ARID
    try {
      const arid = parseAridUr(request);
      const envelope = await getWithIndicator(client, arid, "Sign invite", timeout, false);
      if (envelope === undefined || envelope === null) {
        throw new Error("signInvite request not found in Hubert storage");
      }
      return envelope;
    } catch {
      // Not an ARID, try as envelope
    }

    if (timeout !== undefined) {
      throw new Error("--timeout is only valid when retrieving requests from Hubert");
    }
    return parseEnvelopeUr(request);
  }

  // No storage selection
  try {
    parseAridUr(request);
    throw new Error("Hubert storage parameters are required to retrieve requests by ARID");
  } catch (e) {
    if (e instanceof Error && e.message.includes("Hubert storage parameters")) {
      throw e;
    }
    // Not an ARID, parse as envelope
  }
  return parseEnvelopeUr(request);
}

/**
 * Get display name for sender from registry.
 *
 * Port of `resolve_sender_name()` from cmd/dkg/common.rs lines 96-116.
 */
function resolveSenderName(registry: Registry, senderXid: XID): string | undefined {
  const owner = registry.owner();

  // Check if sender is the owner
  if (owner?.xid().urString() === senderXid.urString()) {
    const name = owner.petName() ?? senderXid.urString();
    return formatNameWithOwnerMarker(name, true);
  }

  // Look up in participants
  const record = registry.participant(senderXid);
  if (record) {
    const name = record.petName() ?? record.xid().urString();
    return formatNameWithOwnerMarker(name, false);
  }

  return undefined;
}

/**
 * Format participant names with owner marker.
 *
 * Port of `format_participant_names()` from cmd/sign/participant/receive.rs lines 286-309.
 */
function formatParticipantNames(
  registry: Registry,
  participants: XID[],
  owner: OwnerRecord,
): string[] {
  return participants.map((xid) => {
    const isOwner = xid.urString() === owner.xid().urString();
    let name: string;

    if (isOwner) {
      name = owner.petName() ?? xid.urString();
    } else {
      const record = registry.participant(xid);
      name = record?.petName() ?? xid.urString();
    }

    return formatNameWithOwnerMarker(name, isOwner);
  });
}

/**
 * Execute the sign participant receive command.
 *
 * Fetches and validates a sign invite from the coordinator.
 *
 * Port of `CommandArgs::exec()` from cmd/sign/participant/receive.rs lines 56-247.
 */
export async function receive(
  client: StorageClient | undefined,
  selection: StorageSelection | undefined,
  options: SignReceiveOptions,
  cwd: string,
): Promise<SignReceiveResult> {
  // Validate timeout requires storage
  if (selection === undefined && options.timeoutSeconds !== undefined) {
    throw new Error("--timeout requires Hubert storage parameters");
  }

  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);
  const owner = registry.owner();

  if (!owner) {
    throw new Error("Registry owner with private keys is required");
  }

  // Resolve expected sender if provided
  let expectedSender: { xid: () => XID } | undefined;
  if (options.sender !== undefined && options.sender !== "") {
    expectedSender = resolveSenderFromInput(registry, options.sender);
  }

  // Resolve the invite envelope
  const envelope = await resolveSignInviteEnvelope(
    client,
    selection,
    options.request,
    options.timeoutSeconds,
  );

  const now: CborDate = CborDate.now();
  const recipientKeys = owner.xidDocument().inceptionPrivateKeys();

  if (recipientKeys === null || recipientKeys === undefined) {
    throw new Error("Owner XID document has no inception private keys");
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

  interface SealedRequestInstance {
    sender: () => { xid: () => XID };
    function: () => { equals?: (other: unknown) => boolean; toString?: () => string };
    extractObjectForParameter: <T>(name: string) => T;
    objectForParameter: (name: string) => Envelope;
    objectsForParameter: (name: string) => ParticipantEntry[];
  }

  interface ParticipantEntry {
    extractSubject: () => XID;
    objectForPredicate: (name: string) => {
      decryptToRecipient: (keys: unknown) => {
        extractSubject: () => ARID;
      };
    };
  }

  const sealedRequest: SealedRequestInstance = SealedRequestClass.tryFromEnvelope(
    envelope,
    undefined,
    now,
    recipientKeys,
  );

  // Validate sender
  const senderXid = sealedRequest.sender().xid();

  if (expectedSender !== undefined) {
    if (senderXid.urString() !== expectedSender.xid().urString()) {
      throw new Error(
        `Request sender does not match expected sender (got ${senderXid.urString()}, expected ${expectedSender.xid().urString()})`,
      );
    }
  } else {
    const knownOwner = owner.xid().urString() === senderXid.urString();
    const knownParticipant = registry.participant(senderXid) !== undefined;
    if (!knownOwner && !knownParticipant) {
      throw new Error(`Request sender not found in registry: ${senderXid.urString()}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { Function: FunctionClass } = require("@bcts/envelope") as {
    Function: { from: (name: string) => unknown };
  };

  // Validate function
  const requestFunction = sealedRequest.function();
  const expectedFunction = FunctionClass.from("signInvite");
  const functionMatches =
    requestFunction.equals !== undefined
      ? requestFunction.equals(expectedFunction)
      : String(requestFunction) === String(expectedFunction);

  if (!functionMatches) {
    throw new Error(`Unexpected request function: ${String(requestFunction)}`);
  }

  // Extract parameters
  const validUntil = sealedRequest.extractObjectForParameter<CborDate>("validUntil");
  if (validUntil <= now) {
    throw new Error("signInvite request has expired");
  }

  const groupId = sealedRequest.extractObjectForParameter<ARID>("group");
  const sessionId = sealedRequest.extractObjectForParameter<ARID>("session");
  const minSigners = Number(sealedRequest.extractObjectForParameter<bigint | number>("minSigners"));

  // Extract participants and find our response ARID
  const participantEntries = sealedRequest.objectsForParameter("participant");
  const participants: XID[] = [];
  let responseArid: ARID | undefined;

  for (const entry of participantEntries) {
    const xid: XID = entry.extractSubject();
    if (xid.urString() === owner.xid().urString()) {
      const encryptedArid = entry.objectForPredicate("response_arid");
      const aridEnv = encryptedArid.decryptToRecipient(recipientKeys);
      responseArid = aridEnv.extractSubject();
    }
    participants.push(xid);
  }

  // Validations
  if (participants.length === 0) {
    throw new Error("signInvite request contains no participants");
  }
  if (minSigners < 2) {
    throw new Error("minSigners must be at least 2");
  }
  if (minSigners > participants.length) {
    throw new Error("minSigners exceeds participant count");
  }

  const ownerInParticipants = participants.some((p) => p.urString() === owner.xid().urString());
  if (!ownerInParticipants) {
    throw new Error("signInvite request does not include this participant");
  }

  if (responseArid === undefined) {
    throw new Error("signInvite request missing response ARID");
  }

  // Sort participants by XID
  participants.sort((a, b) => a.urString().localeCompare(b.urString()));

  const targetEnvelope = sealedRequest.objectForParameter("target");

  const coordinatorName = resolveSenderName(registry, senderXid) ?? senderXid.urString();
  const participantNames = formatParticipantNames(registry, participants, owner);

  // Output
  console.log(`Group: ${groupId.urString()}`);
  console.log(`Coordinator: ${coordinatorName}`);
  console.log(`Min signers: ${minSigners}`);
  console.log(`Participants: ${participantNames.join(", ")}`);
  console.log("Target:");
  console.log(targetEnvelope.format());

  // Primary output for scripting: session ID on its own line (no header)
  console.log(sessionId.urString());

  // Persist request details for follow-up commands
  const stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const root: Record<string, unknown> = {
    request_envelope: envelope.urString(),
    group: groupId.urString(),
    session: sessionId.urString(),
    coordinator: senderXid.urString(),
    min_signers: minSigners,
    response_arid: responseArid.urString(),
    participants: participants.map((xid) => xid.urString()),
    target: targetEnvelope.urString(),
  };

  fs.writeFileSync(path.join(stateDir, "sign_receive.json"), JSON.stringify(root, null, 2));

  return {
    sessionId: sessionId.urString(),
    groupId: groupId.urString(),
    targetUr: targetEnvelope.urString(),
    coordinatorName,
    minSigners,
    participantNames,
  };
}
