/**
 * DKG participant receive command.
 *
 * Port of cmd/dkg/participant/receive.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { CborDate } from "@bcts/dcbor";

import { DkgInvitation } from "../../../dkg/index.js";
import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, parseAridUr, parseEnvelopeUr, resolveSender } from "../common.js";

/**
 * Options for the DKG receive command.
 */
export interface DkgReceiveOptions {
  registryPath?: string;
  arid?: string;
  envelope?: string;
  timeoutSeconds?: number;
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
}

/**
 * Execute the DKG participant receive command.
 *
 * Fetches and validates a DKG invite from the coordinator.
 *
 * Port of `receive()` from cmd/dkg/participant/receive.rs.
 */
export async function receive(
  client: StorageClient,
  options: DkgReceiveOptions,
  cwd: string,
): Promise<DkgReceiveResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const recipient = resolveSender(registry);

  let inviteEnvelope;

  if (options.envelope !== undefined && options.envelope !== "") {
    // Parse envelope directly from UR string
    inviteEnvelope = parseEnvelopeUr(options.envelope);
  } else if (options.arid !== undefined && options.arid !== "") {
    // Fetch envelope from storage
    const arid = parseAridUr(options.arid);
    inviteEnvelope = await getWithIndicator(
      client,
      arid,
      "Fetching DKG invite",
      options.timeoutSeconds,
      options.verbose ?? false,
    );

    if (inviteEnvelope === null || inviteEnvelope === undefined) {
      throw new Error("DKG invite not found at the specified ARID");
    }
  } else {
    throw new Error("Either --arid or --envelope must be specified");
  }

  // Parse the invitation
  const now = CborDate.now().datetime();

  const invitation = DkgInvitation.fromInvite(
    inviteEnvelope,
    now,
    undefined, // No expected sender validation
    recipient,
  );

  // Save receive state
  const stateDir = dkgStateDir(registryPath, invitation.groupId().hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const validUntilStr: string = (invitation.validUntil() as { toString(): string }).toString();
  const receiveState = {
    group: invitation.groupId().urString(),
    request_id: invitation.requestId().urString(),
    response_arid: invitation.responseArid().urString(),
    valid_until: validUntilStr,
    min_signers: invitation.minSigners(),
    charter: invitation.charter(),
    sender: invitation.sender().xid().urString(),
  };

  fs.writeFileSync(path.join(stateDir, "receive.json"), JSON.stringify(receiveState, null, 2));

  if (options.verbose === true) {
    console.log(`Group ID: ${invitation.groupId().urString()}`);
    console.log(`Min signers: ${invitation.minSigners()}`);
    console.log(`Charter: ${invitation.charter()}`);
    console.log(`Valid until: ${String(invitation.validUntil())}`);
    console.log(`Response ARID: ${invitation.responseArid().urString()}`);
  }

  const resultValidUntilStr: string = (
    invitation.validUntil() as { toString(): string }
  ).toString();
  return {
    groupId: invitation.groupId().urString(),
    requestId: invitation.requestId().urString(),
    minSigners: invitation.minSigners(),
    charter: invitation.charter(),
    validUntil: resultValidUntilStr,
    responseArid: invitation.responseArid().urString(),
  };
}
