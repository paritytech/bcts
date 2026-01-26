/**
 * DKG coordinator finalize command.
 *
 * Port of cmd/dkg/coordinator/finalize.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { type ARID, type PrivateKeys, type SigningPublicKey, type XID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";
import { SealedResponse } from "@bcts/gstp";

import {
  type GroupRecord,
  type PendingRequests,
  Registry,
  resolveRegistryPath,
} from "../../../registry/index.js";
import { groupStateDir, isVerbose } from "../../common.js";
import {
  type CollectionResult,
  parallelFetch,
  type ParallelFetchConfig,
  parallelFetchConfigWithTimeout,
} from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { getWithIndicator } from "../../busy.js";
import { parseAridUr, signingKeyFromVerifying } from "../common.js";

/**
 * Options for the DKG finalize command.
 */
export interface DkgFinalizeOptions {
  registryPath?: string;
  groupId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  verbose?: boolean;
}

/**
 * Result of the DKG finalize command.
 */
export interface DkgFinalizeResult {
  verifyingKey: string;
  collected: number;
  rejected: number;
  errors: number;
  timeouts: number;
}

/**
 * Data extracted from a successful finalize response.
 *
 * Port of `struct FinalizeResponseData` from finalize.rs.
 */
interface FinalizeResponseData {
  keyPackage: unknown;
  publicKeyPackage: unknown;
}

/**
 * Entry for a collected finalize response.
 *
 * Port of `struct FinalizeEntry` from finalize.rs.
 */
interface FinalizeEntry {
  participant: XID;
  keyPackage: unknown;
  publicKeyPackage: unknown;
}

/**
 * Validate that the owner is the coordinator of the group.
 *
 * Port of coordinator check from finalize.rs lines 76-82.
 */
function validateCoordinator(groupRecord: GroupRecord, ownerXid: XID): void {
  if (groupRecord.coordinator().xid().urString() !== ownerXid.urString()) {
    throw new Error(
      `Only the coordinator can collect finalize responses. Coordinator: ${groupRecord.coordinator().xid().urString()}, Owner: ${ownerXid.urString()}`,
    );
  }
}

/**
 * Validate envelope and extract finalize data (for parallel fetch).
 *
 * Port of `validate_and_extract_finalize_response()` from finalize.rs lines 407-466.
 */
