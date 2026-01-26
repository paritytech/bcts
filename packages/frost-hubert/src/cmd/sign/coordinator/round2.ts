/**
 * Sign coordinator round 2 command.
 *
 * Port of cmd/sign/coordinator/round2.rs from frost-hubert-rust.
 *
 * @module
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type XID, Signature } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { parallelFetch, type CollectionResult } from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, dkgStateDir } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";
import {
  aggregateSignatures,
  createSigningPackage,
  deserializeSigningCommitments,
  deserializeSignatureShare,
  deserializePublicKeyPackage,
  identifierFromU16,
  hexToBytes,
  serializeSignature,
  serializeSignatureHex,
  type SerializedPublicKeyPackage,
  type SerializedSigningCommitments,
  type FrostIdentifier,
  type Ed25519SigningCommitments,
  type Ed25519SignatureShare,
} from "../../../frost/index.js";

/**
 * Options for the sign round2 command.
 */
export interface SignRound2Options {
  registryPath?: string;
  groupId: string;
  sessionId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the sign round2 command.
 */
export interface SignRound2Result {
  signature: string;
  signedEnvelope: string;
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
}

/**
 * Execute the sign coordinator round 2 command.
 *
 * Collects signature shares and aggregates the final signature.
 *
 * Port of `round2()` from cmd/sign/coordinator/round2.rs.
 */
export async function round2(
  client: StorageClient,
  options: SignRound2Options,
  cwd: string,
): Promise<SignRound2Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const groupId = parseAridUr(options.groupId);
  const sessionId = parseAridUr(options.sessionId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  const stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  const commitmentsPath = path.join(stateDir, "commitments.json");

  if (!fs.existsSync(commitmentsPath)) {
    throw new Error("No commitments found. Run 'sign coordinator round1' first.");
  }

  // Load commitments collected in round 1
  type CommitmentsFile = Record<
    string,
    {
      commitment: SerializedSigningCommitments;
      participant_index: number;
    }
  >;

  const commitmentsFile = JSON.parse(
    fs.readFileSync(commitmentsPath, "utf-8"),
  ) as CommitmentsFile;

  // Build targets for parallel fetch (from pending requests)
  const pendingRequests = groupRecord.pendingRequests();
  const targets: { xid: XID; arid: ARID }[] = [];

  for (const [xid, arid] of pendingRequests.iterCollect()) {
    targets.push({ xid, arid });
  }

  // Collect signature shares
  const responses: CollectionResult<{ envelope: Envelope; xid: XID; shareHex: string }> =
    await parallelFetch(
      client,
      targets,
      (envelope: Envelope, xid: XID) => {
        // Parse the response envelope to extract signature share
        let shareHex = "";
        try {
          const resultStr = (envelope as { result?: () => string }).result?.() ?? "";
          shareHex = resultStr;
        } catch {
          // Failed to parse, will be an empty string
        }
        return { envelope, xid, shareHex };
      },
      {
        timeoutSeconds: options.timeoutSeconds,
        verbose: options.verbose,
      },
    );

  // Check minimum signers
  const minSigners = groupRecord.minSigners();
  if (responses.successes.size < minSigners) {
    throw new Error(
      `Not enough signature shares: got ${responses.successes.size}, need ${minSigners}`,
    );
  }

  // Load public key package from DKG state
  const dkgStatePath = dkgStateDir(registryPath, groupId.hex());
  const publicKeyPackagePath = path.join(dkgStatePath, "public_key_package.json");

  if (!fs.existsSync(publicKeyPackagePath)) {
    throw new Error("Public key package not found. Complete DKG first.");
  }

  interface PublicKeyPackageFile {
    group: string;
    public_key_package: SerializedPublicKeyPackage;
  }

  const publicKeyPackageFile = JSON.parse(
    fs.readFileSync(publicKeyPackagePath, "utf-8"),
  ) as PublicKeyPackageFile;
  const publicKeyPackage = deserializePublicKeyPackage(publicKeyPackageFile.public_key_package);

  // Load the message from invite state
  const inviteStatePath = path.join(stateDir, "invite.json");
  const inviteState = JSON.parse(fs.readFileSync(inviteStatePath, "utf-8")) as {
    target: string;
    message: string; // hex-encoded message
  };

  const message = hexToBytes(inviteState.message);

  // Build commitments map for signing package
  const commitmentsMap = new Map<FrostIdentifier, Ed25519SigningCommitments>();
  for (const [, data] of Object.entries(commitmentsFile)) {
    const identifier = identifierFromU16(data.participant_index);
    const commitments = deserializeSigningCommitments(data.commitment);
    commitmentsMap.set(identifier, commitments);
  }

  // Create signing package
  const signingPackage = createSigningPackage(commitmentsMap, message);

  // Build signature shares map
  const sharesMap = new Map<FrostIdentifier, Ed25519SignatureShare>();
  for (const [xidUr, data] of responses.successes) {
    // Find participant index from commitments file
    const commData = commitmentsFile[xidUr];
    if (commData === undefined) {
      console.warn(`Could not find commitment data for ${xidUr}`);
      continue;
    }
    const identifier = identifierFromU16(commData.participant_index);
    const share = deserializeSignatureShare(data.shareHex);
    sharesMap.set(identifier, share);
  }

  // Aggregate signatures using FROST
  const aggregatedSignature = aggregateSignatures(signingPackage, sharesMap, publicKeyPackage);

  // Serialize the aggregated signature
  const signatureHex = serializeSignatureHex(aggregatedSignature);
  const signatureBytes = serializeSignature(aggregatedSignature);
  const signature = Signature.ed25519FromData(signatureBytes);

  // Load target envelope (reuse inviteState loaded earlier)

  const ur = UR.fromURString(inviteState.target);
  // @ts-expect-error TS2339 - API mismatch: fromCbor method not yet implemented
  const targetEnvelope = Envelope.fromCbor(ur.cbor());

  // Attach signature to target
  const signedEnvelope = targetEnvelope.addAssertion("signed", signature);

  // Save collected shares
  const sharesPath = path.join(stateDir, "shares.json");
  const shares: Record<string, { envelope: Envelope; xid: XID }> = {};

  for (const [xidUr, data] of responses.successes) {
    shares[xidUr] = data;
  }

  fs.writeFileSync(sharesPath, JSON.stringify(shares, null, 2));

  // Save final state
  const finalPath = path.join(stateDir, "final.json");
  const finalState = {
    session: sessionId.urString(),
    group: groupId.urString(),
    signature: signature.urString(),
    signature_hex: signatureHex,
    signed_envelope: signedEnvelope.urString(),
    shares_count: responses.successes.size,
    message: inviteState.message,
    verifying_key: publicKeyPackageFile.public_key_package.verifyingKey,
  };

  fs.writeFileSync(finalPath, JSON.stringify(finalState, null, 2));

  // TODO: Dispatch finalize events to participants
  // const finalizeMessages = buildFinalizeMessages(groupRecord, shares, _commitments, signature);
  // await parallelSend(client, finalizeMessages, options.verbose);

  // Clear pending requests
  groupRecord.clearPendingRequests();
  registry.save(registryPath);

  if (options.verbose === true) {
    console.log(`Collected ${responses.successes.size} signature shares`);
    console.log(`  ${responses.rejections.size} rejections`);
    console.log(`  ${responses.errors.size} errors`);
    console.log(`  ${responses.timeouts.length} timeouts`);
    console.log(`Signature: ${signature.urString()}`);
  }

  return {
    signature: signature.urString(),
    signedEnvelope: signedEnvelope.urString(),
    accepted: responses.successes.size,
    rejected: responses.rejections.size,
    errors: responses.errors.size,
    timeouts: responses.timeouts.length,
  };
}
