/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * KvStore interface for key-value storage backends using ARID-based addressing.
 *
 * Port of kv_store.rs from hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

/**
 * Unified interface for key-value storage backends using ARID-based addressing.
 *
 * All implementations provide write-once semantics: once an envelope is stored
 * at an ARID, subsequent attempts to write to the same ARID will fail with an
 * `AlreadyExistsError`.
 *
 * ## Security Model
 *
 * - ARID holder can read (by deriving storage key)
 * - ARID creator can write once (by deriving storage key)
 * - Storage networks see only derived keys, never ARIDs themselves
 * - ARIDs shared only via secure channels (GSTP, Signal, QR codes)
 *
 * ## Implementations
 *
 * - `MainlineDhtKv`: Fast, lightweight DHT storage (≤1 KB messages)
 * - `IpfsKv`: Large capacity, content-addressed storage (up to 10 MB messages)
 * - `HybridKv`: Automatic optimization by size, combining DHT speed with IPFS capacity
 * - `ServerKvClient`: HTTP client for centralized server backend
 *
 * Port of `trait KvStore` from kv_store.rs lines 81-214.
 *
 * @category KvStore Interface
 */
export interface KvStore {
  /**
   * Store an envelope at the given ARID.
   *
   * ## Write-Once Semantics
   *
   * This operation will fail if the ARID already exists. The implementation
   * must check for existence before writing and return an appropriate error
   * if the key is already present.
   *
   * @param arid - Cryptographic identifier for this storage location
   * @param envelope - The envelope to store
   * @param ttlSeconds - Optional time-to-live in seconds. After this time, the
   *   envelope may be removed from storage.
   *   - **Mainline DHT**: Ignored (no TTL support)
   *   - **IPFS**: Used as IPNS record lifetime (default: 24h if undefined)
   *   - **Server**: Clamped to max_ttl if exceeded; uses max_ttl if undefined.
   *     All entries expire (hubert is for coordination, not long-term storage).
   * @param verbose - If true, log operations with timestamps
   * @returns A receipt containing storage metadata on success
   * @throws {AlreadyExistsError} If the ARID already exists
   * @throws {Error} If the envelope is too large for this backend
   * @throws {Error} If network operation fails
   * @throws {Error} If serialization fails
   *
   * @example
   * ```typescript
   * const arid = ARID.new();
   * const envelope = Envelope.new("Hello, Hubert!");
   *
   * // Store without TTL
   * const receipt = await store.put(arid, envelope);
   *
   * // Store with 1 hour TTL and verbose logging
   * const arid2 = ARID.new();
   * const receipt2 = await store.put(arid2, envelope, 3600, true);
   * console.log("Stored at:", receipt2);
   * ```
   */
  put(arid: ARID, envelope: Envelope, ttlSeconds?: number, verbose?: boolean): Promise<string>;

  /**
   * Retrieve an envelope for the given ARID.
   *
   * Polls the storage backend until the envelope becomes available or the
   * timeout is reached. This is useful for coordinating between parties
   * where one party puts data and another polls for it.
   *
   * @param arid - The ARID to look up
   * @param timeoutSeconds - Maximum time to wait for the envelope to appear. If
   *   undefined, uses a backend-specific default (typically 30 seconds). After
   *   timeout, returns `null` rather than continuing to poll.
   * @param verbose - If true, log operations with timestamps and print polling dots
   * @returns The envelope if found within the timeout, or `null` if not found
   * @throws {Error} On network or deserialization errors
   *
   * @example
   * ```typescript
   * // Wait up to 10 seconds for envelope to appear with verbose logging
   * const envelope = await store.get(arid, 10, true);
   * if (envelope) {
   *   console.log("Found:", envelope);
   * } else {
   *   console.log("Not found within timeout");
   * }
   * ```
   */
  get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | null>;

  /**
   * Check if an envelope exists at the given ARID.
   *
   * @param arid - The ARID to check
   * @returns `true` if the ARID exists, `false` otherwise
   * @throws {Error} On network errors
   *
   * ## Implementation Note
   *
   * For hybrid storage, this only checks the DHT layer. Reference envelopes
   * count as existing even if the referenced IPFS content is not available.
   *
   * @example
   * ```typescript
   * if (await store.exists(arid)) {
   *   console.log("ARID already used");
   * } else {
   *   console.log("ARID available");
   * }
   * ```
   */
  exists(arid: ARID): Promise<boolean>;
}
