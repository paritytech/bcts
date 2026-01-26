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
import {
  dkgPart1,
  identifierFromU16,
  serializeDkgRound1Package,
  createRng,
  type SerializedDkgRound1Package,
} from "../../../frost/index.js";

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

    const response: SealedResponse = SealedResponse.newFailure(requestId, recipient).withError(
      reason,
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
      "Sending rejection",
      options.verbose ?? false,
    );

    if (options.verbose === true) {
      console.log(`Rejected DKG invite: ${reason}`);
    }

    return { accepted: false };
  }

  // Generate commitment package using FROST round 1
  const minSigners = receiveState.min_signers;

  // Get participant index from registry
  const groupRecord = registry.group(groupId);
  if (groupRecord === null || groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  // Find our participant index in the group
  const participants = groupRecord.participants();
  const ourXid = recipient.xid();
  let participantIndex = 0;
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (p !== undefined && p.xid().toString() === ourXid.toString()) {
      participantIndex = i + 1; // FROST uses 1-indexed identifiers
      break;
    }
  }

  if (participantIndex === 0) {
    throw new Error("Could not find our participant entry in the group");
  }

  const maxSigners = participants.length;
  const identifier = identifierFromU16(participantIndex);

  // Execute FROST DKG part1
  const rng = createRng();
  const [secretPackage, round1Package] = dkgPart1(identifier, maxSigners, minSigners, rng);

  // Serialize the round 1 package for transmission
  const serializedPackage = serializeDkgRound1Package(round1Package);

  const listeningArid = ARID.new();

  // Create acceptance response with commitment package
  const requestId = parseAridUr(receiveState.request_id);

  const response: SealedResponse = SealedResponse.newSuccess(requestId, recipient).withResult(
    JSON.stringify(serializedPackage),
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
    "Sending commitment package",
    options.verbose ?? false,
  );

  // Save round 1 state including secret package for round 2
  // Note: In production, the secret package should be encrypted at rest
  const secretPackageData = {
    identifier: participantIndex,
    coefficients: secretPackage.coefficients().map((c: unknown) => {
      // Convert scalar to hex string for storage
      const { bytesToHex } = require("../../../frost/index.js") as {
        bytesToHex: (bytes: Uint8Array) => string;
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const { Ed25519Sha512 } = require("@frosts/ed25519");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return bytesToHex(Ed25519Sha512.serializeScalar(c) as Uint8Array);
    }),
    minSigners: secretPackage.minSigners,
    maxSigners: secretPackage.maxSigners,
    commitment: serializedPackage.commitment,
  };

  const round1State: {
    group: string;
    listening_arid: string;
    participant_index: number;
    secret_package: typeof secretPackageData;
    our_round1_package: SerializedDkgRound1Package;
  } = {
    group: groupId.urString(),
    listening_arid: listeningArid.urString(),
    participant_index: participantIndex,
    secret_package: secretPackageData,
    our_round1_package: serializedPackage,
  };

  fs.writeFileSync(path.join(stateDir, "round1.json"), JSON.stringify(round1State, null, 2));

  // Update registry with listening ARID (groupRecord already defined above)
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
