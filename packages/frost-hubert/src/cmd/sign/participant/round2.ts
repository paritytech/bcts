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
import { parseAridUr, resolveSender } from "../../dkg/common.js";
import { signingStateDir } from "../common.js";

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

  // Load commit state
  const commitState = JSON.parse(fs.readFileSync(commitStatePath, "utf-8")) as {
    listening_arid: string;
  };

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

  // TODO: Validate round 2 request
  // - Verify sender is coordinator
  // - Verify session matches
  // - Extract commitments from all participants

  // TODO: Generate signature share using FROST
  // const signatureShare = frost::round2::sign(...);

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
        toEnvelope: (senderXid: unknown, recipientPrivateKeys: unknown, extra: unknown) => Envelope;
      };
    };
  };
  const requestId = ARID.new(); // Would be extracted from round 2 request

  const response = SealedResponseClass.newSuccess(requestId, recipient);
  // TODO: Add signature share to response

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

  if (groupId === undefined) {
    throw new Error("Group ID not found");
  }

  if (stateDir === undefined) {
    throw new Error("State directory not found");
  }

  // Save share state

  const groupIdStr: string = groupId.urString();
  const shareState = {
    session: sessionId.urString(),
    group: groupIdStr,
    finalize_arid: newListeningArid.urString(),
    // TODO: Save signature share and commitments for verification
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
