/**
 * DKG coordinator round 2 command.
 *
 * Port of cmd/dkg/coordinator/round2.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type XID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { parallelFetch, type CollectionResult } from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, parseAridUr } from "../common.js";

/**
 * Options for the DKG round2 command.
 */
export interface DkgRound2Options {
  registryPath?: string;
  groupId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the DKG round2 command.
 */
export interface DkgRound2Result {
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
  publicKeyPackage?: string;
}

/**
 * Execute the DKG coordinator round 2 command.
 *
 * Collects secret shares from participants and generates the public key package.
 *
 * Port of `round2()` from cmd/dkg/coordinator/round2.rs.
 */
export async function round2(
  client: StorageClient,
  options: DkgRound2Options,
  cwd: string,
): Promise<DkgRound2Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const groupId = parseAridUr(options.groupId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  const stateDir = dkgStateDir(registryPath, groupId.hex());
  const round1StatePath = path.join(stateDir, "collected_round1.json");

  if (!fs.existsSync(round1StatePath)) {
    throw new Error("No round 1 state found. Run 'dkg coordinator round1' first.");
  }

  // Load round 1 state to get commitment packages
  // @ts-expect-error TS6133 - intentionally unused, will be implemented
  const _round1State: unknown = JSON.parse(fs.readFileSync(round1StatePath, "utf-8"));

  // Build targets for parallel fetch (from pending requests)
  const pendingRequests = groupRecord.pendingRequests();
  const targets: { xid: XID; arid: ARID }[] = [];

  for (const [xid, arid] of pendingRequests.iterCollect()) {
    targets.push({ xid, arid });
  }

  // Collect responses
  const responses: CollectionResult<unknown> = await parallelFetch(
    client,
    targets,
    (envelope: Envelope, xid: XID) => {
      // Parse the response envelope
      // Extract secret share from response
      return { envelope, xid };
    },
    {
      timeoutSeconds: options.timeoutSeconds,
      verbose: options.verbose,
    },
  );

  // Save collected responses
  const collectedPath = path.join(stateDir, "collected_round2.json");
  const collected: Record<string, unknown> = {};

  for (const [xidUr, data] of responses.successes) {
    collected[xidUr] = data;
  }

  fs.writeFileSync(collectedPath, JSON.stringify(collected, null, 2));

  // TODO: Generate public key package from collected shares
  // This would use frost-ed25519 DKG aggregation

  // Update registry
  groupRecord.clearPendingRequests();
  registry.save(registryPath);

  if (options.verbose === true) {
    console.log(`Collected ${responses.successes.size} secret shares`);
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
