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
import {
  dkgPart3,
  deserializeDkgRound1Package,
  deserializeDkgRound2Package,
  identifierFromU16,
  identifierToHex,
  serializeKeyPackage,
  serializePublicKeyPackage,
  hexToBytes,
  type SerializedDkgRound1Package,
  type SerializedDkgRound2Package,
  type DkgRound1Package,
  type DkgRound2Package,
  type DkgRound2SecretPackage,
} from "../../../frost/index.js";
import { keys, Ed25519Sha512 } from "@frosts/ed25519";

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

  // Load round 2 state with secret package and round 1 packages
  interface Round2StateWithData {
    listening_arid: string;
    round2_secret_package: {
      identifier: number;
      commitment: {
        coefficients: string[];
      };
      secretShare: string;
      minSigners: number;
      maxSigners: number;
    };
    round1_packages: Record<string, SerializedDkgRound1Package>;
  }

  const round2State = JSON.parse(fs.readFileSync(round2StatePath, "utf-8")) as Round2StateWithData;

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

  // Parse finalize package to get round 2 packages from all participants
  interface FinalizeData {
    round2_packages: Record<string, SerializedDkgRound2Package>;
  }

  let finalizeData: FinalizeData;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const resultStr = (finalizeEnvelope as { result?: () => string }).result?.() ?? "{}";
    finalizeData = JSON.parse(resultStr) as FinalizeData;
  } catch {
    throw new Error("Failed to parse finalize data");
  }

  // Reconstruct the round 2 secret package
  const savedSecret = round2State.round2_secret_package;
  const identifier = identifierFromU16(savedSecret.identifier);

  const coefficientCommitments = savedSecret.commitment.coefficients.map((hex) =>
    keys.CoefficientCommitment.deserialize(Ed25519Sha512, hexToBytes(hex)),
  );

  const commitment = keys.VerifiableSecretSharingCommitment.fromCoefficients(
    Ed25519Sha512,
    coefficientCommitments,
  );

  const secretShareScalar = Ed25519Sha512.deserializeScalar(hexToBytes(savedSecret.secretShare));

  const round2SecretPackage: DkgRound2SecretPackage = new keys.dkg.round2.SecretPackage(
    Ed25519Sha512,
    identifier,
    commitment,
    secretShareScalar,
    savedSecret.minSigners,
    savedSecret.maxSigners,
  );

  // Build round 1 packages map
  const round1Packages = new Map<string, DkgRound1Package>();
  for (const [idHex, serializedPkg] of Object.entries(round2State.round1_packages)) {
    const ourIdHex = identifierToHex(identifier);
    if (idHex === ourIdHex) {
      continue;
    }
    const pkg = deserializeDkgRound1Package(serializedPkg);
    round1Packages.set(idHex, pkg);
  }

  // Build round 2 packages map from finalize data (exclude our own)
  const round2Packages = new Map<string, DkgRound2Package>();
  for (const [idHex, serializedPkg] of Object.entries(finalizeData.round2_packages)) {
    const ourIdHex = identifierToHex(identifier);
    if (idHex === ourIdHex) {
      continue;
    }
    const pkg = deserializeDkgRound2Package(serializedPkg);
    round2Packages.set(idHex, pkg);
  }

  // Execute FROST DKG part3 (finalize)
  const [keyPackage, publicKeyPackage] = await dkgPart3(
    round2SecretPackage,
    round1Packages,
    round2Packages,
  );

  // Serialize and save key package
  const serializedKeyPackage = serializeKeyPackage(keyPackage);
  const keyPackagePath = path.join(stateDir, "key_package.json");
  const keyPackageData = {
    group: groupId.urString(),
    key_package: serializedKeyPackage,
  };

  fs.writeFileSync(keyPackagePath, JSON.stringify(keyPackageData, null, 2));

  // Serialize and save public key package
  const serializedPublicKeyPackage = serializePublicKeyPackage(publicKeyPackage);
  const publicKeyPackagePath = path.join(stateDir, "public_key_package.json");
  fs.writeFileSync(
    publicKeyPackagePath,
    JSON.stringify(
      {
        group: groupId.urString(),
        public_key_package: serializedPublicKeyPackage,
      },
      null,
      2,
    ),
  );

  // Get the verifying key bytes for registry update
  const verifyingKeyBytes = keyPackage.verifyingKey.serialize();
  const verifyingKey = signingKeyFromVerifying(verifyingKeyBytes);

  // Update registry with verifying key
  const groupRecord = registry.group(groupId);
  if (groupRecord !== null && groupRecord !== undefined) {
    groupRecord.clearListeningAtArid();
    // Set verifying key if the method exists
    if (typeof (groupRecord as { setVerifyingKey?: (key: unknown) => void }).setVerifyingKey === "function") {
      (groupRecord as { setVerifyingKey: (key: unknown) => void }).setVerifyingKey(verifyingKey);
    }
    registry.save(registryPath);
  }

  // Create UR string for verifying key
  const verifyingKeyHex = Array.from(verifyingKeyBytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");

  if (options.verbose === true) {
    console.log(`Saved key package to: ${keyPackagePath}`);
    console.log(`Verifying key: ${verifyingKeyHex}`);
  }

  return {
    verifyingKey: verifyingKeyHex,
    keyPackagePath,
  };
}
