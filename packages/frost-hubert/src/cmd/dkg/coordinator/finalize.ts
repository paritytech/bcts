/**
 * DKG coordinator finalize command.
 *
 * Port of cmd/dkg/coordinator/finalize.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type XID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { parallelSend } from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, parseAridUr, signingKeyFromVerifying } from "../common.js";

/**
 * Options for the DKG finalize command.
 */
export interface DkgFinalizeOptions {
  registryPath?: string;
  groupId: string;
  parallel?: boolean;
  verbose?: boolean;
}

/**
 * Result of the DKG finalize command.
 */
export interface DkgFinalizeResult {
  verifyingKey: string;
  dispatched: number;
  errors: number;
}

/**
 * Execute the DKG coordinator finalize command.
 *
 * Dispatches finalize packages to participants with the public key package.
 *
 * Port of `finalize()` from cmd/dkg/coordinator/finalize.rs.
 */
export async function finalize(
  client: StorageClient,
  options: DkgFinalizeOptions,
  cwd: string,
): Promise<DkgFinalizeResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const groupId = parseAridUr(options.groupId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  const stateDir = dkgStateDir(registryPath, groupId.hex());
  const round2StatePath = path.join(stateDir, "collected_round2.json");

  if (!fs.existsSync(round2StatePath)) {
    throw new Error("No round 2 state found. Run 'dkg coordinator round2' first.");
  }

  // Load round 2 state
  // @ts-expect-error TS6133 - intentionally unused, will be implemented
  const _round2State: unknown = JSON.parse(fs.readFileSync(round2StatePath, "utf-8"));

  // TODO: Load or generate public key package
  // For now, create a placeholder
  const publicKeyPackagePath = path.join(stateDir, "public_key_package.json");

  if (!fs.existsSync(publicKeyPackagePath)) {
    throw new Error("Public key package not found. Round 2 aggregation may have failed.");
  }

  const publicKeyPackage: unknown = JSON.parse(fs.readFileSync(publicKeyPackagePath, "utf-8"));

  // Build finalize envelopes for each participant - tuples of [xid, arid, envelope, name]
  const messages: [XID, ARID, Envelope, string][] = [];

  // TODO: Create finalize envelopes with public key package

  // Send finalize packages
  const sendResults = await parallelSend(client, messages, options.verbose);

  // Update registry with verifying key
  // TODO: Extract verifying key from public key package
  const verifyingKeyBytes = new Uint8Array(32); // Placeholder
  // @ts-expect-error TS6133 - intentionally unused, will be implemented
  const _verifyingKey = signingKeyFromVerifying(verifyingKeyBytes);
  // groupRecord.setVerifyingKey(_verifyingKey);

  registry.save(registryPath);

  // Save finalize state
  const finalizeState: { group: string; public_key_package: unknown; dispatched: number } = {
    group: groupId.urString(),
    public_key_package: publicKeyPackage,
    dispatched: result.successes.length,
  };

  fs.writeFileSync(path.join(stateDir, "finalize.json"), JSON.stringify(finalizeState, null, 2));

  if (options.verbose === true) {
    console.log(`Dispatched ${result.successes.length} finalize packages`);
    if (result.errors.size > 0) {
      console.log(`  ${result.errors.size} failed`);
    }
  }

  return {
    verifyingKey: "placeholder", // TODO: Return actual verifying key UR
    dispatched: result.successes.length,
    errors: result.errors.size,
  };
}
