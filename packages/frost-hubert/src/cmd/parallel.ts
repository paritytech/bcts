/**
 * Parallel fetch and send operations.
 *
 * Port of cmd/parallel.rs from frost-hubert-rust.
 *
 * @module
 */

import { type ARID, type XID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { type StorageClient } from "./storage.js";

/**
 * Configuration for parallel fetch operations.
 *
 * Port of `struct ParallelFetchConfig` from cmd/parallel.rs.
 */
export interface ParallelFetchConfig {
  timeoutSeconds?: number | undefined;
  verbose?: boolean | undefined;
}

/**
 * Result of a collection operation.
 *
 * Port of `struct CollectionResult` from cmd/parallel.rs.
 */
export interface CollectionResult<T> {
  successes: Map<string, T>; // Map by XID UR string
  rejections: Map<string, string>; // Map by XID UR string -> reason
  errors: Map<string, Error>; // Map by XID UR string -> error
  timeouts: string[]; // XID UR strings that timed out
}

/**
 * Create an empty collection result.
 */
export function emptyCollectionResult<T>(): CollectionResult<T> {
  return {
    successes: new Map(),
    rejections: new Map(),
    errors: new Map(),
    timeouts: [],
  };
}

/**
 * Fetch messages from multiple ARIDs in parallel.
 *
 * Port of `parallel_fetch()` from cmd/parallel.rs.
 */
export async function parallelFetch<T>(
  client: StorageClient,
  targets: { xid: XID; arid: ARID }[],
  parser: (envelope: Envelope, xid: XID) => T | { rejected: string },
  config: ParallelFetchConfig,
): Promise<CollectionResult<T>> {
  const result = emptyCollectionResult<T>();

  const promises = targets.map(async ({ xid, arid }) => {
    try {
      const envelope = await client.get(arid, config.timeoutSeconds);

      if (!envelope) {
        result.timeouts.push(xid.urString());
        return;
      }

      const parsed = parser(envelope, xid);

      if (parsed !== null && typeof parsed === "object" && "rejected" in parsed) {
        result.rejections.set(xid.urString(), parsed.rejected);
      } else {
        result.successes.set(xid.urString(), parsed);
      }
    } catch (error) {
      result.errors.set(xid.urString(), error as Error);
    }
  });

  await Promise.all(promises);

  if (config.verbose === true) {
    console.log(`Collected ${result.successes.size} responses`);
    if (result.rejections.size > 0) {
      console.log(`  ${result.rejections.size} rejections`);
    }
    if (result.errors.size > 0) {
      console.log(`  ${result.errors.size} errors`);
    }
    if (result.timeouts.length > 0) {
      console.log(`  ${result.timeouts.length} timeouts`);
    }
  }

  return result;
}

/**
 * Send messages to multiple ARIDs in parallel.
 *
 * Port of `parallel_send()` from cmd/parallel.rs.
 */
export async function parallelSend(
  client: StorageClient,
  messages: { xid: XID; arid: ARID; envelope: Envelope }[],
  verbose?: boolean,
): Promise<{ successes: string[]; errors: Map<string, Error> }> {
  const successes: string[] = [];
  const errors = new Map<string, Error>();

  const promises = messages.map(async ({ xid, arid, envelope }) => {
    try {
      await client.put(arid, envelope);
      successes.push(xid.urString());
    } catch (error) {
      errors.set(xid.urString(), error as Error);
    }
  });

  await Promise.all(promises);

  if (verbose === true) {
    console.log(`Sent ${successes.length} messages`);
    if (errors.size > 0) {
      console.log(`  ${errors.size} failed`);
    }
  }

  return { successes, errors };
}
