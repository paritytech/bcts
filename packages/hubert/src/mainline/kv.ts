/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Mainline DHT-backed key-value store using ARID-based addressing.
 *
 * Port of mainline/kv.rs from hubert-rust.
 *
 * @module
 */

import crypto from "node:crypto";
import { type ARID } from "@bcts/components";
import { type Envelope, EnvelopeDecoder } from "@bcts/envelope";
// @ts-expect-error - bittorrent-dht has no type declarations
import DHT from "bittorrent-dht";
import { ed25519 } from "@noble/curves/ed25519.js";

import { AlreadyExistsError } from "../error.js";
import { type KvStore } from "../kv-store.js";
import { deriveMainlineKey, obfuscateWithArid } from "../arid-derivation.js";
import { verboseNewline, verbosePrintDot, verbosePrintln } from "../logging.js";
import { DhtError, PutMutableError, ValueTooLargeError } from "./error.js";

/**
 * Mainline DHT-backed key-value store using ARID-based addressing.
 *
 * This implementation uses:
 * - ARID → ed25519 signing key derivation (deterministic)
 * - BEP-44 mutable storage (fixed location based on pubkey)
 * - Mainline DHT (BitTorrent DHT) for decentralized storage
 * - Write-once semantics (seq=1, put fails if already exists)
 * - Maximum value size: 1000 bytes (DHT protocol limit)
 *
 * Port of `struct MainlineDhtKv` from mainline/kv.rs lines 60-64.
 *
 * # Storage Model
 *
 * Uses BEP-44 mutable items where:
 * - Public key derived from ARID (deterministic ed25519)
 * - Sequence number starts at 1 (write-once)
 * - Optional salt for namespace separation
 * - Location fixed by pubkey (not content hash)
 *
 * # Requirements
 *
 * No external daemon required - the DHT client runs embedded.
 *
 * # Size Limits
 *
 * The Mainline DHT has a practical limit of ~1KB per value. For larger
 * envelopes, use `IpfsKv` or `HybridKv` instead.
 *
 * @category Mainline Backend
 *
 * @example
 * ```typescript
 * const store = await MainlineDhtKv.create();
 * const arid = ARID.new();
 * const envelope = Envelope.new("Small message");
 *
 * // Put envelope (write-once)
 * await store.put(arid, envelope);
 *
 * // Get envelope with verbose logging
 * const retrieved = await store.get(arid, undefined, true);
 * ```
 */
export class MainlineDhtKv implements KvStore {
  private readonly dht: DHT;
  private maxValueSize: number;
  private salt: Uint8Array | undefined;
  private _isBootstrapped: boolean;

  /**
   * Private constructor - use `create()` factory method.
   */
  private constructor(dht: DHT) {
    this.dht = dht;
    this.maxValueSize = 1000; // DHT protocol limit
    this.salt = undefined;
    this._isBootstrapped = false;
  }

  /**
   * Check if the DHT is bootstrapped.
   */
  get isBootstrapped(): boolean {
    return this._isBootstrapped;
  }

