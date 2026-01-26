/**
 * DKG coordinator round 1 command.
 *
 * Port of cmd/dkg/coordinator/round1.rs from frost-hubert-rust.
 *
 * @module
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ARID, JSON as JSONWrapper, type PrivateKeys, type XID } from "@bcts/components";
import { CborDate } from "@bcts/dcbor";
import { Envelope } from "@bcts/envelope";
import { SealedRequest, SealedResponse } from "@bcts/gstp";
import type { XIDDocument } from "@bcts/xid";

import {
  type GroupRecord,
  type OwnerRecord,
  PendingRequests,
  Registry,
  resolveRegistryPath,
} from "../../../registry/index.js";
import { getWithIndicator, putWithIndicator } from "../../busy.js";
import { groupStateDir, isVerbose } from "../../common.js";
import {
  type CollectionResult,
  parallelFetch,
  parallelSend,
  type ParallelFetchConfig,
} from "../../parallel.js";
import { type StorageClient } from "../../storage.js";
import { parseAridUr } from "../common.js";
import { type DkgRound1Package } from "../../../frost/index.js";
import { serde } from "@frosts/ed25519";

/**
 * Options for the DKG round1 command.
 */
export interface DkgRound1Options {
  registryPath?: string;
  groupId: string;
  parallel?: boolean;
  timeoutSeconds?: number;
  preview?: boolean;
  verbose?: boolean;
}

/**
 * Result of the DKG round1 command.
 */
export interface DkgRound1Result {
  accepted: number;
  rejected: number;
  errors: number;
  timeouts: number;
}

// -----------------------------------------------------------------------------
// Context and result types
// -----------------------------------------------------------------------------

/**
 * Context for round 1 collection operations.
 */
interface Round1Context {
  client: StorageClient;
  registryPath: string;
  registry: Registry;
  ownerDoc: XIDDocument;
  groupId: ARID;
}

/**
 * Type alias for a round 1 package entry.
 */
type Round1Package = [XID, DkgRound1Package];

/**
 * Type alias for next response ARID entry.
 */
type NextResponseArid = [XID, ARID];

/**
 * Result of collecting round 1 responses.
 */
interface Round1Collection {
  packages: Round1Package[];
  nextResponseArids: NextResponseArid[];
  displayPath: string;
}

/**
 * Data extracted from a successful Round 1 response.
 */
interface Round1ResponseData {
  package: DkgRound1Package;
  nextResponseArid: ARID;
}

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Validate that the owner is the coordinator for this group.
 *
 * Port of `validate_coordinator()` from cmd/dkg/coordinator/round1.rs lines 201-214.
 */
function validateCoordinator(groupRecord: GroupRecord, owner: OwnerRecord): void {
  if (groupRecord.coordinator().xid().urString() !== owner.xid().urString()) {
    throw new Error(
      `Only the coordinator can collect and send Round 2 requests. ` +
        `Coordinator: ${groupRecord.coordinator().xid().urString()}, ` +
        `Owner: ${owner.xid().urString()}`,
    );
  }
}

// -----------------------------------------------------------------------------
// Sequential fetch implementation
// -----------------------------------------------------------------------------

/**
 * Fetch a single round 1 response from storage.
 *
 * Port of `fetch_and_validate_response()` from cmd/dkg/coordinator/round1.rs lines 512-566.
 */
async function fetchRound1Response(
  client: StorageClient,
  responseArid: ARID,
  timeout: number | undefined,
  coordinator: XIDDocument,
  expectedGroupId: ARID,
  participantName: string,
): Promise<[DkgRound1Package, ARID]> {
  const envelope = await getWithIndicator(
    client,
    responseArid,
    participantName,
    timeout,
    isVerbose(),
  );

  if (envelope === undefined) {
    throw new Error("Response not found in Hubert storage");
  }

  const coordinatorPrivateKeys = coordinator.inceptionPrivateKeys();
  if (coordinatorPrivateKeys === undefined) {
    throw new Error("Coordinator XID document has no inception private keys");
  }

  const now = CborDate.now().datetime();
  const sealedResponse = SealedResponse.tryFromEncryptedEnvelope(
    envelope,
    undefined,
    now,
    coordinatorPrivateKeys,
  );

  if (sealedResponse.isErr()) {
    const error = sealedResponse.error();
    const reasonEnvelope = error.objectForPredicate("reason");
    const reason =
      reasonEnvelope !== undefined
        ? reasonEnvelope.extractSubject((cbor) => cbor.toText())
        : "unknown reason";
    throw new Error(`Participant rejected invite: ${reason}`);
  }

  const result = sealedResponse.result();
  validateRound1Response(result, expectedGroupId);

  const nextResponseArid = result.tryObjectForPredicate<ARID>("response_arid", (cbor) => {
    return ARID.fromTaggedCbor(cbor);
  });

  const round1Package = extractRound1Package(result);

  return [round1Package, nextResponseArid];
}

