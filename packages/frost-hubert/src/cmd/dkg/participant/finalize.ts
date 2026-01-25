/**
 * DKG participant finalize command.
 *
 * Port of cmd/dkg/participant/finalize.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { dkgStateDir, parseAridUr, signingKeyFromVerifying } from "../common.js";

/**
 * Options for the DKG finalize command.
 */
export interface DkgFinalizeOptions {
  registryPath?: string;
  groupId: string;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the DKG finalize command.
 */
export interface DkgFinalizeResult {
  verifyingKey: string;
  keyPackagePath: string;
}

/**
 * Execute the DKG participant finalize command.
 *
 * Receives the finalize package and saves the key package.
 *
 * Port of `finalize()` from cmd/dkg/participant/finalize.rs.
 */
export async function finalize(
  client: StorageClient,
  options: DkgFinalizeOptions,
  cwd: string,
): Promise<DkgFinalizeResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const groupId = parseAridUr(options.groupId);

  const stateDir = dkgStateDir(registryPath, groupId.hex());
  const round2StatePath = path.join(stateDir, "round2.json");

  if (!fs.existsSync(round2StatePath)) {
    throw new Error("No round 2 state found. Run 'dkg participant round2' first.");
  }

  // Load round 2 state
  const round2State = JSON.parse(fs.readFileSync(round2StatePath, "utf-8")) as {
    listening_arid: string;
  };

  const listeningArid = parseAridUr(round2State.listening_arid);

  // Fetch finalize package from coordinator
  const finalizeEnvelope = await getWithIndicator(
    client,
    listeningArid,
    "Fetching finalize package",
    options.timeoutSeconds,
    options.verbose ?? false,
  );

  if (finalizeEnvelope === null || finalizeEnvelope === undefined) {
    throw new Error("Finalize package not found. The coordinator may not have sent it yet.");
  }

  // Validate and parse finalize package
  // TODO: Validate sender, extract public key package

  // TODO: Compute key package from DKG state and public key package
  // const keyPackage = computeKeyPackage(round1State, round2State, publicKeyPackage);

  // Placeholder verifying key
  const verifyingKeyBytes = new Uint8Array(32);
  // @ts-expect-error TS6133 - intentionally unused, will be implemented
  const _verifyingKey = signingKeyFromVerifying(verifyingKeyBytes);

  // Save key package
  const keyPackagePath = path.join(stateDir, "key_package.json");
  const keyPackageData = {
    group: groupId.urString(),
    // TODO: Add actual key package data
  };

  fs.writeFileSync(keyPackagePath, JSON.stringify(keyPackageData, null, 2));

  // Save public key package
  const publicKeyPackagePath = path.join(stateDir, "public_key_package.json");
  fs.writeFileSync(publicKeyPackagePath, JSON.stringify({ placeholder: true }, null, 2));

  // Update registry with verifying key
  const groupRecord = registry.group(groupId);
  if (groupRecord !== null && groupRecord !== undefined) {
    groupRecord.clearListeningAtArid();
    // TODO: Set verifying key
    // groupRecord.setVerifyingKey(_verifyingKey);
    registry.save(registryPath);
  }

  if (options.verbose === true) {
    console.log(`Saved key package to: ${keyPackagePath}`);
    console.log(`Verifying key: placeholder`);
  }

  return {
    verifyingKey: "placeholder",
    keyPackagePath,
  };
}
