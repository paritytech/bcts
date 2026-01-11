/**
 * In-memory key-value store for Gordian Envelopes.
 *
 * Port of server/memory_kv.rs from hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { AlreadyExistsError } from "../error.js";
import { type KvStore } from "../kv-store.js";
import { verbosePrintln } from "../logging.js";

/**
 * Storage entry with envelope data and optional expiration.
 * @internal
 */
interface StorageEntry {
  /** CBOR-encoded envelope data */
  envelopeCbor: Uint8Array;
  /** Expiration timestamp in milliseconds, or undefined for no expiration */
  expiresAt?: number;
}

/**
 * In-memory key-value store for Gordian Envelopes.
 *
 * Provides volatile storage with TTL support and automatic cleanup of
 * expired entries.
 *
 * Port of `struct MemoryKv` from server/memory_kv.rs lines 14-21.
 *
 * @category Server Backend
 *
 * @example
 * ```typescript
 * const store = new MemoryKv();
 * const arid = ARID.new();
 * const envelope = Envelope.wrap("Hello, Memory!");
 *
 * await store.put(arid, envelope, 3600); // 1 hour TTL
 * const result = await store.get(arid);
 * ```
 */
export class MemoryKv implements KvStore {
  private storage: Map<string, StorageEntry>;

  /**
   * Create a new in-memory key-value store.
   *
   * Port of `MemoryKv::new()` from server/memory_kv.rs lines 29-33.
   */
  constructor() {
    this.storage = new Map();
  }

  /**
   * Check if an ARID exists and is not expired.
   *
   * Port of `check_exists()` from server/memory_kv.rs lines 36-53.
   *
   * @internal
   */
  private checkExists(arid: ARID): boolean {
    const key = arid.urString;
    const entry = this.storage.get(key);

    if (entry) {
      if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
        // Entry is expired, remove it
        this.storage.delete(key);
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Store an envelope at the given ARID.
   *
   * Port of `KvStore::put()` implementation from server/memory_kv.rs lines 62-102.
   */
  async put(
    arid: ARID,
    envelope: Envelope,
    ttlSeconds?: number,
    verbose?: boolean,
  ): Promise<string> {
    const key = arid.urString;

    // Check if already exists
    if (this.storage.has(key)) {
      if (verbose) {
        verbosePrintln(`PUT ${key} ALREADY_EXISTS`);
      }
      throw new AlreadyExistsError(key);
    }

    const expiresAt = ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined;
    const envelopeCbor = envelope.cborData;

    this.storage.set(key, { envelopeCbor, expiresAt });

    if (verbose) {
      const ttlMsg = ttlSeconds !== undefined ? ` (TTL ${ttlSeconds}s)` : "";
      verbosePrintln(`PUT ${key}${ttlMsg} OK (Memory)`);
    }

    return "Stored in memory";
  }

  /**
   * Retrieve an envelope for the given ARID.
   *
   * Port of `KvStore::get()` implementation from server/memory_kv.rs lines 104-181.
   */
  async get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | null> {
    const timeout = timeoutSeconds ?? 30;
    const start = Date.now();
    let firstAttempt = true;
    const key = arid.urString;

    // Dynamic import to avoid circular dependencies
    const { Envelope } = await import("@bcts/envelope");

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const entry = this.storage.get(key);

      if (entry) {
        // Check if expired
        if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
          // Entry is expired, remove it
          this.storage.delete(key);
          if (verbose) {
            verbosePrintln(`GET ${key} EXPIRED`);
          }
          return null;
        }

        // Parse CBOR bytes back to Envelope
        try {
          const envelope = Envelope.fromCborData(entry.envelopeCbor);
          if (verbose) {
            verbosePrintln(`GET ${key} OK (Memory)`);
          }
          return envelope;
        } catch {
          // If parsing fails, treat as not found
          return null;
        }
      }

      // Not found yet
      const elapsed = (Date.now() - start) / 1000;
      if (elapsed >= timeout) {
        if (verbose) {
          verbosePrintln(`GET ${key} NOT_FOUND (timeout after ${timeout}s)`);
        }
        return null;
      }

      if (firstAttempt && verbose) {
        verbosePrintln(`Polling for ${key} (timeout: ${timeout}s)`);
        firstAttempt = false;
      } else if (verbose) {
        process.stdout.write(".");
      }

      // Wait 500ms before polling again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Check if an envelope exists at the given ARID.
   *
   * Port of `KvStore::exists()` implementation from server/memory_kv.rs lines 183-186.
   */
  async exists(arid: ARID): Promise<boolean> {
    return this.checkExists(arid);
  }
}
