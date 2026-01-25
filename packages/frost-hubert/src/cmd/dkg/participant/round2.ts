/**
 * DKG participant round 2 command.
 *
 * Port of cmd/dkg/participant/round2.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";
import { SealedResponse } from "@bcts/gstp";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator, putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, parseAridUr, resolveSender } from "../common.js";

/**
 * Options for the DKG round2 command.
 */
export interface DkgRound2Options {
  registryPath?: string;
  groupId: string;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the DKG round2 command.
 */
export interface DkgRound2Result {
  listeningArid: string;
}

/**
 * Execute the DKG participant round 2 command.
 *
 * Receives round 2 request and sends secret shares.
 *
 * Port of `round2()` from cmd/dkg/participant/round2.rs.
 */
export async function round2(
  client: StorageClient,
  options: DkgRound2Options,
  cwd: string,
): Promise<DkgRound2Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const recipient = resolveSender(registry);
  const groupId = parseAridUr(options.groupId);

  const stateDir = dkgStateDir(registryPath, groupId.hex());
  const round1StatePath = path.join(stateDir, "round1.json");

  if (!fs.existsSync(round1StatePath)) {
    throw new Error("No round 1 state found. Run 'dkg participant round1' first.");
  }

  // Load round 1 state
  const round1State = JSON.parse(fs.readFileSync(round1StatePath, "utf-8")) as {
    listening_arid: string;
  };

  const listeningArid = parseAridUr(round1State.listening_arid);

  // Fetch round 2 request from coordinator
  const round2Request = await getWithIndicator(
    client,
    listeningArid,
    "Fetching round 2 request",
    options.timeoutSeconds,
    options.verbose ?? false,
  );

  if (round2Request === null || round2Request === undefined) {
    throw new Error("Round 2 request not found. The coordinator may not have sent it yet.");
  }

  // Validate and parse round 2 request
  // TODO: Validate sender, extract commitments from all participants

  // Generate secret shares using FROST round 2
  // TODO: Implement actual FROST round2 using frost-ed25519

  // Create response ARID
  const responseArid = ARID.new();
  const newListeningArid = ARID.new();

  // Create response with secret shares
  // TODO: Extract request ID from round2Request
  const requestId = ARID.new(); // Placeholder

  const response: SealedResponse = SealedResponse.newSuccess(requestId, recipient);
  // TODO: Add secret shares to response

  const envelope: Envelope = response.toEnvelope(undefined, recipient.inceptionPrivateKeys(), undefined);

  await putWithIndicator(
    client,
    responseArid,
    envelope,
    "Sending secret shares",
    options.verbose ?? false,
  );

  // Save round 2 state
  const round2State = {
    group: groupId.urString(),
    listening_arid: newListeningArid.urString(),
    // TODO: Save secret shares for finalize
  };

  fs.writeFileSync(path.join(stateDir, "round2.json"), JSON.stringify(round2State, null, 2));

  // Update registry with new listening ARID
  const groupRecord = registry.group(groupId);
  if (groupRecord !== null && groupRecord !== undefined) {
    groupRecord.setListeningAtArid(newListeningArid);
    registry.save(registryPath);
  }

  if (options.verbose === true) {
    console.log(`Sent secret shares`);
    console.log(`Listening at: ${newListeningArid.urString()}`);
  }

  return {
    listeningArid: newListeningArid.urString(),
  };
}
