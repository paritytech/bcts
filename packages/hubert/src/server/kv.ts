/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Server-backed key-value store using HTTP API.
 *
 * Port of server/kv.rs from hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";

import { AlreadyExistsError } from "../error.js";
import { type KvStore } from "../kv-store.js";
import { verboseNewline, verbosePrintDot, verbosePrintln } from "../logging.js";
import { ServerGeneralError, ServerNetworkError, ServerParseError } from "./error.js";

/**
 * Server-backed key-value store using HTTP API.
 *
 * This implementation communicates with a Hubert server via HTTP POST requests.
 *
 * Port of `struct ServerKvClient` from server/kv.rs lines 6-37.
 *
 * @category Server Backend
 *
 * @example
 * ```typescript
 * const store = new ServerKvClient("http://127.0.0.1:45678");
 * const arid = ARID.new();
 * const envelope = Envelope.new("Hello, Server!");
 *
 * // Put envelope (write-once)
 * await store.put(arid, envelope);
 *
 * // Get envelope with verbose logging
 * const retrieved = await store.get(arid, undefined, true);
 * ```
 */
export class ServerKvClient implements KvStore {
  private readonly baseUrl: string;

  /**
   * Create a new server KV store client.
   *
   * Port of `ServerKvClient::new()` from server/kv.rs lines 39-46.
   *
   * @param baseUrl - Base URL of the Hubert server (e.g., "http://127.0.0.1:45678")
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Store an envelope at the given ARID.
   *
   * Port of `KvStore::put()` implementation from server/kv.rs lines 67-122.
   */
  async put(
    arid: ARID,
    envelope: Envelope,
    ttlSeconds?: number,
    verbose?: boolean,
  ): Promise<string> {
    if (verbose) {
      verbosePrintln("Starting server put operation");
    }

    // Format body with optional TTL on third line
    let body: string;
    if (ttlSeconds !== undefined) {
      body = `${arid.urString()}\n${envelope.urString()}\n${ttlSeconds}`;
    } else {
      body = `${arid.urString()}\n${envelope.urString()}`;
    }

    if (verbose) {
      verbosePrintln("Sending PUT request to server");
    }

    try {
      const response = await fetch(`${this.baseUrl}/put`, {
        method: "POST",
        body,
        headers: {
          "Content-Type": "text/plain",
        },
      });

      if (response.status === 200) {
        if (verbose) {
          verbosePrintln("Server put operation completed");
        }
        return "Stored successfully";
      } else if (response.status === 409) {
        if (verbose) {
          verbosePrintln("Server put operation failed");
        }
        throw new AlreadyExistsError(arid.urString());
      } else {
        if (verbose) {
          verbosePrintln("Server put operation failed");
        }
        const errorMsg = await response.text();
        throw new ServerGeneralError(errorMsg);
      }
    } catch (error) {
      if (error instanceof AlreadyExistsError || error instanceof ServerGeneralError) {
        throw error;
      }
      throw new ServerNetworkError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Retrieve an envelope for the given ARID.
   *
   * Port of `KvStore::get()` implementation from server/kv.rs lines 124-212.
   */
  async get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | null> {
    let printedDot = false;

    if (verbose) {
      verbosePrintln("Starting server get operation");
    }

    const timeout = timeoutSeconds ?? 30; // Default 30 seconds
    const deadline = Date.now() + timeout * 1000;
    // Changed to 1000ms for verbose mode polling
    const pollInterval = 1000;

    if (verbose) {
      verbosePrintln("Polling server for value");
    }

    while (true) {
      const body = arid.urString();

      try {
        const response = await fetch(`${this.baseUrl}/get`, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "text/plain",
          },
        });

        if (response.status === 200) {
          if (verbose && printedDot) {
            verboseNewline();
          }
          if (verbose) {
            verbosePrintln("Value found on server");
          }

          const envelopeStr = await response.text();
          try {
            const envelope = Envelope.fromUrString(envelopeStr);

            if (verbose) {
              verbosePrintln("Server get operation completed");
            }

            return envelope;
          } catch (error) {
            throw new ServerParseError(error instanceof Error ? error.message : String(error));
          }
        } else if (response.status === 404) {
          // Not found yet - check if we should keep polling
          if (Date.now() >= deadline) {
            // Timeout reached
            if (verbose && printedDot) {
              verboseNewline();
            }
            if (verbose) {
              verbosePrintln("Timeout reached, value not found");
            }
            return null;
          }

          // Print polling dot if verbose
          if (verbose) {
            verbosePrintDot();
            printedDot = true;
          }

          // Wait before retrying (now 1000ms)
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        } else {
          const errorMsg = await response.text();
          throw new ServerGeneralError(errorMsg);
        }
      } catch (error) {
        if (error instanceof ServerGeneralError || error instanceof ServerParseError) {
          throw error;
        }
        throw new ServerNetworkError(error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Check if an envelope exists at the given ARID.
   *
   * Port of `KvStore::exists()` implementation from server/kv.rs lines 214-218.
   */
  async exists(arid: ARID): Promise<boolean> {
    // Use a short timeout for exists check (1 second), no verbose
    const result = await this.get(arid, 1, false);
    return result !== null;
  }
}
