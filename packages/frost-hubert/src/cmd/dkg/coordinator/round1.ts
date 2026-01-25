/**
 * DKG coordinator round 1 command.
 *
 * Port of cmd/dkg/coordinator/round1.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, XID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { parallelFetch, type CollectionResult } from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, parseAridUr } from "../common.js";

/**
 * Options for the DKG round1 command.
 */
export interface DkgRound1Options {
  registryPath?: string;
  groupId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the DKG round1 command.
 */
export interface DkgRound1Result {
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
}

/**
 * Execute the DKG coordinator round 1 command.
 *
 * Collects commitment packages from participants.
 *
 * Port of `round1()` from cmd/dkg/coordinator/round1.rs.
 */
export async function round1(
  client: StorageClient,
  options: DkgRound1Options,
  cwd: string,
): Promise<DkgRound1Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const groupId = parseAridUr(options.groupId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  const stateDir = dkgStateDir(registryPath, groupId.hex());
  const inviteStatePath = path.join(stateDir, "invite.json");

  if (!fs.existsSync(inviteStatePath)) {
    throw new Error("No invite state found. Run 'dkg coordinator invite' first.");
  }

  // Load invite state to get response ARIDs
  const inviteState = JSON.parse(fs.readFileSync(inviteStatePath, "utf-8")) as {
    participants: { xid: string; response_arid: string }[];
  };

  // Build targets for parallel fetch
  const targets: { xid: XID; arid: ARID }[] = inviteState.participants.map((p) => ({
    xid: XID.fromURString(p.xid),
    arid: parseAridUr(p.response_arid),
  }));

  // Collect responses
  const responses: CollectionResult<unknown> = await parallelFetch(
    client,
    targets,
    (envelope: Envelope, xid: XID) => {
      // Parse the response envelope
      // Extract commitment package from response
      // For now, return the envelope for further processing
      return { envelope, xid };
    },
    {
      timeoutSeconds: options.timeoutSeconds,
      verbose: options.verbose,
    },
  );

  // Save collected responses
  const collectedPath = path.join(stateDir, "collected_round1.json");
  const collected: Record<string, unknown> = {};

  for (const [xidUr, data] of responses.successes) {
    collected[xidUr] = data;
  }

  fs.writeFileSync(collectedPath, JSON.stringify(collected, null, 2));

  // Update registry pending requests for round 2
  registry.save(registryPath);

  if (options.verbose === true) {
    console.log(`Collected ${responses.successes.size} commitment packages`);
    console.log(`  ${responses.rejections.size} rejections`);
    console.log(`  ${responses.errors.size} errors`);
    console.log(`  ${responses.timeouts.length} timeouts`);
  }

  return {
    accepted: responses.successes.size,
    rejected: responses.rejections.size,
    errors: responses.errors.size,
    timeouts: responses.timeouts.length,
  };
}
