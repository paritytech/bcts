/**
 * Sign coordinator round 1 command.
 *
 * Port of cmd/sign/coordinator/round1.rs from frost-hubert-rust.
 *
 * @module
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type XID, XID as XIDClass } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { Registry, resolveRegistryPath } from "../../../registry/index.js";
import { parallelFetch, type CollectionResult } from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

/**
 * Options for the sign round1 command.
 */
export interface SignRound1Options {
  registryPath?: string;
  groupId: string;
  sessionId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the sign round1 command.
 */
export interface SignRound1Result {
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
}

/**
 * Execute the sign coordinator round 1 command.
 *
 * Collects signing commitments from participants.
 *
 * Port of `round1()` from cmd/sign/coordinator/round1.rs.
 */
export async function round1(
  client: StorageClient,
  options: SignRound1Options,
  cwd: string,
): Promise<SignRound1Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const groupId = parseAridUr(options.groupId);
  const sessionId = parseAridUr(options.sessionId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  const stateDir = signingStateDir(registryPath, groupId.hex(), sessionId.hex());
  const inviteStatePath = path.join(stateDir, "invite.json");

  if (!fs.existsSync(inviteStatePath)) {
    throw new Error("No invite state found. Run 'sign coordinator invite' first.");
  }

  // Load invite state
  const inviteState = JSON.parse(fs.readFileSync(inviteStatePath, "utf-8")) as {
    participants: { xid: string; responseArid: string }[];
  };

  // Build targets for parallel fetch
  const targets: { xid: XID; arid: ARID }[] = inviteState.participants.map(
    (p: { xid: string; responseArid: string }) => ({
      xid: XIDClass.fromUrString(p.xid),
      arid: parseAridUr(p.responseArid),
    }),
  );

  // Collect responses
  const responses: CollectionResult<{ envelope: Envelope; xid: XID }> = await parallelFetch(
    client,
    targets,
    (envelope: Envelope, xid: XID) => {
      // Parse the response envelope
      // Extract commitment from response
      return { envelope, xid };
    },
    {
      timeoutSeconds: options.timeoutSeconds,
      verbose: options.verbose,
    },
  );

  // Save collected commitments
  const commitmentsPath = path.join(stateDir, "commitments.json");
  const commitments: Record<string, { envelope: Envelope; xid: XID }> = {};

  for (const [xidUr, data] of responses.successes) {
    commitments[xidUr] = data;
  }

  fs.writeFileSync(commitmentsPath, JSON.stringify(commitments, null, 2));

  // Check if we have enough participants
  const minSigners = groupRecord.minSigners();
  if (responses.successes.size < minSigners) {
    console.warn(
      `Warning: Only ${responses.successes.size} commitments collected, ` +
        `but ${minSigners} are required for signing.`,
    );
  }

  // TODO: Dispatch round 2 requests to participants

  if (options.verbose === true) {
    console.log(`Collected ${responses.successes.size} commitments`);
    console.log(`  ${responses.rejections.size} rejections`);
    console.log(`  ${responses.errors.size} errors`);
    console.log(`  ${responses.timeouts.length} timeouts`);
  }

  return {
    accepted: responses.successes.size,
    rejected: responses.rejections.size,
    errors: responses.errors.size,
    timeouts: responses.timeouts.length,
  };
}