/**
 * Validate a round 1 response envelope.
 *
 * Port of `validate_round1_response()` from cmd/dkg/coordinator/round1.rs lines 568-586.
 */
function validateRound1Response(result: Envelope, expectedGroupId: ARID): void {
  result.checkSubjectUnit();
  result.checkType("dkgRound1Response");

  const groupId = result.tryObjectForPredicate<ARID>("group", (cbor) => {
    return ARID.fromTaggedCbor(cbor);
  });

  if (groupId.urString() !== expectedGroupId.urString()) {
    throw new Error(
      `Response group ID ${groupId.urString()} does not match expected ${expectedGroupId.urString()}`,
    );
  }
}

/**
 * Extract a round 1 package from a response envelope.
 *
 * Port of `extract_round1_package()` from cmd/dkg/coordinator/round1.rs lines 588-598.
 */
function extractRound1Package(result: Envelope): DkgRound1Package {
  const round1Envelope = result.objectForPredicate("round1_package");
  if (round1Envelope === undefined) {
    throw new Error("round1_package missing from response");
  }

  const round1Json = round1Envelope.extractSubject<JSONWrapper>((cbor) => {
    return JSONWrapper.fromTaggedCbor(cbor);
  });

  const jsonStr = new TextDecoder().decode(round1Json.asBytes());
  const jsonObj = globalThis.JSON.parse(jsonStr) as Record<string, unknown>;
  return serde.round1PackageFromJson(jsonObj);
}

/**
 * Validate and extract data from a round 1 response (for parallel fetch).
 *
 * Port of `validate_and_extract_round1_response()` from cmd/dkg/coordinator/round1.rs lines 674-707.
 */
function validateAndExtractRound1Response(
  envelope: Envelope,
  coordinatorKeys: PrivateKeys,
  expectedGroupId: ARID,
): Round1ResponseData | { rejected: string } {
  const now = CborDate.now().datetime();
  const sealedResponse = SealedResponse.tryFromEncryptedEnvelope(
    envelope,
    undefined,
    now,
    coordinatorKeys,
  );

  if (sealedResponse.isErr()) {
    const error = sealedResponse.error();
    const reasonEnvelope = error.objectForPredicate("reason");
    const reason =
      reasonEnvelope !== undefined
        ? reasonEnvelope.extractSubject((cbor) => cbor.toText())
        : "unknown reason";
    return { rejected: `Participant rejected invite: ${reason}` };
  }

  const result = sealedResponse.result();
  validateRound1Response(result, expectedGroupId);

  const nextResponseArid = result.tryObjectForPredicate<ARID>("response_arid", (cbor) => {
    return ARID.fromTaggedCbor(cbor);
  });

  const pkg = extractRound1Package(result);

  return { package: pkg, nextResponseArid };
}

// -----------------------------------------------------------------------------
// Parallel collection
// -----------------------------------------------------------------------------

/**
 * Collect Round 1 responses in parallel with progress display.
 *
 * Port of `collect_round1_responses_parallel()` from cmd/dkg/coordinator/round1.rs lines 636-671.
 */
