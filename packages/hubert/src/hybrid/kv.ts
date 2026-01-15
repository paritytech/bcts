/**
 * Hybrid storage layer combining Mainline DHT and IPFS.
 *
 * Port of hybrid/kv.rs from hubert-rust.
 *
 * @module
 */

import { ARID } from "@bcts/components";
import { type Envelope } from "@bcts/envelope";

import { type KvStore } from "../kv-store.js";
import { verbosePrintln } from "../logging.js";
import { IpfsKv } from "../ipfs/kv.js";
import { MainlineDhtKv } from "../mainline/kv.js";
import { ContentNotFoundError } from "./error.js";
import { createReferenceEnvelope, extractReferenceArid, isReferenceEnvelope } from "./reference.js";

/**
 * Hybrid storage layer combining Mainline DHT and IPFS.
 *
 * Automatically optimizes storage based on envelope size:
 * - **Small envelopes (≤1000 bytes)**: Stored directly in DHT
 * - **Large envelopes (>1000 bytes)**: Reference in DHT → actual envelope in IPFS
 *
 * This provides the best of both worlds:
 * - Fast lookups for small messages via DHT
 * - Large capacity for big messages via IPFS
 * - Transparent indirection handled automatically
 *
 * Port of `struct HybridKv` from hybrid/kv.rs lines 59-63.
 *
 * # Requirements
 *
 * - No external daemon for DHT (embedded client)
 * - Requires Kubo daemon for IPFS (http://127.0.0.1:5001)
 *
 * @category Hybrid Backend
 *
 * @example
 * ```typescript
 * const store = await HybridKv.create("http://127.0.0.1:5001");
 *
 * // Small envelope → DHT only
 * const arid1 = ARID.new();
 * const small = Envelope.new("Small message");
 * await store.put(arid1, small);
 *
 * // Large envelope → DHT reference + IPFS
 * const arid2 = ARID.new();
 * const large = Envelope.new("x".repeat(2000));
 * await store.put(arid2, large);
 *
 * // Get works the same for both
 * const retrieved1 = await store.get(arid1);
 * const retrieved2 = await store.get(arid2);
 * ```
 */
export class HybridKv implements KvStore {
  private readonly dht: MainlineDhtKv;
  private ipfs: IpfsKv;
  private dhtSizeLimit: number;

  /**
   * Private constructor - use `create()` factory method.
   */
  private constructor(dht: MainlineDhtKv, ipfs: IpfsKv) {
    this.dht = dht;
    this.ipfs = ipfs;
    this.dhtSizeLimit = 1000; // Conservative DHT limit
  }

  /**
   * Create a new Hybrid KV store with default settings.
   *
   * Port of `HybridKv::new()` from hybrid/kv.rs lines 75-84.
   *
   * @param ipfsRpcUrl - IPFS RPC endpoint (e.g., "http://127.0.0.1:5001")
   */
  static async create(ipfsRpcUrl: string): Promise<HybridKv> {
    const dht = await MainlineDhtKv.create();
    const ipfs = new IpfsKv(ipfsRpcUrl);

    return new HybridKv(dht, ipfs);
  }

  /**
   * Set custom DHT size limit (default: 1000 bytes).
   *
   * Envelopes larger than this will use IPFS indirection.
   *
   * Port of `HybridKv::with_dht_size_limit()` from hybrid/kv.rs lines 89-92.
   */
  withDhtSizeLimit(limit: number): this {
    this.dhtSizeLimit = limit;
    return this;
  }

  /**
   * Set whether to pin content in IPFS (default: false).
   *
   * Only affects envelopes stored in IPFS (when larger than DHT limit).
   *
   * Port of `HybridKv::with_pin_content()` from hybrid/kv.rs lines 97-100.
   */
  withPinContent(pin: boolean): this {
    this.ipfs = this.ipfs.withPinContent(pin);
    return this;
  }

