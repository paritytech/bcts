/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * DKG coordinator round 2 command.
 *
 * Port of cmd/dkg/coordinator/round2.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, type PrivateKeys, XID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { SealedRequest, SealedResponse } from "@bcts/gstp";
import type { XIDDocument } from "@bcts/xid";

import {
  type GroupRecord,
  PendingRequests,
  Registry,
  resolveRegistryPath,
} from "../../../registry/index.js";
import { groupStateDir, isVerbose } from "../../common.js";
import {
  type CollectionResult,
  parallelFetch,
  parallelSend,
  type ParallelFetchConfig,
  parallelFetchConfigWithTimeout,
} from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { getWithIndicator, putWithIndicator } from "../../busy.js";
import { parseAridUr } from "../common.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Options for the DKG round2 command.
 */
export interface DkgRound2Options {
  registryPath?: string;
  groupId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  verbose?: boolean;
  preview?: boolean;
}

/**
 * Result of the DKG round2 command.
 */
export interface DkgRound2Result {
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
  displayPath?: string;
}

/**
 * Data extracted from a successful Round 2 response.
 *
 * Port of `struct Round2ResponseData` from round2.rs lines 601-604.
 */
export interface Round2ResponseData {
  packages: [XID, unknown][];
  nextResponseArid: ARID;
}

/**
 * Round 2 collection result (for sequential path).
 *
 * Port of `struct Round2Collection` from round2.rs lines 206-213.
 */
interface Round2Collection {
  packages: Map<string, [XID, unknown][]>; // Map<XID.urString(), [recipient XID, package][]>
  nextResponseArids: [XID, ARID][];
  displayPath: string;
}

/**
 * Entry for a collected Round 2 response.
 *
 * Port of `struct CollectedRound2Entry` from round2.rs lines 359-362.
 */
interface CollectedRound2Entry {
  packages: [XID, unknown][];
  nextResponseArid: ARID;
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Validate that the owner is the coordinator of the group.
 *
 * Port of coordinator check from round2.rs lines 86-94.
 */
function validateCoordinator(groupRecord: GroupRecord, ownerXid: XID): void {
  if (groupRecord.coordinator().xid().urString() !== ownerXid.urString()) {
    throw new Error(
      `Only the coordinator can collect Round 2 responses and send finalize packages. ` +
        `Coordinator: ${groupRecord.coordinator().xid().urString()}, Owner: ${ownerXid.urString()}`,
    );
  }
}

// -----------------------------------------------------------------------------
// Response validation and extraction
// -----------------------------------------------------------------------------

/**
 * Validate envelope and extract Round 2 data (for parallel fetch).
 *
 * Port of `validate_and_extract_round2_response()` from round2.rs lines 646-708.
 */
export function validateAndExtractRound2Response(
  envelope: Envelope,
  coordinatorKeys: PrivateKeys,
  expectedGroupId: ARID,
  expectedSender: XID,
): Round2ResponseData | { rejected: string } {
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
    return { rejected: "Response has no result envelope" };
  }