async function collectRound1Parallel(
  client: StorageClient,
  registry: Registry,
  pendingRequests: PendingRequests,
  coordinator: XIDDocument,
  expectedGroupId: ARID,
  timeout: number | undefined,
): Promise<CollectionResult<Round1ResponseData>> {
  const requests: [XID, ARID, string][] = [];
  for (const [xid, arid] of pendingRequests.iterCollect()) {
    const participant = registry.participant(xid);
    const name = participant?.petName() ?? xid.urString();
    requests.push([xid, arid, name]);
  }

  const coordinatorKeys = coordinator.inceptionPrivateKeys();
  if (coordinatorKeys === undefined) {
    throw new Error("Missing coordinator private keys");
  }

  const config: ParallelFetchConfig = { timeoutSeconds: timeout };
  const groupId = expectedGroupId;

  return parallelFetch(
    client,
    requests,
    (envelope: Envelope, _xid: XID) => {
      return validateAndExtractRound1Response(envelope, coordinatorKeys, groupId);
    },
    config,
  );
}

// -----------------------------------------------------------------------------
// Round 2 request building
// -----------------------------------------------------------------------------

/**
 * Build a Round 2 request for a single participant.
 *
 * Port of `build_round2_request_for_participant()` from cmd/dkg/coordinator/round1.rs lines 604-623.
 */
function buildRound2RequestForParticipant(
  sender: XIDDocument,
  groupId: ARID,
  round1Packages: Round1Package[],
  responseArid: ARID,
): SealedRequest {
  let request = SealedRequest.new("dkgRound2", ARID.new(), sender)
    .withParameter("group", groupId)
    .withParameter("responseArid", responseArid);

  for (const [xid, pkg] of round1Packages) {
    const packageJson = serde.round1PackageToJson(pkg);
    const jsonStr = globalThis.JSON.stringify(packageJson);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonWrapper = JSONWrapper.fromData(jsonBytes);
    const packageEnvelope = Envelope.new(jsonWrapper).addAssertion("participant", xid);
    request = request.withParameter("round1Package", packageEnvelope);
  }

  return request;
}

/**
 * Dispatch Round 2 requests in parallel.
 *
 * Port of `dispatch_round2_requests_parallel()` from cmd/dkg/coordinator/round1.rs lines 729-844.
 */
async function dispatchRound2RequestsParallel(
  client: StorageClient,
  registry: Registry,
  registryPath: string,
  coordinator: XIDDocument,
  groupId: ARID,
  successes: [XID, Round1ResponseData][],
  preview: boolean,
): Promise<[string, string] | undefined> {
  const signerPrivateKeys = coordinator.inceptionPrivateKeys();
  if (signerPrivateKeys === undefined) {
    throw new Error("Coordinator XID document has no signing keys");
  }

  const validUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Build round1 packages list for request building
  const round1Packages: Round1Package[] = successes.map(([xid, data]) => [xid, data.package]);

  // Build participant info and messages
  const messages: [XID, ARID, Envelope, string][] = [];
  const collectArids: [XID, ARID][] = [];
  let previewOutput: [string, string] | undefined;

  for (const [xid, data] of successes) {
    const participant = registry.participant(xid);
    if (participant === undefined) {
      throw new Error(`Participant ${xid.urString()} not found in registry`);
    }
    const recipientDoc = participant.xidDocument();
    const participantName = participant.petName() ?? xid.urString();

    const collectFromArid = ARID.new();
    collectArids.push([xid, collectFromArid]);

    const request = buildRound2RequestForParticipant(
      coordinator,
      groupId,
      round1Packages,
      collectFromArid,
    );

    if (preview && previewOutput === undefined) {
      const unsealedEnvelope = request.toEnvelope(validUntil, signerPrivateKeys, undefined);
      previewOutput = [participantName, unsealedEnvelope.urString()];
    }

    const sealedEnvelope = request.toEnvelope(validUntil, signerPrivateKeys, recipientDoc);

    messages.push([xid, data.nextResponseArid, sealedEnvelope, participantName]);
  }

  // Blank line to separate get phase from put phase
  console.error();

  // Send all messages in parallel
  const sendResults = await parallelSend(client, messages, isVerbose());

  // Check for send failures
  const failures: [XID, string][] = [];
  for (const [xid, err] of sendResults) {
    if (err !== null) {
      failures.push([xid, err.message]);
    }
  }

  if (failures.length > 0) {
    for (const [xid, error] of failures) {
      console.error(`Failed to send to ${xid.urString()}: ${error}`);
    }
    throw new Error(`Failed to send Round 2 requests to ${failures.length} participants`);
  }

  // Update pending requests for Round 2 collection
  const newPendingRequests = new PendingRequests();
  for (const [xid, collectFromArid] of collectArids) {
    newPendingRequests.addCollectOnly(xid, collectFromArid);
  }
  const groupRecord = registry.groupMut(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPendingRequests);
  registry.save(registryPath);

  return previewOutput;
}

