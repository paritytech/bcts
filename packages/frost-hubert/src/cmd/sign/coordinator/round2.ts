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
/* eslint-disable @typescript-eslint/unbound-method */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type XID, Signature } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { parallelFetch, type CollectionResult } from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

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

  // Load commitments
  const _commitments: Record<string, unknown> = JSON.parse(
    fs.readFileSync(commitmentsPath, "utf-8"),
  ) as Record<string, unknown>;

  // Build targets for parallel fetch (from pending requests)
  const pendingRequests = groupRecord.pendingRequests();
  const targets: { xid: XID; arid: ARID }[] = [];

  for (const [xid, arid] of pendingRequests.iterCollect()) {
    targets.push({ xid, arid });
  }

  // Collect signature shares
  const responses: CollectionResult<{ envelope: Envelope; xid: XID }> = await parallelFetch(
    client,
    targets,
    (envelope: Envelope, xid: XID) => {
      // Parse the response envelope
      // Extract signature share from response
      return { envelope, xid };
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

  // TODO: Aggregate signature using FROST
  // const publicKeyPackage = loadPublicKeyPackage(registryPath, groupId);
  // const aggregatedSignature = aggregateSignatures(shares, commitments, publicKeyPackage);

  // Placeholder signature
  const signatureBytes = new Uint8Array(64);
  const signature = Signature.ed25519FromData(signatureBytes);

  // Load target envelope
  const inviteStatePath = path.join(stateDir, "invite.json");
  const inviteState = JSON.parse(fs.readFileSync(inviteStatePath, "utf-8")) as {
    target: string;
  };

  const ur = UR.fromURString(inviteState.target);
  const targetEnvelope = Envelope.fromCbor(ur.cbor);

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
    signed_envelope: signedEnvelope.urString(),
    shares_count: responses.successes.size,
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
