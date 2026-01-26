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
import {
  dkgPart2,
  deserializeDkgRound1Package,
  serializeDkgRound2Package,
  identifierFromU16,
  identifierToHex,
  type SerializedDkgRound1Package,
  type DkgRound1Package,
  type DkgRound1SecretPackage,
} from "../../../frost/index.js";
import { keys, Ed25519Sha512 } from "@frosts/ed25519";

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

  // Load round 1 state with secret package
  interface Round1StateWithSecret {
    listening_arid: string;
    participant_index: number;
    secret_package: {
      identifier: number;
      coefficients: string[];
      minSigners: number;
      maxSigners: number;
      commitment: {
        coefficients: string[];
      };
    };
    our_round1_package: SerializedDkgRound1Package;
  }

  const round1State = JSON.parse(fs.readFileSync(round1StatePath, "utf-8")) as Round1StateWithSecret;

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

  // Parse round 2 request to get all round 1 packages from other participants
  // The coordinator sends all round 1 packages collected from participants
  interface Round2RequestData {
    request_id: string;
    round1_packages: Record<string, SerializedDkgRound1Package>;
  }

  // Extract data from the round 2 request envelope
  // For now, we'll assume it's in a standard format
  let round2RequestData: Round2RequestData;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const resultStr = (round2Request as { result?: () => string }).result?.() ?? "{}";
    round2RequestData = JSON.parse(resultStr) as Round2RequestData;
  } catch {
    throw new Error("Failed to parse round 2 request data");
  }

  // Reconstruct the secret package from saved state
  const { hexToBytes } = await import("../../../frost/index.js");

  const savedSecret = round1State.secret_package;
  const coefficients: (typeof Ed25519Sha512)["Scalar"][] = savedSecret.coefficients.map((hex) =>
    Ed25519Sha512.deserializeScalar(hexToBytes(hex)),
  );

  const coefficientCommitments = savedSecret.commitment.coefficients.map((hex) =>
    keys.CoefficientCommitment.deserialize(Ed25519Sha512, hexToBytes(hex)),
  );

  const commitment = keys.VerifiableSecretSharingCommitment.fromCoefficients(
    Ed25519Sha512,
    coefficientCommitments,
  );

  const identifier = identifierFromU16(savedSecret.identifier);

  const secretPackage: DkgRound1SecretPackage = new keys.dkg.round1.SecretPackage(
    Ed25519Sha512,
    identifier,
    coefficients,
    commitment,
    savedSecret.minSigners,
    savedSecret.maxSigners,
  );

  // Build round 1 packages map from coordinator data (exclude our own)
  const round1Packages = new Map<string, DkgRound1Package>();

  for (const [idHex, serializedPkg] of Object.entries(round2RequestData.round1_packages)) {
    // Skip our own package
    const ourIdHex = identifierToHex(identifier);
    if (idHex === ourIdHex) {
      continue;
    }

    const pkg = deserializeDkgRound1Package(serializedPkg);
    round1Packages.set(idHex, pkg);
  }

  // Execute FROST DKG part2
  const [round2SecretPackage, round2Packages] = dkgPart2(secretPackage, round1Packages);

  // Serialize round 2 packages to send to each recipient
  const serializedRound2Packages: Record<string, unknown> = {};
  for (const [idHex, pkg] of round2Packages) {
    serializedRound2Packages[idHex] = serializeDkgRound2Package(pkg);
  }

  // Create response ARID
  const responseArid = ARID.new();
  const newListeningArid = ARID.new();

  // Create response with secret shares
  const requestId = parseAridUr(round2RequestData.request_id);

  const response: SealedResponse = SealedResponse.newSuccess(requestId, recipient).withResult(
    JSON.stringify(serializedRound2Packages),
  );

  const envelope: Envelope = response.toEnvelope(
    undefined,
    recipient.inceptionPrivateKeys(),
    undefined,
  );

  await putWithIndicator(
    client,
    responseArid,
    envelope,
    "Sending secret shares",
    options.verbose ?? false,
  );

  // Save round 2 state with secret package for finalize
  const round2SecretData = {
    identifier: round1State.participant_index,
    commitment: savedSecret.commitment,
    secretShare: (() => {
      const { bytesToHex } = require("../../../frost/index.js") as {
        bytesToHex: (bytes: Uint8Array) => string;
      };
      return bytesToHex(Ed25519Sha512.serializeScalar(round2SecretPackage.secretShare()));
    })(),
    minSigners: round2SecretPackage.minSigners,
    maxSigners: round2SecretPackage.maxSigners,
  };

  const round2State = {
    group: groupId.urString(),
    listening_arid: newListeningArid.urString(),
    round2_secret_package: round2SecretData,
    round1_packages: round2RequestData.round1_packages,
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
