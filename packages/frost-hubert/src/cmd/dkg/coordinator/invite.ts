/**
 * DKG coordinator invite command.
 *
 * Port of cmd/dkg/coordinator/invite.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, Date as BCDate } from "@bcts/components";

import { DkgInvite } from "../../../dkg/index.js";
import {
  GroupParticipant,
  GroupRecord,
  PendingRequests,
  Registry,
  resolveRegistryPath,
} from "../../../registry/index.js";
import { putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, resolveSender } from "../common.js";

/**
 * Options for the DKG invite command.
 */
export interface DkgInviteOptions {
  registryPath?: string;
  minSigners: number;
  charter: string;
  validDays: number;
  participantNames: string[];
  verbose?: boolean;
}

/**
 * Result of the DKG invite command.
 */
export interface DkgInviteResult {
  groupId: ARID;
  requestId: ARID;
  envelopeUr: string;
}

/**
 * Execute the DKG invite command.
 *
 * Port of `invite()` from cmd/dkg/coordinator/invite.rs.
 */
export async function invite(
  client: StorageClient,
  options: DkgInviteOptions,
  cwd: string,
): Promise<DkgInviteResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const sender = resolveSender(registry);

  // Resolve participants from registry
  const participants: string[] = [];
  for (const name of options.participantNames) {
    let found = false;
    for (const record of registry.participants().values()) {
      if (record.petName() === name) {
        participants.push(record.xidDocumentUr());
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`Participant '${name}' not found in registry`);
    }
  }

  if (participants.length < options.minSigners) {
    throw new Error(
      `Need at least ${options.minSigners} participants, but only ${participants.length} specified`,
    );
  }

  // Generate ARIDs for each participant
  const responseArids: ARID[] = [];
  for (const _participant of participants) {
    responseArids.push(ARID.new());
  }

  // Generate group ID and request ID
  const groupId = ARID.new();
  const requestId = ARID.new();

  // Calculate dates
  const now: BCDate = BCDate.now();
  const validUntil: BCDate = BCDate.fromDate(
    new Date(Date.now() + options.validDays * 24 * 60 * 60 * 1000),
  );

  // Create the invite
  const dkgInvite = DkgInvite.create(
    requestId,
    sender,
    groupId,
    now,
    validUntil,
    options.minSigners,
    options.charter,
    participants,
    responseArids,
  );

  // Create sealed envelope
  const envelope = dkgInvite.toEnvelope();

  // Send to storage
  const startArid = ARID.new();
  await putWithIndicator(
    client,
    startArid,
    envelope,
    "Sending DKG invite",
    options.verbose ?? false,
  );

  // Save group record to registry
  const coordinator = new GroupParticipant(sender.xid());
  const groupParticipants = dkgInvite.participants().map((p) => new GroupParticipant(p.xid()));

  const groupRecord = new GroupRecord(
    options.charter,
    options.minSigners,
    coordinator,
    groupParticipants,
  );

  // Track pending requests
  const pendingRequests = new PendingRequests();
  for (const participant of dkgInvite.participants()) {
    pendingRequests.addCollectOnly(participant.xid(), participant.responseArid());
  }
  groupRecord.setPendingRequests(pendingRequests);

  registry.addGroup(groupId, groupRecord);
  registry.save(registryPath);

  // Save invite state
  const stateDir = dkgStateDir(registryPath, groupId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const inviteState: {
    group: string;
    request_id: string;
    start_arid: string;
    valid_until: string;
    participants: { xid: string; response_arid: string }[];
  } = {
    group: groupId.urString(),
    request_id: requestId.urString(),
    start_arid: startArid.urString(),
    valid_until: validUntil.toISOString(),
    participants: dkgInvite.participants().map((p) => ({
      xid: p.xid().urString(),
      response_arid: p.responseArid().urString(),
    })),
  };

  fs.writeFileSync(path.join(stateDir, "invite.json"), JSON.stringify(inviteState, null, 2));

  if (options.verbose === true) {
    // eslint-disable-next-line no-console
    console.log(`Group ID: ${groupId.urString()}`);
    // eslint-disable-next-line no-console
    console.log(`Start ARID: ${startArid.urString()}`);
  }

  return {
    groupId,
    requestId,
    envelopeUr: envelope.urString(),
  };
}