function validateAndExtractFinalizeResponse(
  envelope: Envelope,
  coordinatorKeys: PrivateKeys,
  expectedGroupId: ARID,
  expectedParticipant: XID,
): FinalizeResponseData | { rejected: string } {
  const now = new Date();

  let sealed: SealedResponse;
  try {
    sealed = SealedResponse.tryFromEncryptedEnvelope(envelope, undefined, now, coordinatorKeys);
  } catch (err) {
    return {
      rejected: `Failed to decrypt/parse response: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Check for error response
  if (!sealed.isOk()) {
    try {
      const error = sealed.error();
      const reasonEnv = error.optionalObjectForPredicate("reason");
      const reason = reasonEnv?.extractString() ?? "unknown reason";
      return { rejected: `Participant reported error: ${reason}` };
    } catch {
      return { rejected: "Participant reported error: unknown reason" };
    }
  }

  // Get and validate result
  let result: Envelope;
  try {
    result = sealed.result();
  } catch {
    return { rejected: "Finalize response has no result" };
  }

  // Validate response type
  try {
    result.checkSubjectUnit();
    result.checkType("dkgFinalizeResponse");
  } catch (err) {
    return {
      rejected: `Invalid response type: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Validate group ID
  try {
    const groupEnv = result.objectForPredicate("group");
    const groupIdStr = groupEnv.extractString();
    const groupId = parseAridUr(groupIdStr);
    if (groupId.urString() !== expectedGroupId.urString()) {
      return {
        rejected: `Group ${groupId.urString()} does not match expected ${expectedGroupId.urString()}`,
      };
    }
  } catch (err) {
    return {
      rejected: `Failed to extract group: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Validate participant
  try {
    const participantEnv = result.objectForPredicate("participant");
    const participantStr = participantEnv.extractString();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
    const { XID: XIDClass } = require("@bcts/components");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const participantXid = XIDClass.fromURString(participantStr) as XID;
    if (participantXid.urString() !== expectedParticipant.urString()) {
      return {
        rejected: `Participant ${participantXid.urString()} does not match expected ${expectedParticipant.urString()}`,
      };
    }
  } catch (err) {
    return {
      rejected: `Failed to extract participant: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Extract key packages
  let keyPackage: unknown;
  let publicKeyPackage: unknown;

  try {
    const keyJsonEnv = result.objectForPredicate("key_package");
    const keyJsonStr = keyJsonEnv.extractString();
    keyPackage = JSON.parse(keyJsonStr);
  } catch (err) {
    return {
      rejected: `Failed to parse key_package: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const pubJsonEnv = result.objectForPredicate("public_key_package");
    const pubJsonStr = pubJsonEnv.extractString();
    publicKeyPackage = JSON.parse(pubJsonStr);
  } catch (err) {
    return {
      rejected: `Failed to parse public_key_package: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { keyPackage, publicKeyPackage };
}

/**
 * Fetch a finalize response sequentially.
 *
 * Port of `fetch_finalize_response()` from finalize.rs lines 282-358.
 */
async function fetchFinalizeResponse(
  client: StorageClient,
  responseArid: ARID,
  timeout: number | undefined,
  coordinatorKeys: PrivateKeys,
  expectedGroup: ARID,
  expectedParticipant: XID,
  participantName: string,
): Promise<FinalizeEntry> {
  const envelope = await getWithIndicator(
    client,
    responseArid,
    participantName,
    timeout,
    isVerbose(),
  );

  if (envelope === null || envelope === undefined) {
    throw new Error("Finalize response not found in Hubert storage");
  }

  const result = validateAndExtractFinalizeResponse(
    envelope,
    coordinatorKeys,
    expectedGroup,
    expectedParticipant,
  );

  if ("rejected" in result) {
    throw new Error(result.rejected);
  }

  return {
    participant: expectedParticipant,
    keyPackage: result.keyPackage,
    publicKeyPackage: result.publicKeyPackage,
  };
}

/**
 * Collect finalize responses in parallel with progress display.
 *
 * Port of `collect_finalize_parallel()` from finalize.rs lines 371-404.
 */
async function collectFinalizeParallel(
  client: StorageClient,
  registry: Registry,
  pendingRequests: PendingRequests,
  coordinatorKeys: PrivateKeys,
  expectedGroupId: ARID,
  timeout: number | undefined,
): Promise<CollectionResult<FinalizeResponseData>> {
  const requests: [XID, ARID, string][] = [];

  for (const [xid, arid] of pendingRequests.iterCollect()) {
    const record = registry.participant(xid);
    const name = record?.petName() ?? xid.urString();
    requests.push([xid, arid, name]);
  }

  const config: ParallelFetchConfig = parallelFetchConfigWithTimeout(timeout);

  return parallelFetch(
    client,
    requests,
    (envelope: Envelope, xid: XID) =>
      validateAndExtractFinalizeResponse(envelope, coordinatorKeys, expectedGroupId, xid),
    config,
  );
}

/**
 * Finalize collection results: persist, update registry, print summary.
 *
 * Port of `finalize_collection_results()` from finalize.rs lines 469-590.
 */
function finalizeFinalizeCollectionResults(
  collection: CollectionResult<FinalizeResponseData>,
  registryPath: string,
  registry: Registry,
  groupId: ARID,
): SigningPublicKey | undefined {
  // Report any failures
  if (collection.rejections.length > 0) {
    console.error();
    console.error("Rejections:");
    for (const [xid, reason] of collection.rejections) {
      console.error(`  ${xid.urString()}: ${reason}`);
    }
  }
  if (collection.errors.length > 0) {
    console.error();
    console.error("Errors:");
    for (const [xid, error] of collection.errors) {
      console.error(`  ${xid.urString()}: ${error}`);
    }
  }
  if (collection.timeouts.length > 0) {
    console.error();
    console.error("Timeouts:");
    for (const xid of collection.timeouts) {
      console.error(`  ${xid.urString()}`);
    }
  }

  if (!collection.allSucceeded()) {
    throw new Error(
      `Finalize collection incomplete: ${collection.successes.length} succeeded, ` +
        `${collection.rejections.length} rejected, ${collection.errors.length} errors, ` +
        `${collection.timeouts.length} timeouts`,
    );
  }

  // Validate group verifying key consistency
  let groupVerifyingKey: SigningPublicKey | undefined;

  for (const [xid, data] of collection.successes) {
    // Extract verifying_key from public_key_package
    const pubKeyPkg = data.publicKeyPackage as { verifying_key?: string };
    if (!pubKeyPkg.verifying_key) {
      throw new Error(
        `Failed to extract verifying key for ${xid.urString()}: missing verifying_key field`,
      );
    }

    // The verifying key is typically hex-encoded
    let signingKey: SigningPublicKey;
    try {
      const verifyingKeyBytes = hexToBytes(pubKeyPkg.verifying_key);
      signingKey = signingKeyFromVerifying(verifyingKeyBytes) as SigningPublicKey;
    } catch (err) {
      throw new Error(
        `Failed to extract verifying key for ${xid.urString()}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (groupVerifyingKey !== undefined) {
      if (groupVerifyingKey.urString() !== signingKey.urString()) {
        throw new Error(`Group verifying key mismatch for participant ${xid.urString()}`);
      }
    } else {
      groupVerifyingKey = signingKey;
    }
  }

  // Persist collected finalize data
  const stateDir = groupStateDir(registryPath, groupId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const collectedPath = path.join(stateDir, "collected_finalize.json");
  const root: Record<string, { key_package: unknown; public_key_package: unknown }> = {};

  for (const [xid, data] of collection.successes) {
    root[xid.urString()] = {
      key_package: data.keyPackage,
      public_key_package: data.publicKeyPackage,
    };
  }

  fs.writeFileSync(collectedPath, JSON.stringify(root, null, 2));

  // Update registry
  const groupRecord = registry.group(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }

  if (groupVerifyingKey !== undefined) {
    groupRecord.setVerifyingKey(groupVerifyingKey);
  }
  groupRecord.clearPendingRequests();
  registry.save(registryPath);

  if (isVerbose()) {
    console.error();
    console.error(
      `Collected ${collection.successes.length} finalize responses. Saved to ${collectedPath}`,
    );
    if (groupVerifyingKey !== undefined) {
      console.error(groupVerifyingKey.urString());
    }
  } else if (groupVerifyingKey !== undefined) {
    console.log(groupVerifyingKey.urString());
  }

  return groupVerifyingKey;
}

/**
 * Helper to convert hex string to bytes.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Execute the DKG coordinator finalize command.
 *
 * Collects finalize responses (key/public key packages) from all participants.
 *
 * Port of `finalize()` from cmd/dkg/coordinator/finalize.rs.
 */
export async function finalize(
  client: StorageClient,
  options: DkgFinalizeOptions,
  cwd: string,
): Promise<DkgFinalizeResult> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (owner === undefined) {
    throw new Error("Registry owner is required");
  }

  const groupId = parseAridUr(options.groupId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  // Validate that owner is the coordinator
  validateCoordinator(groupRecord, owner.xid());

  const pendingRequests = groupRecord.pendingRequests();
  if (pendingRequests.isEmpty()) {
    throw new Error(
      "No pending requests for this group. Did you run 'frost dkg coordinator finalize send'?",
    );
  }

  const coordinatorKeys = owner.xidDocument().inceptionPrivateKeys();
  if (coordinatorKeys === undefined) {
    throw new Error("Coordinator XID document has no private keys");
  }

  let verifyingKey: SigningPublicKey | undefined;
  let collected = 0;
  let rejected = 0;
  let errors = 0;
  let timeouts = 0;

  if (options.parallel === true) {
    // Parallel path with progress display
    const collection = await collectFinalizeParallel(
      client,
      registry,
      pendingRequests,
      coordinatorKeys,
      groupId,
      options.timeoutSeconds,
    );

    verifyingKey = finalizeFinalizeCollectionResults(collection, registryPath, registry, groupId);

    collected = collection.successes.length;
    rejected = collection.rejections.length;
    errors = collection.errors.length;
    timeouts = collection.timeouts.length;
  } else {
    // Sequential path (original behavior)
    const collectedEntries: FinalizeEntry[] = [];
    const errorEntries: [XID, string][] = [];
    let groupVerifyingKey: SigningPublicKey | undefined;

    if (isVerbose()) {
      console.error(`Collecting finalize responses from ${pendingRequests.len()} participants...`);
    }

    for (const [participantXid, collectFromArid] of pendingRequests.iterCollect()) {
      const record = registry.participant(participantXid);
      const name = record?.petName() ?? participantXid.urString();

      try {
        const entry = await fetchFinalizeResponse(
          client,
          collectFromArid,
          options.timeoutSeconds,
          coordinatorKeys,
          groupId,
          participantXid,
          name,
        );

        // Extract verifying key from public_key_package
        const pubKeyPkg = entry.publicKeyPackage as { verifying_key?: string };
        if (!pubKeyPkg.verifying_key) {
          throw new Error("missing verifying_key field");
        }

        const verifyingKeyBytes = hexToBytes(pubKeyPkg.verifying_key);
        const signingKey = signingKeyFromVerifying(verifyingKeyBytes) as SigningPublicKey;

        if (groupVerifyingKey !== undefined) {
          if (groupVerifyingKey.urString() !== signingKey.urString()) {
            if (isVerbose()) {
              console.error("error: group verifying key mismatch");
            }
            errorEntries.push([participantXid, "Group verifying key mismatch across responses"]);
            continue;
          }
        } else {
          groupVerifyingKey = signingKey;
        }

        collectedEntries.push(entry);
      } catch (err) {
        if (isVerbose()) {
          console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
        }
        errorEntries.push([participantXid, err instanceof Error ? err.message : String(err)]);
      }
    }

    if (errorEntries.length > 0) {
      if (isVerbose()) {
        console.error();
        console.error(`Failed to collect from ${errorEntries.length} participants:`);
        for (const [xid, error] of errorEntries) {
          console.error(`  ${xid.urString()}: ${error}`);
        }
      }
      throw new Error(
        `Finalize collection incomplete: ${errorEntries.length} of ${pendingRequests.len()} responses failed`,
      );
    }

    // Persist collected finalize data
    const stateDir = groupStateDir(registryPath, groupId.hex());
    fs.mkdirSync(stateDir, { recursive: true });

    const collectedPath = path.join(stateDir, "collected_finalize.json");
    const root: Record<string, { key_package: unknown; public_key_package: unknown }> = {};

    for (const entry of collectedEntries) {
      root[entry.participant.urString()] = {
        key_package: entry.keyPackage,
        public_key_package: entry.publicKeyPackage,
      };
    }

    fs.writeFileSync(collectedPath, JSON.stringify(root, null, 2));

    // Update registry pending requests cleared
    const groupRecordMut = registry.group(groupId);
    if (groupRecordMut === undefined) {
      throw new Error("Group not found in registry");
    }

    if (groupVerifyingKey !== undefined) {
      groupRecordMut.setVerifyingKey(groupVerifyingKey);
    }
    groupRecordMut.clearPendingRequests();
    registry.save(registryPath);

    if (isVerbose()) {
      console.error();
      console.error(
        `Collected ${collectedEntries.length} finalize responses. Saved to ${collectedPath}`,
      );
      if (groupVerifyingKey !== undefined) {
        console.error(groupVerifyingKey.urString());
      }
    } else if (groupVerifyingKey !== undefined) {
      console.log(groupVerifyingKey.urString());
    }

    verifyingKey = groupVerifyingKey;
    collected = collectedEntries.length;
    errors = errorEntries.length;
  }

  return {
    verifyingKey: verifyingKey?.urString() ?? "",
    collected,
    rejected,
    errors,
    timeouts,
  };
}
