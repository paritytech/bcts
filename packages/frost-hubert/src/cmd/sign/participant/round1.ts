/**
 * Sign participant round 1 command.
 *
 * Port of cmd/sign/participant/round1.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID } from "@bcts/components";
import type { Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, resolveSender, dkgStateDir } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";
import {
  signingRound1,
  deserializeKeyPackage,
  serializeSigningNonces,
  serializeSigningCommitments,
  createRng,
  type SerializedKeyPackage,
  type SerializedSigningNonces,
  type SerializedSigningCommitments,
} from "../../../frost/index.js";

/**
 * Options for the sign round1 command.
 */
export interface SignRound1Options {
  registryPath?: string;
  sessionId: string;
  groupId?: string;
  reject?: boolean;
  rejectReason?: string;
  verbose?: boolean;
}

/**
 * Result of the sign round1 command.
 */
export interface SignRound1Result {
  accepted: boolean;
  listeningArid?: string;
}

/**
 * Execute the sign participant round 1 command.
 *
 * Responds to the sign invite with signing commitments.
 *
 * Port of `round1()` from cmd/sign/participant/round1.rs.
 */
export async function round1(
  client: StorageClient,
  options: SignRound1Options,
  cwd: string,
): Promise<SignRound1Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const recipient = resolveSender(registry);
  const sessionId = parseAridUr(options.sessionId);

  // Find receive state
  let groupId: ARID | undefined;
  let stateDir: string | undefined;
  let receiveStatePath: string | undefined;

  if (options.groupId !== undefined && options.groupId !== "") {
    groupId = parseAridUr(options.groupId);

    stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
    receiveStatePath = path.join(stateDir, "sign_receive.json");
  } else {
    // Search for session in group-state directories
    const base = path.dirname(registryPath);
    const groupStateDir = path.join(base, "group-state");

    if (!fs.existsSync(groupStateDir)) {
      throw new Error("No signing state found. Run 'sign participant receive' first.");
    }

    for (const groupDir of fs.readdirSync(groupStateDir)) {
      const candidate = path.join(
        groupStateDir,
        groupDir,
        "signing",
        sessionId.hex(),
        "sign_receive.json",
      );
      if (fs.existsSync(candidate)) {
        receiveStatePath = candidate;
        stateDir = path.dirname(candidate);
        groupId = ARID.fromHex(groupDir);
        break;
      }
    }

    if (receiveStatePath === undefined || receiveStatePath === "") {
      throw new Error("Signing session not found. Run 'sign participant receive' first.");
    }
  }

  if (receiveStatePath === undefined || !fs.existsSync(receiveStatePath)) {
    throw new Error("No receive state found. Run 'sign participant receive' first.");
  }

  // Load receive state
  const receiveState = JSON.parse(fs.readFileSync(receiveStatePath, "utf-8")) as {
    response_arid: string;
    target: string;
  };

  const responseArid = parseAridUr(receiveState.response_arid);

  if (options.reject === true) {
    // Send rejection
    const reason = options.rejectReason ?? "Declined by user";

    // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
    const { SealedResponse: SealedResponseClass } = require("@bcts/gstp") as {
      SealedResponse: {
        newFailure: (
          requestId: ARID,
          recipient: unknown,
        ) => {
          withError: (reason: string) => {
            toEnvelope: (
              senderXid: unknown,
              recipientPrivateKeys: unknown,
              extra: unknown,
            ) => Envelope;
          };
        };
      };
    };
    const requestId = ARID.new(); // Would be extracted from receive state

    const response = SealedResponseClass.newFailure(requestId, recipient);
    const responseWithError = response.withError(reason);
    const envelope: Envelope = responseWithError.toEnvelope(
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
      console.log(`Rejected sign invite: ${reason}`);
    }

    return { accepted: false };
  }

  if (stateDir === undefined) {
    throw new Error("State directory not found");
  }

  if (groupId === undefined) {
    throw new Error("Group ID not found");
  }

  // Load key package from DKG
  const dkgStatePath = dkgStateDir(registryPath, groupId.hex());
  const keyPackagePath = path.join(dkgStatePath, "key_package.json");

  if (!fs.existsSync(keyPackagePath)) {
    throw new Error("Key package not found. Complete DKG first.");
  }

  // Load and deserialize the key package
  interface KeyPackageFile {
    group: string;
    key_package: SerializedKeyPackage;
  }

  const keyPackageFile = JSON.parse(fs.readFileSync(keyPackagePath, "utf-8")) as KeyPackageFile;
  const keyPackage = deserializeKeyPackage(keyPackageFile.key_package);

  // Generate signing commitment using FROST round 1
  const rng = createRng();
  const [nonces, commitments] = signingRound1(keyPackage, rng);

  // Serialize for storage and transmission
  const serializedNonces = serializeSigningNonces(nonces);
  const serializedCommitments = serializeSigningCommitments(commitments);

  const listeningArid = ARID.new();

  // Create acceptance response with commitment
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { SealedResponse: SealedResponseClassAccept } = require("@bcts/gstp") as {
    SealedResponse: {
      newSuccess: (
        requestId: ARID,
        recipient: unknown,
      ) => {
        withResult: (result: string) => {
          toEnvelope: (senderXid: unknown, recipientPrivateKeys: unknown, extra: unknown) => Envelope;
        };
      };
    };
  };
  const requestId = ARID.new(); // Would be extracted from receive state

  const response = SealedResponseClassAccept.newSuccess(requestId, recipient).withResult(
    JSON.stringify(serializedCommitments),
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
    "Sending signing commitment",
    options.verbose ?? false,
  );

  // Save round 1 state with nonces for round 2
  const groupIdStr: string = groupId.urString();
  const commitState: {
    session: string;
    group: string;
    listening_arid: string;
    nonces: SerializedSigningNonces;
    commitments: SerializedSigningCommitments;
  } = {
    session: sessionId.urString(),
    group: groupIdStr,
    listening_arid: listeningArid.urString(),
    nonces: serializedNonces,
    commitments: serializedCommitments,
  };

  fs.writeFileSync(path.join(stateDir, "commit.json"), JSON.stringify(commitState, null, 2));

  // Update registry with listening ARID
  const groupRecord = registry.group(groupId);
  if (groupRecord !== null && groupRecord !== undefined) {
    groupRecord.setListeningAtArid(listeningArid);
    registry.save(registryPath);
  }

  if (options.verbose === true) {
    console.log(`Sent signing commitment`);
    console.log(`Listening at: ${listeningArid.urString()}`);
  }

  return {
    accepted: true,
    listeningArid: listeningArid.urString(),
  };
}