// -----------------------------------------------------------------------------
// Pending request updates
// -----------------------------------------------------------------------------

/**
 * Update pending requests from parallel collection results.
 *
 * Port of `update_pending_for_round2_from_collection()` from cmd/dkg/coordinator/round1.rs lines 710-726.
 */
function updatePendingForRound2FromCollection(
  registry: Registry,
  registryPath: string,
  groupId: ARID,
  successes: [XID, Round1ResponseData][],
): void {
  const newPending = new PendingRequests();
  for (const [xid, data] of successes) {
    newPending.addSendOnly(xid, data.nextResponseArid);
  }
  const groupRecord = registry.groupMut(groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPending);
  registry.save(registryPath);
}

// -----------------------------------------------------------------------------
// Persistence
// -----------------------------------------------------------------------------

/**
 * Persist collected round 1 packages to disk.
 *
 * Port of `persist_round1_packages()` from cmd/dkg/coordinator/round1.rs lines 301-340.
 */
function persistRound1Packages(
  registryPath: string,
  groupId: ARID,
  packages: Round1Package[],
): string {
  const packagesDir = groupStateDir(registryPath, groupId.hex());
  fs.mkdirSync(packagesDir, { recursive: true });

  const round1PackagesPath = path.join(packagesDir, "collected_round1.json");
  const packagesJson: Record<string, unknown> = {};

  for (const [xid, pkg] of packages) {
    packagesJson[xid.urString()] = serde.round1PackageToJson(pkg);
  }

  fs.writeFileSync(round1PackagesPath, globalThis.JSON.stringify(packagesJson, null, 2));

  // Return display path (relative to cwd if possible)
  const cwd = process.cwd();
  if (round1PackagesPath.startsWith(cwd)) {
    return round1PackagesPath.slice(cwd.length + 1);
  }
  return round1PackagesPath;
}

// -----------------------------------------------------------------------------
// Sequential collection
// -----------------------------------------------------------------------------

/**
 * Fetch all round 1 packages sequentially.
 *
 * Port of `fetch_all_round1_packages()` from cmd/dkg/coordinator/round1.rs lines 243-299.
 */
async function fetchAllRound1Packages(
  ctx: Round1Context,
  pendingRequests: PendingRequests,
  timeout: number | undefined,
): Promise<[Round1Package[], NextResponseArid[]]> {
  const round1Packages: Round1Package[] = [];
  const nextResponseArids: NextResponseArid[] = [];
  const errors: [XID, string][] = [];

  for (const [participantXid, collectFromArid] of pendingRequests.iterCollect()) {
    const participant = ctx.registry.participant(participantXid);
    const participantName = participant?.petName() ?? participantXid.urString();

    try {
      const [pkg, nextArid] = await fetchRound1Response(
        ctx.client,
        collectFromArid,
        timeout,
        ctx.ownerDoc,
        ctx.groupId,
        participantName,
      );
      round1Packages.push([participantXid, pkg]);
      nextResponseArids.push([participantXid, nextArid]);
    } catch (e) {
      errors.push([participantXid, e instanceof Error ? e.message : String(e)]);
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
      `Round 1 collection incomplete: ${errors.length} of ${pendingRequests.len()} responses failed`,
    );
  }

  return [round1Packages, nextResponseArids];
}

/**
 * Collect round 1 responses sequentially.
 *
 * Port of `collect_round1_responses()` from cmd/dkg/coordinator/round1.rs lines 220-241.
 */
async function collectRound1Responses(
  ctx: Round1Context,
  pendingRequests: PendingRequests,
  timeout: number | undefined,
): Promise<Round1Collection> {
  if (isVerbose()) {
    console.error(`Collecting Round 1 responses from ${pendingRequests.len()} participants...`);
  }

  const [packages, nextResponseArids] = await fetchAllRound1Packages(ctx, pendingRequests, timeout);

  const displayPath = persistRound1Packages(ctx.registryPath, ctx.groupId, packages);

  updatePendingForRound2(ctx, nextResponseArids);

  return { packages, nextResponseArids, displayPath };
}

