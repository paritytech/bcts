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
/* eslint-disable @typescript-eslint/unbound-method */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { SealedRequest } from "@bcts/gstp";
import { UR } from "@bcts/uniform-resources";

import { Registry, resolveRegistryPath, PendingRequests } from "../../../registry/index.js";
import { putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, resolveSender } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

/**
 * Options for the sign invite command.
 */
export interface SignInviteOptions {
  registryPath?: string;
  groupId: string;
  targetFile: string;
  validDays?: number;
  verbose?: boolean;
}

/**
 * Result of the sign invite command.
 */
export interface SignInviteResult {
  sessionId: string;
  startArid: string;
}

/**
 * Execute the sign coordinator invite command.
 *
 * Invites participants to sign a target envelope.
 *
 * Port of `invite()` from cmd/sign/coordinator/invite.rs.
 */
export async function invite(
  client: StorageClient,
  options: SignInviteOptions,
  cwd: string,
): Promise<SignInviteResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const sender = resolveSender(registry);
  const groupId = parseAridUr(options.groupId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  // Validate sender is coordinator
  if (sender.xid().toString() !== groupRecord.coordinator().xid().toString()) {
    throw new Error("Only the coordinator can initiate signing");
  }

  // Load target envelope
  const targetPath = path.resolve(cwd, options.targetFile);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target file not found: ${targetPath}`);
  }

  const targetUr = fs.readFileSync(targetPath, "utf-8").trim();
  const ur = UR.fromURString(targetUr);
  const targetEnvelope = Envelope.fromCbor(ur.cbor);

  // Generate session ID and start ARID
  const sessionId = ARID.new();
  const startArid = ARID.new();

  // Calculate dates
  const now = new Date();
  const validDays = options.validDays ?? 7;
  const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

  // Generate response ARIDs for each participant
  const pendingRequests = new PendingRequests();
  const participantArids: { xid: string; responseArid: string }[] = [];

  for (const participant of groupRecord.participants()) {
    const responseArid = ARID.new();
    pendingRequests.addCollectOnly(participant.xid(), responseArid);
    participantArids.push({
      xid: participant.xid().urString(),
      responseArid: responseArid.urString(),
    });
  }

  // Create signInvite request
  let request = SealedRequest.create("signInvite", ARID.new(), sender)
    .withParameter("group", groupId)
    .withParameter("session", sessionId)
    .withParameter("target", targetEnvelope)
    .withParameter("validUntil", validUntil)
    .withDate(now);

  // Add participant entries with encrypted response ARIDs
  for (const participant of groupRecord.participants()) {
    const participantRecord = registry.participant(participant.xid());
    if (participantRecord === undefined) {
      throw new Error(`Participant ${participant.xid().urString()} not found in registry`);
    }

    const responseArid = participantArids.find(
      (p) => p.xid === participant.xid().urString(),
    )?.responseArid;

    if (responseArid === undefined) {
      throw new Error("Response ARID not found for participant");
    }

    // Encrypt response ARID to participant
    const encryptionKey = participantRecord.xidDocument().encryptionKey();
    if (encryptionKey === undefined) {
      throw new Error("Participant has no encryption key");
    }

    const arid = parseAridUr(responseArid);
    const encryptedArid = Envelope.fromSubject(arid).encryptToRecipient(encryptionKey);

    request = request.withParameter("participant", {
      xid: participant.xid(),
      response_arid: encryptedArid,
    });
  }

  // Create sealed envelope
  const recipients = groupRecord
    .participants()
    .map((p) => {
      const record = registry.participant(p.xid());
      return record?.xidDocument();
    })
    .filter(Boolean);

  const envelope = request.toEnvelopeForRecipients(
    validUntil,
    sender.inceptionPrivateKeys(),
    recipients,
  );

  // Send to storage
  await putWithIndicator(
    client,
    startArid,
    envelope,
    "Sending sign invite",
    options.verbose ?? false,
  );

  // Update registry with pending requests
  groupRecord.setPendingRequests(pendingRequests);
  registry.save(registryPath);

  // Save session state
  const stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const sessionState = {
    session: sessionId.urString(),
    group: groupId.urString(),
    start_arid: startArid.urString(),
    target: targetUr,
    valid_until: validUntil.toString(),
    participants: participantArids,
  };

  fs.writeFileSync(path.join(stateDir, "invite.json"), JSON.stringify(sessionState, null, 2));

  if (options.verbose === true) {
    console.log(`Session ID: ${sessionId.urString()}`);
    console.log(`Start ARID: ${startArid.urString()}`);
  }

  return {
    sessionId: sessionId.urString(),
    startArid: startArid.urString(),
  };
}