  /**
   * Check if an envelope fits in the DHT.
   *
   * Port of `HybridKv::fits_in_dht()` from hybrid/kv.rs lines 103-106.
   *
   * @internal
   */
  private fitsInDht(envelope: Envelope): boolean {
    const serialized = envelope.taggedCborData;
    return serialized.length <= this.dhtSizeLimit;
  }

  /**
   * Store an envelope at the given ARID.
   *
   * Port of `KvStore::put()` implementation from hybrid/kv.rs lines 109-168.
   */
  async put(
    arid: ARID,
    envelope: Envelope,
    ttlSeconds?: number,
    verbose?: boolean,
  ): Promise<string> {
    // Check if it fits in DHT
    if (this.fitsInDht(envelope)) {
      // Store directly in DHT (DHT handles obfuscation)
      if (verbose) {
        verbosePrintln(`Storing envelope in DHT (size ≤ ${this.dhtSizeLimit} bytes)`);
      }
      await this.dht.put(arid, envelope, ttlSeconds, verbose);
      return `Stored in DHT at ARID: ${arid.urString()}`;
    } else {
      // Use IPFS with DHT reference
      if (verbose) {
        verbosePrintln("Envelope too large for DHT, using IPFS indirection");
      }

      // 1. Store actual envelope in IPFS with a new ARID
      //    (IPFS handles obfuscation with reference_arid)
      const referenceArid = ARID.new();
      if (verbose) {
        verbosePrintln(
          `Storing actual envelope in IPFS with reference ARID: ${referenceArid.urString()}`,
        );
      }
      await this.ipfs.put(referenceArid, envelope, ttlSeconds, verbose);

      // 2. Create reference envelope
      const envelopeSize = envelope.taggedCborData.length;
      const reference = createReferenceEnvelope(referenceArid, envelopeSize);

      // 3. Store reference envelope in DHT at original ARID
      //    (DHT handles obfuscation with original arid)
      if (verbose) {
        verbosePrintln("Storing reference envelope in DHT at original ARID");
      }
      await this.dht.put(arid, reference, ttlSeconds, verbose);

      return `Stored in IPFS (ref: ${referenceArid.urString()}) via DHT at ARID: ${arid.urString()}`;
    }
  }

  /**
   * Retrieve an envelope for the given ARID.
   *
   * Port of `KvStore::get()` implementation from hybrid/kv.rs lines 171-230.
   */
  async get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | null> {
    // 1. Try to get from DHT (DHT handles deobfuscation)
    const dhtEnvelope = await this.dht.get(arid, timeoutSeconds, verbose);

    if (dhtEnvelope === null) {
      return null;
    }

    // 2. Check if the envelope is a reference envelope
    if (isReferenceEnvelope(dhtEnvelope)) {
      if (verbose) {
        verbosePrintln("Found reference envelope, fetching actual envelope from IPFS");
      }

      // 3. Extract reference ARID
      const referenceArid = extractReferenceArid(dhtEnvelope);

      if (verbose) {
        verbosePrintln(`Reference ARID: ${referenceArid.urString()}`);
      }

      // 4. Retrieve actual envelope from IPFS
      //    (IPFS handles deobfuscation with reference_arid)
      const ipfsEnvelope = await this.ipfs.get(referenceArid, timeoutSeconds, verbose);

      if (ipfsEnvelope === null) {
        throw new ContentNotFoundError();
      }

      if (verbose) {
        verbosePrintln("Successfully retrieved actual envelope from IPFS");
      }
      return ipfsEnvelope;
    } else {
      // Not a reference envelope, return it directly
      if (verbose) {
        verbosePrintln("Envelope is not a reference, treating as direct payload");
      }
      return dhtEnvelope;
    }
  }

  /**
   * Check if an envelope exists at the given ARID.
   *
   * Port of `KvStore::exists()` implementation from hybrid/kv.rs lines 254-257.
   */
  async exists(arid: ARID): Promise<boolean> {
    // Check DHT only (references count as existing)
    return await this.dht.exists(arid);
  }

  /**
   * Destroy the hybrid store and release resources.
   */
  async destroy(): Promise<void> {
    await this.dht.destroy();
  }
}