/**
 * Update pending requests for round 2 (sequential path).
 *
 * Port of `update_pending_for_round2()` from cmd/dkg/coordinator/round1.rs lines 342-357.
 */
function updatePendingForRound2(ctx: Round1Context, nextResponseArids: NextResponseArid[]): void {
  const newPending = new PendingRequests();
  for (const [xid, sendToArid] of nextResponseArids) {
    newPending.addSendOnly(xid, sendToArid);
  }
  const groupRecord = ctx.registry.groupMut(ctx.groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPending);
  ctx.registry.save(ctx.registryPath);
}

// -----------------------------------------------------------------------------
// Round 2 dispatch (sequential)
// -----------------------------------------------------------------------------

/**
 * Build participant info for round 2 dispatch.
 *
 * Port of `build_round2_participant_info()` from cmd/dkg/coordinator/round1.rs lines 438-458.
 */
function buildRound2ParticipantInfo(
  registry: Registry,
  nextResponseArids: NextResponseArid[],
): [XID, XIDDocument, ARID, ARID][] {
  return nextResponseArids.map(([xid, sendToArid]) => {
    const participant = registry.participant(xid);
    if (participant === undefined) {
      throw new Error(`Participant ${xid.urString()} not found in registry`);
    }
    const doc = participant.xidDocument();
    const collectFromArid = ARID.new();
    return [xid, doc, sendToArid, collectFromArid];
  });
}

/**
 * Update pending for round 2 collection (sequential path).
 *
 * Port of `update_pending_for_round2_collection()` from cmd/dkg/coordinator/round1.rs lines 460-475.
 */
function updatePendingForRound2Collection(
  ctx: Round1Context,
  participantInfo: [XID, XIDDocument, ARID, ARID][],
): void {
  const newPendingRequests = new PendingRequests();
  for (const [xid, , , collectFromArid] of participantInfo) {
    newPendingRequests.addCollectOnly(xid, collectFromArid);
  }
  const groupRecord = ctx.registry.groupMut(ctx.groupId);
  if (groupRecord === undefined) {
    throw new Error("Group not found in registry");
  }
  groupRecord.setPendingRequests(newPendingRequests);
  ctx.registry.save(ctx.registryPath);
}

/**
 * Dispatch Round 2 requests sequentially.
 *
 * Port of `dispatch_round2_requests()` from cmd/dkg/coordinator/round1.rs lines 363-436.
 */
