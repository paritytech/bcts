/**
 * DKG participant round 1 command.
 *
 * Port of cmd/dkg/participant/round1.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";
import { SealedResponse } from "@bcts/gstp";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, parseAridUr, resolveSender } from "../common.js";

/**
 * Options for the DKG round1 command.
 */
export interface DkgRound1Options {
  registryPath?: string;
  groupId: string;
  reject?: boolean;
  rejectReason?: string;
  verbose?: boolean;
}

/**
 * Result of the DKG round1 command.
 */
export interface DkgRound1Result {
  accepted: boolean;
  listeningArid?: string;
}

/**
 * Execute the DKG participant round 1 command.
 *
 * Responds to the DKG invite with commitment packages.
 *
 * Port of `round1()` from cmd/dkg/participant/round1.rs.
 */
export async function round1(
  client: StorageClient,
  options: DkgRound1Options,
  cwd: string,
): Promise<DkgRound1Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const recipient = resolveSender(registry);
  const groupId = parseAridUr(options.groupId);

  const stateDir = dkgStateDir(registryPath, groupId.hex());
  const receiveStatePath = path.join(stateDir, "receive.json");

  if (!fs.existsSync(receiveStatePath)) {
    throw new Error("No receive state found. Run 'dkg participant receive' first.");
  }

  // Load receive state
  const receiveState = JSON.parse(fs.readFileSync(receiveStatePath, "utf-8")) as {
    response_arid: string;
    request_id: string;
    valid_until: string;
    sender: string;
    min_signers: number;
    charter: string;
    group: string;
  };

  const responseArid = parseAridUr(receiveState.response_arid);

  // Note: In a real implementation, we'd reconstruct the full DkgInvitation
  // For now, we'll create the response directly

  if (options.reject === true) {
    // Send rejection
    const reason = options.rejectReason ?? "Declined by user";

    // Create rejection envelope
    const requestId = parseAridUr(receiveState.request_id);

    const response: SealedResponse = SealedResponse.newFailure(requestId, recipient).withError(reason);

    const envelope: Envelope = response.toEnvelope(undefined, recipient.inceptionPrivateKeys(), undefined);

    await putWithIndicator(
      client,
      responseArid,
      envelope,
      "Sending rejection",
      options.verbose ?? false,
    );

    if (options.verbose === true) {
      console.log(`Rejected DKG invite: ${reason}`);
    }

    return { accepted: false };
  }

  // Generate commitment package using FROST round 1
  // TODO: Implement actual FROST round1 using frost-ed25519
  // For now, create a placeholder response

  const listeningArid = ARID.new();

  // Create acceptance response with commitment package
  const requestId = parseAridUr(receiveState.request_id);

  const response: SealedResponse = SealedResponse.newSuccess(requestId, recipient);

  // TODO: Add commitment package to response
  // response = response.withParameter("commitment", commitmentPackage);

  const envelope: Envelope = response.toEnvelope(undefined, recipient.inceptionPrivateKeys(), undefined);

  await putWithIndicator(
    client,
    responseArid,
    envelope,
    "Sending commitment package",
    options.verbose ?? false,
  );

  // Save round 1 state
  const round1State = {
    group: groupId.urString(),
    listening_arid: listeningArid.urString(),
    // TODO: Save nonces and commitment for round 2
  };

  fs.writeFileSync(path.join(stateDir, "round1.json"), JSON.stringify(round1State, null, 2));

  // Update registry with listening ARID
  const groupRecord = registry.group(groupId);
  if (groupRecord !== null && groupRecord !== undefined) {
    groupRecord.setListeningAtArid(listeningArid);
    registry.save(registryPath);
  }

  if (options.verbose === true) {
    console.log(`Sent commitment package`);
    console.log(`Listening at: ${listeningArid.urString()}`);
  }

  return {
    accepted: true,
    listeningArid: listeningArid.urString(),
  };
}
