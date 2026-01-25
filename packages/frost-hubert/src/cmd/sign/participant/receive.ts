/**
 * Sign participant receive command.
 *
 * Port of cmd/sign/participant/receive.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, Date as BCDate, type Date as BCDateType, type XID } from "@bcts/components";
import type { Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, parseEnvelopeUr, resolveSender } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

/**
 * Options for the sign receive command.
 */
export interface SignReceiveOptions {
  registryPath?: string;
  arid?: string;
  envelope?: string;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the sign receive command.
 */
export interface SignReceiveResult {
  sessionId: string;
  groupId: string;
  targetUr: string;
}

/**
 * Execute the sign participant receive command.
 *
 * Fetches and validates a sign invite from the coordinator.
 *
 * Port of `receive()` from cmd/sign/participant/receive.rs.
 */
export async function receive(
  client: StorageClient,
  options: SignReceiveOptions,
  cwd: string,
): Promise<SignReceiveResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const recipient = resolveSender(registry);

  let inviteEnvelope: Envelope | undefined;

  if (options.envelope !== undefined && options.envelope !== "") {
    inviteEnvelope = parseEnvelopeUr(options.envelope);
  } else if (options.arid !== undefined && options.arid !== "") {
    const arid = parseAridUr(options.arid);
    inviteEnvelope = await getWithIndicator(
      client,
      arid,
      "Fetching sign invite",
      options.timeoutSeconds,
      options.verbose ?? false,
    );

    if (inviteEnvelope === null || inviteEnvelope === undefined) {
      throw new Error("Sign invite not found at the specified ARID");
    }
  } else {
    throw new Error("Either --arid or --envelope must be specified");
  }

  // Decrypt and parse the invite
  const recipientPrivateKeys = recipient.inceptionPrivateKeys();
  if (recipientPrivateKeys === null || recipientPrivateKeys === undefined) {
    throw new Error("Recipient has no inception private keys");
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { SealedRequest: SealedRequestClass } = require("@bcts/gstp") as {
    SealedRequest: {
      tryFromEnvelope: (
        envelope: Envelope,
        expectedSender: XID | undefined,
        now: BCDate,
        recipientPrivateKeys: unknown,
      ) => SealedRequestInstance;
    };
  };

  interface SealedRequestInstance {
    request: () => RequestInstance;
    sender: () => { xid: () => XID };
  }

  interface RequestInstance {
    function: () => unknown;
    extractObjectForParameter: (name: string) => unknown;
    objectsForParameter: (name: string) => ParticipantEnvelope[];
  }

  interface ParticipantEnvelope {
    objectForPredicate: (name: string) => {
      decryptToRecipient: (keys: unknown) => {
        extractSubject: () => ARID;
      };
    };
  }

  const now: BCDateType = BCDate.now() as BCDateType;
  const sealedRequest: SealedRequestInstance = SealedRequestClass.tryFromEnvelope(
    inviteEnvelope,
    undefined,
    now,
    recipientPrivateKeys,
  );

  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { Function: FunctionClass } = require("@bcts/envelope") as {
    Function: { from: (name: string) => unknown };
  };

  // Validate function
  if (sealedRequest.request().function() !== FunctionClass.from("signInvite")) {
    throw new Error("Unexpected invite function");
  }

  // Extract parameters
  const groupId = sealedRequest.request().extractObjectForParameter("group") as ARID;
  const sessionId = sealedRequest.request().extractObjectForParameter("session") as ARID;
  const targetEnvelope = sealedRequest.request().extractObjectForParameter("target") as Envelope;
  const validUntil = sealedRequest.request().extractObjectForParameter("validUntil") as BCDateType;

  if (validUntil <= now) {
    throw new Error("Sign invite has expired");
  }

  // Find response ARID for this recipient
  const participantObjects: ParticipantEnvelope[] = sealedRequest
    .request()
    .objectsForParameter("participant");
  let responseArid: ARID | null = null;

  for (const participant of participantObjects) {
    // Try to decrypt the response ARID
    try {
      const encryptedArid = participant.objectForPredicate("response_arid");
      const decryptedEnvelope = encryptedArid.decryptToRecipient(recipientPrivateKeys);
      responseArid = decryptedEnvelope.extractSubject();
      break;
    } catch {
      // Not for this participant
      continue;
    }
  }

  if (responseArid === null) {
    throw new Error("Recipient not found in sign invite");
  }

  // Save receive state
  const stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const sessionIdStr: string = sessionId.urString();
  const groupIdStr: string = groupId.urString();
  const responseAridStr: string = responseArid.urString();
  const targetStr: string = targetEnvelope.urString();
  const validUntilStr: string = (validUntil as { toString(): string }).toString();
  const coordinatorStr: string = sealedRequest.sender().xid().urString();
  const groupRecord = registry.group(groupId);

  const receiveState = {
    session: sessionIdStr,
    group: groupIdStr,
    response_arid: responseAridStr,
    target: targetStr,
    valid_until: validUntilStr,
    coordinator: coordinatorStr,
    min_signers: groupRecord?.minSigners() ?? 0,
    participants: groupRecord?.participants().map((p) => p.xid().urString()) ?? [],
  };

  fs.writeFileSync(path.join(stateDir, "sign_receive.json"), JSON.stringify(receiveState, null, 2));

  if (options.verbose === true) {
    // eslint-disable-next-line no-console
    console.log(`Session ID: ${sessionIdStr}`);
    // eslint-disable-next-line no-console
    console.log(`Group ID: ${groupIdStr}`);
    // eslint-disable-next-line no-console
    console.log(`Response ARID: ${responseAridStr}`);
  }

  return {
    sessionId: sessionIdStr,
    groupId: groupIdStr,
    targetUr: targetStr,
  };
}
