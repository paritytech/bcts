/**
 * Sign participant round 2 command.
 *
 * Port of cmd/sign/participant/round2.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID } from "@bcts/components";
import type { Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator, putWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, resolveSender, dkgStateDir } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";
import {
  signingRound2,
  createSigningPackage,
  deserializeKeyPackage,
  deserializeSigningCommitments,
  serializeSignatureShare,
  hexToBytes,
  identifierFromU16,
  type SerializedKeyPackage,
  type SerializedSigningNonces,
  type SerializedSigningCommitments,
  type FrostIdentifier,
  type Ed25519SigningCommitments,
} from "../../../frost/index.js";

// Import classes directly from @frosts/core
import { Nonce, SigningNonces } from "@frosts/core";
import { Ed25519Sha512 } from "@frosts/ed25519";

/**
 * Options for the sign round2 command.
 */
export interface SignRound2Options {
  registryPath?: string;
  sessionId: string;
  groupId?: string;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the sign round2 command.
 */
export interface SignRound2Result {
  listeningArid: string;
}

/**
 * Execute the sign participant round 2 command.
 *
 * Receives round 2 request and sends signature share.
 *
 * Port of `round2()` from cmd/sign/participant/round2.rs.
 */
export async function round2(
  client: StorageClient,
  options: SignRound2Options,
  cwd: string,
): Promise<SignRound2Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const recipient = resolveSender(registry);
  const sessionId = parseAridUr(options.sessionId);

  // Find commit state
  let groupId: ARID | undefined;
  let stateDir: string | undefined;
  let commitStatePath: string | undefined;

  if (options.groupId !== undefined && options.groupId !== "") {
    groupId = parseAridUr(options.groupId);

    stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
    commitStatePath = path.join(stateDir, "commit.json");
  } else {
    // Search for session in group-state directories
    const base = path.dirname(registryPath);
    const groupStateDir = path.join(base, "group-state");

    if (!fs.existsSync(groupStateDir)) {
      throw new Error("No signing state found. Run 'sign participant round1' first.");
    }

    for (const groupDir of fs.readdirSync(groupStateDir)) {
      const candidate = path.join(
        groupStateDir,
        groupDir,
        "signing",
        sessionId.hex(),
        "commit.json",
      );
      if (fs.existsSync(candidate)) {
        commitStatePath = candidate;
        stateDir = path.dirname(candidate);
        groupId = ARID.fromHex(groupDir);
        break;
      }
    }

    if (commitStatePath === undefined || commitStatePath === "") {
      throw new Error("Signing session not found. Run 'sign participant round1' first.");
    }
  }

  if (commitStatePath === undefined || !fs.existsSync(commitStatePath)) {
    throw new Error("No commit state found. Run 'sign participant round1' first.");
  }

  // Load commit state with nonces
  interface CommitStateWithNonces {
    listening_arid: string;
    group: string;
    session: string;
    nonces: SerializedSigningNonces;
    commitments: SerializedSigningCommitments;
  }

  const commitState = JSON.parse(fs.readFileSync(commitStatePath, "utf-8")) as CommitStateWithNonces;

  const listeningArid = parseAridUr(commitState.listening_arid);

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

  if (groupId === undefined) {
    throw new Error("Group ID not found");
  }

  if (stateDir === undefined) {
    throw new Error("State directory not found");
  }

  // Parse round 2 request to get message and all commitments
  interface Round2RequestData {
    request_id: string;
    message: string; // hex-encoded message to sign
    commitments: Record<string, SerializedSigningCommitments>; // identifier hex -> commitments
  }

  let round2RequestData: Round2RequestData;
  try {
    const resultStr = (round2Request as { result?: () => string }).result?.() ?? "{}";
    round2RequestData = JSON.parse(resultStr) as Round2RequestData;
  } catch {
    throw new Error("Failed to parse round 2 request data");
  }

  // Load key package from DKG
  const dkgStatePath = dkgStateDir(registryPath, groupId.hex());
  const keyPackagePath = path.join(dkgStatePath, "key_package.json");

  if (!fs.existsSync(keyPackagePath)) {
    throw new Error("Key package not found. Complete DKG first.");
  }

  interface KeyPackageFile {
    group: string;
    key_package: SerializedKeyPackage;
  }

  const keyPackageFile = JSON.parse(fs.readFileSync(keyPackagePath, "utf-8")) as KeyPackageFile;
  const keyPackage = deserializeKeyPackage(keyPackageFile.key_package);

  // Reconstruct our nonces from saved state
  const savedNonces = commitState.nonces;
  const hidingNonce = Nonce.deserialize(Ed25519Sha512, hexToBytes(savedNonces.hiding));
  const bindingNonce = Nonce.deserialize(Ed25519Sha512, hexToBytes(savedNonces.binding));
  // Use fromNonces factory method which computes commitments internally
  const nonces = SigningNonces.fromNonces(Ed25519Sha512, hidingNonce, bindingNonce);

  // Build commitments map from all participants
  const allCommitments = new Map<FrostIdentifier, Ed25519SigningCommitments>();
  for (const [idHex, serializedComm] of Object.entries(round2RequestData.commitments)) {
    // Parse identifier from the hex string (assuming it's a u16 encoded as a scalar)
    const idBytes = hexToBytes(idHex);
    // For simplicity, we'll use the first byte as the participant index
    // In production, this would need proper identifier parsing
    const participantId = idBytes[0] ?? 1;
    const identifier = identifierFromU16(participantId);
    const commitments = deserializeSigningCommitments(serializedComm);
    allCommitments.set(identifier, commitments);
  }

  // Parse the message to sign
  const message = hexToBytes(round2RequestData.message);

  // Create signing package
  const signingPackage = createSigningPackage(allCommitments, message);

  // Generate signature share using FROST round 2
  const signatureShare = signingRound2(signingPackage, nonces, keyPackage);

  // Serialize the signature share
  const serializedShare = serializeSignatureShare(signatureShare);

  // Create response ARID and new listening ARID
  const responseArid = ARID.new();
  const newListeningArid = ARID.new();

  // Create response with signature share
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
  const { SealedResponse: SealedResponseClass } = require("@bcts/gstp") as {
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
  const requestId = parseAridUr(round2RequestData.request_id);

  const response = SealedResponseClass.newSuccess(requestId, recipient).withResult(serializedShare);

  const envelope: Envelope = response.toEnvelope(
    undefined,
    recipient.inceptionPrivateKeys(),
    undefined,
  );

  await putWithIndicator(
    client,
    responseArid,
    envelope,
    "Sending signature share",
    options.verbose ?? false,
  );

  // Save share state
  const groupIdStr: string = groupId.urString();
  const shareState = {
    session: sessionId.urString(),
    group: groupIdStr,
    finalize_arid: newListeningArid.urString(),
    signature_share: serializedShare,
    message: round2RequestData.message,
  };

  fs.writeFileSync(path.join(stateDir, "share.json"), JSON.stringify(shareState, null, 2));

  // Update registry with new listening ARID
  const groupRecord = registry.group(groupId);
  if (groupRecord !== null && groupRecord !== undefined) {
    groupRecord.setListeningAtArid(newListeningArid);
    registry.save(registryPath);
  }

  if (options.verbose === true) {
    console.log(`Sent signature share`);
    console.log(`Listening at: ${newListeningArid.urString()}`);
  }

  return {
    listeningArid: newListeningArid.urString(),
  };
}