async function dispatchRound2Requests(
  ctx: Round1Context,
  collection: Round1Collection,
  preview: boolean,
): Promise<[string, string] | undefined> {
  const signerPrivateKeys = ctx.ownerDoc.inceptionPrivateKeys();
  if (signerPrivateKeys === undefined) {
    throw new Error("Coordinator XID document has no signing keys");
  }

  const validUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  const participantInfo = buildRound2ParticipantInfo(ctx.registry, collection.nextResponseArids);

  if (isVerbose()) {
    console.error(`Sending Round 2 requests to ${participantInfo.length} participants...`);
  } else {
    // Blank line to separate get phase from put phase
    console.error();
  }

  let previewOutput: [string, string] | undefined;

  for (const [xid, recipientDoc, sendToArid, collectFromArid] of participantInfo) {
    const participant = ctx.registry.participant(xid);
    const participantName = participant?.petName() ?? xid.urString();

    const request = buildRound2RequestForParticipant(
      ctx.ownerDoc,
      ctx.groupId,
      collection.packages,
      collectFromArid,
    );

    if (preview && previewOutput === undefined) {
      const unsealedEnvelope = request.toEnvelope(validUntil, signerPrivateKeys, undefined);
      previewOutput = [participantName, unsealedEnvelope.urString()];
    }

    const sealedEnvelope = request.toEnvelope(validUntil, signerPrivateKeys, recipientDoc);

    await putWithIndicator(ctx.client, sendToArid, sealedEnvelope, participantName, isVerbose());
  }

  updatePendingForRound2Collection(ctx, participantInfo);

  return previewOutput;
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/**
 * Print summary for sequential collection.
 *
 * Port of `print_summary()` from cmd/dkg/coordinator/round1.rs lines 481-506.
 */
function printSummary(collection: Round1Collection, preview: [string, string] | undefined): void {
  if (preview !== undefined) {
    const [participantName, ur] = preview;
    if (isVerbose()) {
      console.error(`# Round 2 preview for ${participantName}`);
      console.error();
    }
    console.error(
      `Collected ${collection.packages.length} Round 1 packages to ${collection.displayPath} ` +
        `and sent ${collection.nextResponseArids.length} Round 2 requests.`,
    );
    console.log(ur);
  } else if (isVerbose()) {
    console.error();
    console.error(
      `Collected ${collection.packages.length} Round 1 packages to ${collection.displayPath} ` +
        `and sent ${collection.nextResponseArids.length} Round 2 requests.`,
    );
  }
}

/**
 * Print summary for parallel collection.
 *
 * Port of `print_summary_parallel()` from cmd/dkg/coordinator/round1.rs lines 847-901.
 */
function printSummaryParallel(
  collection: CollectionResult<Round1ResponseData>,
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
    bailWithCollectionSummary(collection);
  }

  if (preview !== undefined) {
    const [participantName, ur] = preview;
    if (isVerbose()) {
      console.error(`# Round 2 preview for ${participantName}`);
      console.error();
    }
    console.error(
      `Collected ${collection.successes.length} Round 1 packages to ${displayPath} ` +
        `and sent ${collection.successes.length} Round 2 requests.`,
    );
    console.log(ur);
  } else if (isVerbose()) {
    console.error();
    console.error(
      `Collected ${collection.successes.length} Round 1 packages to ${displayPath} ` +
        `and sent ${collection.successes.length} Round 2 requests.`,
    );
  }
}

/**
 * Print collection summary and throw error.
 *
 * Port of `bail_with_collection_summary()` from cmd/dkg/coordinator/round1.rs lines 903-913.
 */
function bailWithCollectionSummary(collection: CollectionResult<Round1ResponseData>): never {
  const msg =
    `Round 1 collection incomplete: ${collection.successes.length} succeeded, ` +
    `${collection.rejections.length} rejected, ${collection.errors.length} errors, ` +
    `${collection.timeouts.length} timeouts`;
  console.error(msg);
  throw new Error(msg);
}

// -----------------------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------------------

/**
 * Execute the DKG coordinator round 1 command.
 *
 * Collects commitment packages from participants.
 *
 * Port of `CommandArgs::exec()` from cmd/dkg/coordinator/round1.rs lines 59-173.
 */
export async function round1(
  client: StorageClient,
  options: DkgRound1Options,
  cwd: string,
): Promise<DkgRound1Result> {
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

  validateCoordinator(groupRecord, owner);

  const pendingRequests = groupRecord.pendingRequests();
  if (pendingRequests.isEmpty()) {
    throw new Error("No pending requests for this group. Round 1 may already be collected.");
  }

  if (options.parallel === true) {
    // Parallel path with progress display
    const collection = await collectRound1Parallel(
      client,
      registry,
      pendingRequests,
      ownerDoc,
      groupId,
      options.timeoutSeconds,
    );

    // Extract packages for persistence
    const packages: Round1Package[] = collection.successes.map(([xid, data]) => [
      xid,
      data.package,
    ]);

    const displayPath = persistRound1Packages(registryPath, groupId, packages);

    updatePendingForRound2FromCollection(registry, registryPath, groupId, collection.successes);

    const preview = await dispatchRound2RequestsParallel(
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
    };
  } else {
    // Sequential path (original behavior)
    const ctx: Round1Context = {
      client,
      registryPath,
      registry,
      ownerDoc,
      groupId,
    };

    const collection = await collectRound1Responses(ctx, pendingRequests, options.timeoutSeconds);

    const preview = await dispatchRound2Requests(ctx, collection, options.preview ?? false);

    printSummary(collection, preview);

    return {
      accepted: collection.packages.length,
      rejected: 0,
      errors: 0,
      timeouts: 0,
    };
  }
}
