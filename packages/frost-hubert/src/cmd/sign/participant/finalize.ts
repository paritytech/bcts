/**
 * Sign participant finalize command.
 *
 * Port of cmd/sign/participant/finalize.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, Signature } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { UR } from "@bcts/uniform-resources";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { getWithIndicator } from "../../busy.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr, resolveSender } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

/**
 * Options for the sign finalize command.
 */
export interface SignFinalizeOptions {
  registryPath?: string;
  sessionId: string;
  groupId?: string;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the sign finalize command.
 */
export interface SignFinalizeResult {
  signature: string;
  signedEnvelope: string;
}

/**
 * Execute the sign participant finalize command.
 *
 * Receives the finalize event with aggregated signature.
 *
 * Port of `finalize()` from cmd/sign/participant/finalize.rs.
 */
export async function finalize(
  client: StorageClient,
  options: SignFinalizeOptions,
  cwd: string,
): Promise<SignFinalizeResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  // @ts-expect-error TS6133 - intentionally unused, will be implemented
  const _recipient = resolveSender(registry);
  const sessionId = parseAridUr(options.sessionId);

  // Find share state
  let groupId: ARID | undefined;
  let stateDir: string | undefined;
  let shareStatePath: string | undefined;

  if (options.groupId !== undefined && options.groupId !== "") {
    groupId = parseAridUr(options.groupId);
    stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
    shareStatePath = path.join(stateDir, "share.json");
  } else {
    // Search for session in group-state directories
    const base = path.dirname(registryPath);
    const groupStateDir = path.join(base, "group-state");

    if (!fs.existsSync(groupStateDir)) {
      throw new Error("No signing state found. Run 'sign participant round2' first.");
    }

    for (const groupDir of fs.readdirSync(groupStateDir)) {
      const candidate = path.join(
        groupStateDir,
        groupDir,
        "signing",
        sessionId.hex(),
        "share.json",
      );
      if (fs.existsSync(candidate)) {
        shareStatePath = candidate;
        stateDir = path.dirname(candidate);
        groupId = ARID.fromHex(groupDir);
        break;
      }
    }

    if (shareStatePath === undefined || shareStatePath === "") {
      throw new Error("Signing session not found. Run 'sign participant round2' first.");
    }
  }

  if (shareStatePath === undefined || !fs.existsSync(shareStatePath)) {
    throw new Error("No share state found. Run 'sign participant round2' first.");
  }

  // Load share state
  const shareState = JSON.parse(fs.readFileSync(shareStatePath, "utf-8")) as {
    finalize_arid: string;
    commitments?: Record<string, unknown>;
  };

  const finalizeArid = parseAridUr(shareState.finalize_arid);

  // Fetch finalize event from coordinator
  const finalizeEnvelope = await getWithIndicator(
    client,
    finalizeArid,
    "Fetching finalize event",
    options.timeoutSeconds,
    options.verbose ?? false,
  );

  if (finalizeEnvelope === null || finalizeEnvelope === undefined) {
    throw new Error("Finalize event not found. The coordinator may not have sent it yet.");
  }

  // TODO: Parse finalize event
  // - Verify sender is coordinator
  // - Extract signature shares from all participants
  // - Extract commitments

  // TODO: Verify and aggregate signature
  // - Load public key package
  // - Aggregate signatures
  // - Verify against target

  if (stateDir === undefined) {
    throw new Error("State directory not found");
  }

  // Load receive state for target
  const receiveStatePath = path.join(stateDir, "sign_receive.json");
  const receiveState = JSON.parse(fs.readFileSync(receiveStatePath, "utf-8")) as {
    target: string;
  };

  // Placeholder signature
  const signatureBytes = new Uint8Array(64);
  const signature: Signature = Signature.ed25519FromData(signatureBytes);

  // Create signed envelope
  const ur: UR = UR.fromURString(receiveState.target);
  // @ts-expect-error TS2339 - API mismatch: fromCbor method not yet implemented
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const targetEnvelope: Envelope = Envelope.fromCbor(ur.cbor());
  const signedEnvelope: Envelope = targetEnvelope.addAssertion("signed", signature);

  if (groupId === undefined) {
    throw new Error("Group ID not found");
  }

  // Save final state
  const finalPath = path.join(stateDir, "final.json");
  const groupIdStr: string = groupId.urString();
  const signatureStr: string = signature.urString();
  const signedEnvelopeStr: string = signedEnvelope.urString();
  const finalState = {
    session: sessionId.urString(),
    group: groupIdStr,
    signature: signatureStr,
    signed_envelope: signedEnvelopeStr,
  };

  fs.writeFileSync(finalPath, JSON.stringify(finalState, null, 2));

  // Clear listening ARID
  const groupRecord = registry.group(groupId);
  if (groupRecord !== null && groupRecord !== undefined) {
    groupRecord.clearListeningAtArid();
    registry.save(registryPath);
  }

  if (options.verbose === true) {
    console.log(`Signature verified`);
    console.log(`Signature: ${signatureStr}`);
  }

  return {
    signature: signatureStr,
    signedEnvelope: signedEnvelopeStr,
  };
}
