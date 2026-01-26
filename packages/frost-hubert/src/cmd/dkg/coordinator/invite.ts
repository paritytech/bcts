/**
 * DKG coordinator invite command.
 *
 * Port of cmd/dkg/coordinator/invite.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, type XID } from "@bcts/components";

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
import { dkgStateDir, resolveParticipants, resolveSender } from "../common.js";

/**
 * Options for the DKG invite command.
 */
export interface DkgInviteOptions {
  registryPath?: string;
  minSigners?: number;
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
 * Internal data structure for building an invite.
 *
 * Port of `InviteData` struct from cmd/dkg/coordinator/invite.rs lines 122-126.
 */
interface InviteData {
  invite: DkgInvite;
  participantXids: XID[];
  pendingRequests: PendingRequests;
}

/**
 * Build the DKG invite with validation.
 *
 * Port of `build_invite()` from cmd/dkg/coordinator/invite.rs lines 128-181.
 */
function buildInvite(
  registry: Registry,
  minSignersArg: number | undefined,
  charter: string,
  participantNames: string[],
  validDays: number,
): InviteData {
  // Resolve participants using the common utility
  const resolved = resolveParticipants(registry, participantNames);
  const participantDocs: string[] = resolved.map(([, record]) => record.xidDocumentUr());
  const participantXids: XID[] = resolved.map(([xid]) => xid);

  // These are the ARIDs where participants will post their invite responses
  const collectFromArids: ARID[] = participantDocs.map(() => ARID.new());

  // Build pending_requests: coordinator will collect invite responses from these ARIDs
  const pendingRequests = new PendingRequests();
  for (let i = 0; i < participantXids.length; i++) {
    pendingRequests.addCollectOnly(participantXids[i], collectFromArids[i]);
  }

  // Validate participant count
  const participantCount = participantDocs.length;
  if (participantCount < 2) {
    throw new Error("At least two participants are required for a DKG invite");
  }

  // Validate and default minSigners
  const minSigners = minSignersArg ?? participantCount;
  if (minSigners < 2) {
    throw new Error("--min-signers must be at least 2");
  }
  if (minSigners > participantCount) {
    throw new Error("--min-signers cannot exceed participant count");
  }

  // Get sender (registry owner)
  const sender = resolveSender(registry);

  // Calculate dates
  const now = new Date();
  const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

  // Create the invite
  const invite = DkgInvite.create(
    ARID.new(), // requestId
    sender,
    ARID.new(), // groupId
    now,
    validUntil,
    minSigners,
    charter,
    participantDocs,
    collectFromArids,
  );

  return { invite, participantXids, pendingRequests };
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

  // Build the invite with validation
  const inviteData = buildInvite(
    registry,
    options.minSigners,
    options.charter,
    options.participantNames,
    options.validDays,
  );

  const { invite: dkgInvite, participantXids, pendingRequests } = inviteData;
  const groupId = dkgInvite.groupId();
  const requestId = dkgInvite.requestId();

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
  const owner = registry.owner();
  if (!owner) {
    throw new Error("Registry owner is required to issue invites");
  }

  const coordinator = new GroupParticipant(owner.xid());
  const groupParticipants = participantXids.map((xid) => new GroupParticipant(xid));

  const groupRecord = new GroupRecord(
    options.charter,
    dkgInvite.minSigners(),
    coordinator,
    groupParticipants,
  );

  // Track pending requests
  groupRecord.setPendingRequests(pendingRequests);

  // Use recordGroup() for proper merge behavior
  registry.recordGroup(groupId, groupRecord);
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
    valid_until: dkgInvite.validUntil().toISOString(),
    participants: dkgInvite.participants().map((p) => ({
      xid: p.xid().urString(),
      response_arid: p.responseArid().urString(),
    })),
  };

  fs.writeFileSync(path.join(stateDir, "invite.json"), JSON.stringify(inviteState, null, 2));

  if (options.verbose === true) {
    console.log(`Group ID: ${groupId.urString()}`);
    console.log(`Start ARID: ${startArid.urString()}`);
  }

  return {
    groupId,
    requestId,
    envelopeUr: envelope.urString(),
  };
}