  /**
   * Create a new Mainline DHT KV store with default settings.
   *
   * Port of `MainlineDhtKv::new()` from mainline/kv.rs lines 68-79.
   */
  static async create(): Promise<MainlineDhtKv> {
    const dht = new DHT();

    const instance = new MainlineDhtKv(dht);

    // Wait for bootstrap
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new DhtError("Bootstrap timeout"));
      }, 30000);

      dht.on("ready", () => {
        clearTimeout(timeout);
        instance._isBootstrapped = true;
        resolve();
      });

      dht.on("error", (err: Error) => {
        clearTimeout(timeout);
        reject(new DhtError(err.message));
      });
    });

    return instance;
  }

  /**
   * Set the maximum value size (default: 1000 bytes).
   *
   * Note: Values larger than ~1KB may not be reliably stored in the DHT.
   *
   * Port of `MainlineDhtKv::with_max_size()` from mainline/kv.rs lines 84-87.
   */
  withMaxSize(size: number): this {
    this.maxValueSize = size;
    return this;
  }

  /**
   * Set a salt for namespace separation.
   *
   * Different salts will create separate namespaces for the same ARID.
   *
   * Port of `MainlineDhtKv::with_salt()` from mainline/kv.rs lines 92-95.
   */
  withSalt(salt: Uint8Array): this {
    this.salt = salt;
    return this;
  }

  /**
   * Derive an ed25519 signing key from an ARID.
   *
   * Uses the ARID-derived key material extended to 32 bytes for ed25519.
   *
   * Port of `MainlineDhtKv::derive_signing_key()` from mainline/kv.rs lines 100-112.
   *
   * @internal
   */
  private static deriveSigningKey(arid: ARID): { privateKey: Uint8Array; publicKey: Uint8Array } {
    const keyBytes = deriveMainlineKey(arid);

    // Extend to 32 bytes if needed (ARID gives us 20, we need 32)
    const seed = new Uint8Array(32);
    seed.set(keyBytes.slice(0, 20));
    // Use simple derivation for remaining 12 bytes
    for (let i = 20; i < 32; i++) {
      seed[i] = (keyBytes[i % 20] * i) & 0xff;
    }

    // Get public key from private key seed
    const publicKey = ed25519.getPublicKey(seed);

    return { privateKey: seed, publicKey };
  }

  /**
   * Get mutable item from DHT.
   *
   * @internal
   */
  private getMutable(publicKey: Uint8Array, salt?: Uint8Array): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const target = this.computeTarget(publicKey, salt);

      this.dht.get(target, (err: Error | null, res: { v?: Buffer } | null) => {
        if (err || !res?.v) {
          resolve(null);
        } else {
          resolve(res.v);
        }
      });
    });
  }

  /**
   * Put mutable item to DHT.
   *
   * @internal
   */
  private putMutable(
    privateKey: Uint8Array,
    publicKey: Uint8Array,
    value: Uint8Array,
    seq: number,
    salt?: Uint8Array,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const opts: {
        k: Buffer;
        v: Buffer;
        seq: number;
        sign: (buf: Buffer) => Buffer;
        salt?: Buffer;
      } = {
        k: Buffer.from(publicKey),
        v: Buffer.from(value),
        seq,
        sign: (buf: Buffer) => {
          return Buffer.from(ed25519.sign(buf, privateKey));
        },
      };

      if (salt) {
        opts.salt = Buffer.from(salt);
      }

      this.dht.put(opts, (err: Error | null) => {
        if (err) {
          reject(new PutMutableError(err.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Compute DHT target hash from public key and optional salt.
   *
   * @internal
   */
  private computeTarget(publicKey: Uint8Array, salt?: Uint8Array): Buffer {
    // For BEP-44 mutable items, the target is sha1(publicKey + salt)
    // The bittorrent-dht library handles this internally when using get/put with k/salt
    // But for direct get() calls we need to compute it ourselves
    const hash = crypto.createHash("sha1");
    hash.update(publicKey);
    if (salt) {
      hash.update(salt);
    }
    return hash.digest();
  }

  /**
   * Store an envelope at the given ARID.
   *
   * Port of `KvStore::put()` implementation from mainline/kv.rs lines 144-220.
   */
  async put(
    arid: ARID,
    envelope: Envelope,
    _ttlSeconds?: number, // Ignored - DHT has no TTL support
    verbose?: boolean,
  ): Promise<string> {
    if (verbose) {
      verbosePrintln("Starting Mainline DHT put operation");
    }

    // Serialize envelope
    const bytes = envelope.taggedCborData();

    if (verbose) {
      verbosePrintln(`Envelope size: ${bytes.length} bytes`);
    }

    // Obfuscate with ARID-derived key so it appears as random data
    const obfuscated = obfuscateWithArid(arid, bytes);

    // Check size after obfuscation (same size, but check anyway)
    if (obfuscated.length > this.maxValueSize) {
      throw new ValueTooLargeError(obfuscated.length);
    }

    if (verbose) {
      verbosePrintln("Obfuscated envelope data");
    }

    // Derive signing key from ARID
    if (verbose) {
      verbosePrintln("Deriving DHT signing key from ARID");
    }
    const { privateKey, publicKey } = MainlineDhtKv.deriveSigningKey(arid);

    // Check if already exists (write-once semantics)
    if (verbose) {
      verbosePrintln("Checking for existing value (write-once check)");
    }
    const existing = await this.getMutable(publicKey, this.salt);
    if (existing !== null) {
      throw new AlreadyExistsError(arid.urString());
    }

    // Create mutable item with seq=1 (first write) using obfuscated data
    if (verbose) {
      verbosePrintln("Creating mutable DHT item");
    }

    // Put to DHT
    if (verbose) {
      verbosePrintln("Putting value to DHT");
    }
    await this.putMutable(privateKey, publicKey, obfuscated, 1, this.salt);

    if (verbose) {
      verbosePrintln("Mainline DHT put operation completed");
    }

    return `dht://${Buffer.from(publicKey).toString("hex")}`;
  }

  /**
   * Retrieve an envelope for the given ARID.
   *
   * Port of `KvStore::get()` implementation from mainline/kv.rs lines 223-303.
   */
  async get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | null> {
    if (verbose) {
      verbosePrintln("Starting Mainline DHT get operation");
    }

    // Derive public key from ARID
    if (verbose) {
      verbosePrintln("Deriving DHT public key from ARID");
    }
    const { publicKey } = MainlineDhtKv.deriveSigningKey(arid);

    const timeout = (timeoutSeconds ?? 30) * 1000; // Default 30 seconds
    const deadline = Date.now() + timeout;
    // Changed to 1000ms for verbose mode polling
    const pollInterval = 1000;

    if (verbose) {
      verbosePrintln("Polling DHT for value");
    }

    while (true) {
      // Get mutable item
      const item = await this.getMutable(publicKey, this.salt);

      if (item !== null) {
        if (verbose) {
          verboseNewline();
          verbosePrintln("Value found in DHT");
        }

        // Deobfuscate the data using ARID-derived key
        const obfuscatedBytes = new Uint8Array(item);
        const deobfuscated = obfuscateWithArid(arid, obfuscatedBytes);

        if (verbose) {
          verbosePrintln("Deobfuscated envelope data");
        }

        // Deserialize envelope from deobfuscated data
        const envelope = EnvelopeDecoder.tryFromCborData(deobfuscated);

        if (verbose) {
          verbosePrintln("Mainline DHT get operation completed");
        }

        return envelope;
      }

      // Not found yet - check if we should keep polling
      if (Date.now() >= deadline) {
        // Timeout reached
        if (verbose) {
          verboseNewline();
          verbosePrintln("Timeout reached, value not found");
        }
        return null;
      }

      // Print polling dot if verbose
      if (verbose) {
        verbosePrintDot();
      }

      // Wait before retrying (now 1000ms)
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Check if an envelope exists at the given ARID.
   *
   * Port of `KvStore::exists()` implementation from mainline/kv.rs lines 306-314.
   */
  async exists(arid: ARID): Promise<boolean> {
    const { publicKey } = MainlineDhtKv.deriveSigningKey(arid);

    // Check if mutable item exists
    const item = await this.getMutable(publicKey, this.salt);
    return item !== null;
  }

  /**
   * Destroy the DHT client and release resources.
   */
  destroy(): Promise<void> {
    return new Promise((resolve) => {
      this.dht.destroy(() => {
        resolve();
      });
    });
  }
}