  // Validate response type
  try {
    result.checkSubjectUnit();
    result.checkType("dkgRound2Response");
  } catch (err) {
    return {
      rejected: `Invalid response type: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Validate group ID
  try {
    const groupEnv = result.objectForPredicate("group");
    const groupId = groupEnv.extractSubject<ARID>((cbor) => ARID.fromTaggedCbor(cbor));
    if (groupId.urString() !== expectedGroupId.urString()) {
      return {
        rejected: `Response group ID ${groupId.urString()} does not match expected ${expectedGroupId.urString()}`,
      };
    }
  } catch (err) {
    return {
      rejected: `Failed to extract group: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Validate participant/sender
  try {
    const participantEnv = result.objectForPredicate("participant");
    const senderXid = participantEnv.extractSubject<XID>((cbor) => XID.fromTaggedCbor(cbor));
    if (senderXid.urString() !== expectedSender.urString()) {
      return {
        rejected: `Response participant ${senderXid.urString()} does not match expected ${expectedSender.urString()}`,
      };
    }
  } catch (err) {
    return {
      rejected: `Failed to extract participant: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Extract next response ARID
  let nextResponseArid: ARID;
  try {
    const responseAridEnv = result.objectForPredicate("response_arid");
    nextResponseArid = responseAridEnv.extractSubject<ARID>((cbor) => ARID.fromTaggedCbor(cbor));
  } catch (err) {
    return {
      rejected: `Failed to extract response_arid: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Extract round2 packages
  const packages: [XID, unknown][] = [];
  try {
    const pkgEnvelopes = result.objectsForPredicate("round2Package");
    for (const pkgEnv of pkgEnvelopes) {
      const recipientEnv = pkgEnv.objectForPredicate("recipient");
      const recipient = recipientEnv.extractSubject<XID>((cbor) => XID.fromTaggedCbor(cbor));
      const pkgJsonStr = pkgEnv.extractString();
      const pkg: unknown = JSON.parse(pkgJsonStr);
      packages.push([recipient, pkg]);
    }
  } catch (err) {
    return {
      rejected: `Failed to extract round2 packages: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { packages, nextResponseArid };
}

// -----------------------------------------------------------------------------
// Sequential collection
// -----------------------------------------------------------------------------

/**
 * Fetch a Round 2 response sequentially.
 *
 * Port of `fetch_round2_response()` from round2.rs lines 364-442.
 */
async function fetchRound2Response(
  client: StorageClient,
  arid: ARID,
  timeout: number | undefined,
  coordinatorKeys: PrivateKeys,
  expectedGroup: ARID,
  expectedSender: XID,
): Promise<CollectedRound2Entry> {
  const envelope = await getWithIndicator(
    client,
    arid,
    expectedSender.urString(),
    timeout,
    isVerbose(),
  );

  if (envelope === null || envelope === undefined) {
    throw new Error("Response not found in Hubert storage");
  }

  const result = validateAndExtractRound2Response(
    envelope,
    coordinatorKeys,
    expectedGroup,
    expectedSender,
  );

  if ("rejected" in result) {
    throw new Error(result.rejected);
  }

  return {
    packages: result.packages,
    nextResponseArid: result.nextResponseArid,
  };
}

/**
 * Collect Round 2 responses sequentially.
 *
 * Port of `collect_round2()` from round2.rs lines 216-357.
 */
async function collectRound2(
  client: StorageClient,
  registryPath: string,
  registry: Registry,
  coordinatorKeys: PrivateKeys,
  groupId: ARID,
  pendingRequests: PendingRequests,
  timeout: number | undefined,
): Promise<Round2Collection> {
  if (isVerbose()) {
    console.error(`Collecting Round 2 responses from ${pendingRequests.len()} participants...`);
  }

  const allPackages = new Map<string, [XID, unknown][]>();
  const nextResponseArids: [XID, ARID][] = [];
  const errors: [XID, string][] = [];

  for (const [participantXid, collectFromArid] of pendingRequests.iterCollect()) {
    const participantRecord = registry.participant(participantXid);
    const participantName = participantRecord?.petName() ?? participantXid.urString();

    if (isVerbose()) {
      console.error(`${participantName}...`);
    }

    try {
      const collected = await fetchRound2Response(
        client,
        collectFromArid,
        timeout,
        coordinatorKeys,
        groupId,
        participantXid,
      );
      allPackages.set(participantXid.urString(), collected.packages);
      nextResponseArids.push([participantXid, collected.nextResponseArid]);
    } catch (err) {
      if (isVerbose()) {
        console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
      }
      errors.push([participantXid, err instanceof Error ? err.message : String(err)]);
    }
  }

  if (errors.length > 0) {
    if (isVerbose()) {
      console.error();
      console.error(`Failed to collect from ${errors.length} participants:`);
    }
    for (const [xid, error] of errors) {
      console.error(`  ${xid.urString()}: ${error}`);
    }
    throw new Error(
      `Round 2 collection incomplete: ${errors.length} of ${pendingRequests.len()} responses failed`,
    );
  }

  // Persist collected round2 packages
  const displayPath = persistRound2PackagesFromMap(
    registryPath,
    groupId,
    allPackages,
    nextResponseArids,
  );

  // Update pending requests
  const newPending = new PendingRequests();
  for (const [xid, sendToArid] of nextResponseArids) {
    newPending.addSendOnly(xid, sendToArid);
  }
  const groupRecord = registry.group(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPending);
  registry.save(registryPath);

  return {
    packages: allPackages,
    nextResponseArids,
    displayPath,
  };
}

/**
 * Persist Round 2 packages from a Map (sequential collection).
 */
function persistRound2PackagesFromMap(
  registryPath: string,
  groupId: ARID,
  allPackages: Map<string, [XID, unknown][]>,
  nextResponseArids: [XID, ARID][],
): string {
  const stateDir = groupStateDir(registryPath, groupId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const collectedPath = path.join(stateDir, "collected_round2.json");
  const root: Record<string, unknown> = {};

  for (const [senderUrString, packages] of allPackages) {
    const senderMap: Record<string, unknown> = {};

    // Find response_arid for this sender
    const responseArid = nextResponseArids.find(([xid]) => xid.urString() === senderUrString)?.[1];

    if (responseArid !== undefined) {
      senderMap["response_arid"] = responseArid.urString();
    }

    const packagesJson: Record<string, unknown> = {};
    for (const [recipient, pkg] of packages) {
      packagesJson[recipient.urString()] = pkg;
    }
    senderMap["packages"] = packagesJson;

    root[senderUrString] = senderMap;
  }

  fs.writeFileSync(collectedPath, JSON.stringify(root, null, 2));

  // Return relative path if possible
  const cwd = process.cwd();
  if (collectedPath.startsWith(cwd)) {
    return collectedPath.slice(cwd.length + 1);
  }
  return collectedPath;
}

// -----------------------------------------------------------------------------
// Parallel collection
// -----------------------------------------------------------------------------

/**
 * Collect Round 2 responses in parallel with progress display.
 *
 * Port of `collect_round2_parallel()` from round2.rs lines 607-643.
 */
export async function collectRound2Parallel(
  client: StorageClient,
  registry: Registry,
  pendingRequests: PendingRequests,
  coordinatorKeys: PrivateKeys,
  expectedGroupId: ARID,
  timeout: number | undefined,
): Promise<CollectionResult<Round2ResponseData>> {
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
      validateAndExtractRound2Response(envelope, coordinatorKeys, expectedGroupId, xid),
    config,
  );
}

// -----------------------------------------------------------------------------
// Persist Round 2 packages (parallel)
// -----------------------------------------------------------------------------

/**
 * Persist Round 2 packages from parallel collection results.
 *
 * Port of `persist_round2_packages()` from round2.rs lines 712-758.
 */
export function persistRound2Packages(
  registryPath: string,
  groupId: ARID,
  successes: [XID, Round2ResponseData][],
): string {
  const stateDir = groupStateDir(registryPath, groupId.hex());
  fs.mkdirSync(stateDir, { recursive: true });

  const collectedPath = path.join(stateDir, "collected_round2.json");
  const root: Record<string, unknown> = {};

  for (const [sender, data] of successes) {
    const senderMap: Record<string, unknown> = {};
    senderMap["response_arid"] = data.nextResponseArid.urString();

    const packagesJson: Record<string, unknown> = {};
    for (const [recipient, pkg] of data.packages) {
      packagesJson[recipient.urString()] = pkg;
    }
    senderMap["packages"] = packagesJson;

    root[sender.urString()] = senderMap;
  }

  fs.writeFileSync(collectedPath, JSON.stringify(root, null, 2));

  // Return relative path if possible
  const cwd = process.cwd();
  if (collectedPath.startsWith(cwd)) {
    return collectedPath.slice(cwd.length + 1);
  }
  return collectedPath;
}

// -----------------------------------------------------------------------------
// Update pending requests (parallel)
// -----------------------------------------------------------------------------

/**
 * Update pending requests from parallel collection results.
 *
 * Port of `update_pending_for_finalize_from_collection()` from round2.rs lines 761-777.
 */
export function updatePendingForFinalizeFromCollection(
  registry: Registry,
  registryPath: string,
  groupId: ARID,
  successes: [XID, Round2ResponseData][],
): void {
  const newPending = new PendingRequests();
  for (const [xid, data] of successes) {
    newPending.addSendOnly(xid, data.nextResponseArid);
  }

  const groupRecord = registry.group(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPending);
  registry.save(registryPath);
}

// -----------------------------------------------------------------------------
// Finalize request building
// -----------------------------------------------------------------------------

/**
 * Gather packages FOR a specific recipient (from all other senders).
 *
 * Port of `gather_packages_for_recipient()` from round2.rs lines 552-571.
 */
function gatherPackagesForRecipient(
  recipient: XID,
  allPackages: Map<string, [XID, unknown][]>,
): [XID, unknown][] {
  const result: [XID, unknown][] = [];

  for (const [senderUrString, packages] of allPackages) {
    for (const [rcpt, pkg] of packages) {
      if (rcpt.urString() === recipient.urString()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports, no-undef
        const { XID: XIDClass } = require("@bcts/components");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const sender = XIDClass.fromURString(senderUrString) as XID;
        result.push([sender, pkg]);
      }
    }
  }

  if (result.length === 0) {
    throw new Error(`No round2 packages found for recipient ${recipient.urString()}`);
  }

  return result;
}

/**
 * Build a finalize request for a participant.
 *
 * Port of `build_finalize_request_for_participant()` from round2.rs lines 575-594.
 */
export function buildFinalizeRequestForParticipant(
  sender: XIDDocument,
  groupId: ARID,
  responseArid: ARID,
  packages: [XID, unknown][],
): SealedRequest {
  let request = SealedRequest.new("dkgFinalize", ARID.new(), sender)
    .withParameter("group", groupId)
    .withParameter("responseArid", responseArid);

  for (const [pkgSender, pkg] of packages) {
    const encoded = JSON.stringify(pkg);
    const pkgEnvelope = Envelope.new(encoded).addAssertion("sender", pkgSender);
    request = request.withParameter("round2Package", pkgEnvelope);
  }

  return request;
}

// -----------------------------------------------------------------------------
// Send finalize requests (sequential)
// -----------------------------------------------------------------------------

/**
 * Send finalize requests sequentially.
 *
 * Port of `send_finalize_requests()` from round2.rs lines 444-550.
 */
async function sendFinalizeRequests(
  client: StorageClient,
  registryPath: string,
  registry: Registry,
  coordinator: XIDDocument,
  groupId: ARID,
  collection: Round2Collection,
  preview: boolean,
): Promise<[string, string] | undefined> {
  const signerPrivateKeys = coordinator.inceptionPrivateKeys();
  if (signerPrivateKeys === undefined) {
    throw new Error("Coordinator XID document has no signing keys");
  }

  const validUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Build participant info: [XID, XIDDocument, sendToArid, collectFromArid]
  const participantInfo: [XID, XIDDocument, ARID, ARID][] = [];

  for (const [xid, sendToArid] of collection.nextResponseArids) {
    const record = registry.participant(xid);
    if (record === undefined) {
      throw new Error(`Participant ${xid.urString()} not found in registry`);
    }
    const collectFromArid = ARID.new();
    participantInfo.push([xid, record.xidDocument(), sendToArid, collectFromArid]);
  }

  if (isVerbose()) {
    console.error(`Sending finalize packages to ${participantInfo.length} participants...`);
  } else {
    console.error(); // Blank line to separate get phase from put phase
  }

  let previewOutput: [string, string] | undefined;

  for (const [xid, recipientDoc, sendToArid, collectFromArid] of participantInfo) {
    const record = registry.participant(xid);
    const participantName = record?.petName() ?? xid.urString();

    if (isVerbose()) {
      console.error(`${participantName}...`);
    }

    // Gather packages FOR this recipient
    const packagesForRecipient = gatherPackagesForRecipient(xid, collection.packages);

    const request = buildFinalizeRequestForParticipant(
      coordinator,
      groupId,
      collectFromArid,
      packagesForRecipient,
    );

    if (preview && previewOutput === undefined) {
      const unsealedEnvelope = request.toEnvelope(validUntil, signerPrivateKeys, undefined);
      previewOutput = [participantName, unsealedEnvelope.urString()];
    }

    const sealedEnvelope = request.toEnvelopeForRecipients(validUntil, signerPrivateKeys, [
      recipientDoc,
    ]);

    await putWithIndicator(client, sendToArid, sealedEnvelope, participantName, isVerbose());
  }

  // Build pending requests for finalize response collection
  const newPendingRequests = new PendingRequests();
  for (const [xid, , , collectFromArid] of participantInfo) {
    newPendingRequests.addCollectOnly(xid, collectFromArid);
  }
  const groupRecord = registry.group(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPendingRequests);
  registry.save(registryPath);

  return previewOutput;
}

// -----------------------------------------------------------------------------
// Dispatch finalize requests (parallel)
// -----------------------------------------------------------------------------

/**
 * Dispatch finalize requests in parallel.
 *
 * Port of `dispatch_finalize_requests_parallel()` from round2.rs lines 780-900.
 */
export async function dispatchFinalizeRequestsParallel(
  client: StorageClient,
  registry: Registry,
  registryPath: string,
  coordinator: XIDDocument,
  groupId: ARID,
  successes: [XID, Round2ResponseData][],
  preview: boolean,
): Promise<[string, string] | undefined> {
  const signerPrivateKeys = coordinator.inceptionPrivateKeys();
  if (signerPrivateKeys === undefined) {
    throw new Error("Coordinator XID document has no signing keys");
  }

  const validUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Build all_packages map for gatherPackagesForRecipient
  const allPackages = new Map<string, [XID, unknown][]>();
  for (const [xid, data] of successes) {
    allPackages.set(xid.urString(), data.packages);
  }

  // Build messages
  const messages: [XID, ARID, Envelope, string][] = [];
  const collectArids: [XID, ARID][] = [];
  let previewOutput: [string, string] | undefined;

  for (const [xid, data] of successes) {
    const record = registry.participant(xid);
    if (record === undefined) {
      throw new Error(`Participant ${xid.urString()} not found in registry`);
    }
    const recipientDoc = record.xidDocument();
    const participantName = record.petName() ?? xid.urString();

    const collectFromArid = ARID.new();
    collectArids.push([xid, collectFromArid]);

    const packagesForRecipient = gatherPackagesForRecipient(xid, allPackages);

    const request = buildFinalizeRequestForParticipant(
      coordinator,
      groupId,
      collectFromArid,
      packagesForRecipient,
    );

    if (preview && previewOutput === undefined) {
      const unsealedEnvelope = request.toEnvelope(validUntil, signerPrivateKeys, undefined);
      previewOutput = [participantName, unsealedEnvelope.urString()];
    }

    const sealedEnvelope = request.toEnvelopeForRecipients(validUntil, signerPrivateKeys, [
      recipientDoc,
    ]);

    messages.push([xid, data.nextResponseArid, sealedEnvelope, participantName]);
  }

  // Blank line to separate get phase from put phase
  console.error();

  // Send all messages in parallel
  const sendResults = await parallelSend(client, messages, isVerbose());

  // Check for send failures
  const failures = sendResults.filter(([, err]) => err !== null);

  if (failures.length > 0) {
    for (const [xid, error] of failures) {
      if (error !== null) {
        console.error(`Failed to send to ${xid.urString()}: ${error.message}`);
      }
    }
    throw new Error(`Failed to send finalize requests to ${failures.length} participants`);
  }

  // Update pending requests for finalize response collection
  const newPendingRequests = new PendingRequests();
  for (const [xid, collectFromArid] of collectArids) {
    newPendingRequests.addCollectOnly(xid, collectFromArid);
  }
  const groupRecord = registry.group(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPendingRequests);
  registry.save(registryPath);

  return previewOutput;
}

// -----------------------------------------------------------------------------
// Summary printing
// -----------------------------------------------------------------------------

/**
 * Print summary for parallel collection.
 *
 * Port of `print_summary_parallel()` from round2.rs lines 903-964.
 */
function printSummaryParallel(
  collection: CollectionResult<Round2ResponseData>,
  displayPath: string,
  preview: [string, string] | undefined,
): void {
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
    console.error();
    console.error(
      `Round 2 collection incomplete: ${collection.successes.length} succeeded, ` +
        `${collection.rejections.length} rejected, ${collection.errors.length} errors, ` +
        `${collection.timeouts.length} timeouts`,
    );
    return;
  }

  if (preview !== undefined) {
    const [participantName, ur] = preview;
    if (isVerbose()) {
      console.error(`# Finalize preview for ${participantName}`);
      console.error();
    }
    console.error(
      `Collected ${collection.successes.length} Round 2 responses to ${displayPath} and sent ${collection.successes.length} finalize requests.`,
    );
    console.log(ur);
  } else if (isVerbose()) {
    console.error();
    console.error(
      `Collected ${collection.successes.length} Round 2 responses to ${displayPath} and sent ${collection.successes.length} finalize requests.`,
    );
  }
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Execute the DKG coordinator round 2 command.
 *
 * Collects Round 2 responses and sends finalize packages.
 *
 * Port of `CommandArgs::exec()` from cmd/dkg/coordinator/round2.rs lines 59-203.
 */
export async function round2(
  client: StorageClient,
  options: DkgRound2Options,
  cwd: string,
): Promise<DkgRound2Result> {
  const registryPath = resolveRegistryPath(options.registryPath, cwd);
  const registry = Registry.load(registryPath);

  const owner = registry.owner();
  if (owner === undefined) {
    throw new Error("Registry owner is required");
  }
  const ownerDoc = owner.xidDocument();

  const groupId = parseAridUr(options.groupId);
  const groupRecord = registry.group(groupId);

  if (groupRecord === undefined) {
    throw new Error(`Group ${options.groupId} not found in registry`);
  }

  // Verify we are the coordinator
  validateCoordinator(groupRecord, owner.xid());

  const pendingRequests = groupRecord.pendingRequests();
  if (pendingRequests.isEmpty()) {
    throw new Error(
      "No pending requests for this group. Did you run 'frost dkg coordinator round1'?",
    );
  }

  const coordinatorKeys = ownerDoc.inceptionPrivateKeys();
  if (coordinatorKeys === undefined) {
    throw new Error("Coordinator XID document has no private keys");
  }

  if (options.parallel === true) {
    // Parallel path with progress display
    const collection = await collectRound2Parallel(
      client,
      registry,
      pendingRequests,
      coordinatorKeys,
      groupId,
      options.timeoutSeconds,
    );

    // Persist collected data
    const displayPath = persistRound2Packages(registryPath, groupId, collection.successes);

    updatePendingForFinalizeFromCollection(registry, registryPath, groupId, collection.successes);

    const preview = await dispatchFinalizeRequestsParallel(
      client,
      registry,
      registryPath,
      ownerDoc,
      groupId,
      collection.successes,
      options.preview ?? false,
    );

    printSummaryParallel(collection, displayPath, preview);

    return {
      accepted: collection.successes.length,
      rejected: collection.rejections.length,
      errors: collection.errors.length,
      timeouts: collection.timeouts.length,
      displayPath,
    };
  } else {
    // Sequential path (original behavior)
    // Phase 1: Collect Round 2 responses
    const collection = await collectRound2(
      client,
      registryPath,
      registry,
      coordinatorKeys,
      groupId,
      pendingRequests,
      options.timeoutSeconds,
    );

    // Phase 2: Send finalize packages
    const preview = await sendFinalizeRequests(
      client,
      registryPath,
      registry,
      ownerDoc,
      groupId,
      collection,
      options.preview ?? false,
    );

    if (preview !== undefined) {
      const [participantName, ur] = preview;
      if (isVerbose()) {
        console.error(`# Finalize preview for ${participantName}`);
        console.error();
      }
      console.error(
        `Collected ${collection.packages.size} Round 2 responses to ${collection.displayPath} and sent ${collection.nextResponseArids.length} finalize requests.`,
      );
      console.log(ur);
    } else if (isVerbose()) {
      console.error();
      console.error(
        `Collected ${collection.packages.size} Round 2 responses to ${collection.displayPath} and sent ${collection.nextResponseArids.length} finalize requests.`,
      );
    }

    return {
      accepted: collection.packages.size,
      rejected: 0,
      errors: 0,
      timeouts: 0,
      displayPath: collection.displayPath,
    };
  }
}
