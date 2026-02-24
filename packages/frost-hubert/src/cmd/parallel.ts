/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Parallel fetch and send utilities for coordinator commands.
 *
 * This module provides utilities for fetching responses from multiple
 * participants in parallel with progress display.
 *
 * Port of cmd/parallel.rs from frost-hubert-rust.
 *
 * @module
 */

import { type ARID, type XID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { type StorageClient } from "./storage.js";

/**
 * Status of a participant's response fetch.
 *
 * Port of `enum FetchStatus` from cmd/parallel.rs.
 */
export type FetchStatus =
  | { type: "Pending" }
  | { type: "Success"; envelope: Envelope }
  | { type: "Rejected"; reason: string }
  | { type: "Error"; error: string }
  | { type: "Timeout" };

/**
 * Create a Pending status.
 */
export function fetchStatusPending(): FetchStatus {
  return { type: "Pending" };
}

/**
 * Create a Success status.
 */
export function fetchStatusSuccess(envelope: Envelope): FetchStatus {
  return { type: "Success", envelope };
}

/**
 * Create a Rejected status.
 */
export function fetchStatusRejected(reason: string): FetchStatus {
  return { type: "Rejected", reason };
}

/**
 * Create an Error status.
 */
export function fetchStatusError(error: string): FetchStatus {
  return { type: "Error", error };
}

/**
 * Create a Timeout status.
 */
export function fetchStatusTimeout(): FetchStatus {
  return { type: "Timeout" };
}

/**
 * Direction of the operation (get or put).
 *
 * Port of `enum Direction` from cmd/parallel.rs.
 */
export enum Direction {
  /** Downloading from storage */
  Get = "Get",
  /** Uploading to storage */
  Put = "Put",
}

/**
 * Get the emoji for a direction.
 *
 * Port of `Direction::emoji()` from cmd/parallel.rs.
 */
export function directionEmoji(direction: Direction): string {
  switch (direction) {
    case Direction.Get:
      return "⬇️";
    case Direction.Put:
      return "⬆️";
  }
}

/**
 * Configuration for parallel fetch operations.
 *
 * Port of `struct ParallelFetchConfig` from cmd/parallel.rs.
 */
export interface ParallelFetchConfig {
  /** Maximum time to wait for all responses (in seconds) */
  timeoutSeconds?: number | undefined;
  /** Whether to show verbose output */
  verbose?: boolean | undefined;
}

/**
 * Default timeout in seconds (10 minutes).
 */
export const DEFAULT_TIMEOUT_SECONDS = 600;

/**
 * Create a config with the specified timeout.
 */
export function parallelFetchConfigWithTimeout(timeoutSeconds?: number): ParallelFetchConfig {
  return { timeoutSeconds };
}

/**
 * Result of collecting responses from multiple participants.
 *
 * Port of `struct CollectionResult` from cmd/parallel.rs.
 */
export class CollectionResult<T> {
  /** Successful responses as [XID, T] tuples */
  successes: [XID, T][];
  /** Participants who explicitly rejected as [XID, reason] tuples */
  rejections: [XID, string][];
  /** Participants with network/parsing errors as [XID, error] tuples */
  errors: [XID, string][];
  /** Participants who timed out */
  timeouts: XID[];

  constructor() {
    this.successes = [];
    this.rejections = [];
    this.errors = [];
    this.timeouts = [];
  }

  /**
   * Check if enough responses were received to proceed.
   *
   * Port of `CollectionResult::can_proceed()` from cmd/parallel.rs.
   */
  canProceed(minRequired: number): boolean {
    return this.successes.length >= minRequired;
  }

  /**
   * Total number of participants.
   *
   * Port of `CollectionResult::total()` from cmd/parallel.rs.
   */
  total(): number {
    return (
      this.successes.length + this.rejections.length + this.errors.length + this.timeouts.length
    );
  }

  /**
   * Check if all responses succeeded.
   *
   * Port of `CollectionResult::all_succeeded()` from cmd/parallel.rs.
   */
  allSucceeded(): boolean {
    return this.rejections.length === 0 && this.errors.length === 0 && this.timeouts.length === 0;
  }
}

/**
 * Create an empty collection result.
 */
export function emptyCollectionResult<T>(): CollectionResult<T> {
  return new CollectionResult<T>();
}

/**
 * Helper to build request tuples from pending requests and registry.
 *
 * Port of `build_fetch_requests()` from cmd/parallel.rs.
 */
export function buildFetchRequests(
  pending: Iterable<[XID, ARID]>,
  getName: (xid: XID) => string,
): [XID, ARID, string][] {
  const requests: [XID, ARID, string][] = [];
  for (const [xid, arid] of pending) {
    const name = getName(xid);
    requests.push([xid, arid, name]);
  }
  return requests;
}

/**
 * Simple progress output for non-interactive terminals.
 */
function logProgress(
  direction: Direction,
  name: string,
  status: "success" | "error" | "timeout",
  message?: string,
): void {
  const emoji = directionEmoji(direction);
  switch (status) {
    case "success":
      console.error(`${emoji}  ✅ ${name}`);
      break;
    case "error":
      console.error(`${emoji}  ❌ ${name}: ${message ?? "Error"}`);
      break;
    case "timeout":
      console.error(`${emoji}  ❌ ${name}: Timeout`);
      break;
  }
}

/**
 * Fetch messages from multiple ARIDs in parallel.
 *
 * Port of `parallel_fetch()` from cmd/parallel.rs.
 */
export async function parallelFetch<T>(
  client: StorageClient,
  requests: [XID, ARID, string][],
  validate: (envelope: Envelope, xid: XID) => T | { rejected: string },
  config: ParallelFetchConfig,
): Promise<CollectionResult<T>> {
  const result = new CollectionResult<T>();
  const timeoutSeconds = config.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;

  if (config.verbose === true) {
    console.error(`Waiting for ${requests.length} responses...`);
  }

  const promises = requests.map(async ([xid, arid, name]) => {
    try {
      const envelope = await client.get(arid, timeoutSeconds);

      if (!envelope) {
        result.timeouts.push(xid);
        if (config.verbose === true) {
          logProgress(Direction.Get, name, "timeout");
        }
        return;
      }

      const parsed = validate(envelope, xid);

      if (parsed !== null && typeof parsed === "object" && "rejected" in parsed) {
        result.rejections.push([xid, parsed.rejected]);
        if (config.verbose === true) {
          logProgress(Direction.Get, name, "error", parsed.rejected);
        }
      } else {
        result.successes.push([xid, parsed]);
        if (config.verbose === true) {
          logProgress(Direction.Get, name, "success");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Timeout") || errorMessage.includes("timeout")) {
        result.timeouts.push(xid);
        if (config.verbose === true) {
          logProgress(Direction.Get, name, "timeout");
        }
      } else {
        result.errors.push([xid, `${name}: ${errorMessage}`]);
        if (config.verbose === true) {
          logProgress(Direction.Get, name, "error", errorMessage);
        }
      }
    }
  });

  await Promise.all(promises);

  if (config.verbose === true) {
    console.error(`Collected ${result.successes.length} responses`);
    if (result.rejections.length > 0) {
      console.error(`  ${result.rejections.length} rejections`);
    }
    if (result.errors.length > 0) {
      console.error(`  ${result.errors.length} errors`);
    }
    if (result.timeouts.length > 0) {
      console.error(`  ${result.timeouts.length} timeouts`);
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
  messages: [XID, ARID, Envelope, string][],
  verbose?: boolean,
): Promise<[XID, Error | null][]> {
  const results: [XID, Error | null][] = [];

  if (verbose === true) {
    console.error(`Sending to ${messages.length} participants...`);
  }

  const promises = messages.map(async ([xid, arid, envelope, name]) => {
    try {
      await client.put(arid, envelope);
      results.push([xid, null]);
      if (verbose === true) {
        logProgress(Direction.Put, name, "success");
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      results.push([xid, err]);
      if (verbose === true) {
        logProgress(Direction.Put, name, "error", err.message);
      }
    }
  });

  await Promise.all(promises);

  if (verbose === true) {
    const successes = results.filter(([_, err]) => err === null).length;
    const failures = results.length - successes;
    console.error(`Sent ${successes} messages`);
    if (failures > 0) {
      console.error(`  ${failures} failed`);
    }
  }

  return results;
}
