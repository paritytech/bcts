/**
 * IPFS-backed key-value store using IPNS for ARID-based addressing.
 *
 * Port of ipfs/kv.rs from hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { create, type KuboRPCClient } from "kubo-rpc-client";

import { AlreadyExistsError } from "../error.js";
import { type KvStore } from "../kv-store.js";
import { deriveIpfsKeyName, obfuscateWithArid } from "../arid-derivation.js";
import { verboseNewline, verbosePrintDot, verbosePrintln } from "../logging.js";
import {
  EnvelopeTooLargeError,
  IpfsDaemonError,
  IpfsTimeoutError,
  UnexpectedIpnsPathFormatError,
} from "./error.js";
import { addBytes, catBytes, pinCid } from "./value.js";

/**
 * Key info cached from IPFS key operations.
 *
 * @internal
 */
interface KeyInfo {
  peerId: string;
}

/**
 * IPFS-backed key-value store using IPNS for ARID-based addressing.
 *
 * This implementation uses:
 * - ARID → IPNS key name derivation (deterministic)
 * - IPFS content addressing (CID) for immutable storage
 * - IPNS for publish-once mutable names
 * - Write-once semantics (publish fails if name already exists)
 *
 * Port of `struct IpfsKv` from ipfs/kv.rs lines 54-60.
 *
 * # Requirements
 *
 * Requires a running Kubo daemon (or compatible IPFS node) with RPC API
 * available at the configured endpoint (default: http://127.0.0.1:5001).
 *
 * @category IPFS Backend
 *
 * @example
 * ```typescript
 * const store = new IpfsKv("http://127.0.0.1:5001");
 * const arid = ARID.new();
 * const envelope = Envelope.wrap("Hello, IPFS!");
 *
 * // Put envelope (write-once)
 * await store.put(arid, envelope);
 *
 * // Get envelope with verbose logging
 * const retrieved = await store.get(arid, undefined, true);
 * ```
 */
export class IpfsKv implements KvStore {
  private client: KuboRPCClient;
  private keyCache: Map<string, KeyInfo>;
  private maxEnvelopeSize: number;
  private resolveTimeoutMs: number;
  private pinContent: boolean;

  /**
   * Create a new IPFS KV store with default settings.
   *
   * Port of `IpfsKv::new()` from ipfs/kv.rs lines 73-81.
   *
   * @param rpcUrl - IPFS RPC endpoint (e.g., "http://127.0.0.1:5001")
   */
  constructor(rpcUrl: string) {
    this.client = create({ url: rpcUrl });
    this.keyCache = new Map();
    this.maxEnvelopeSize = 10 * 1024 * 1024; // 10 MB
    this.resolveTimeoutMs = 30000; // 30 seconds
    this.pinContent = false;
  }

  /**
   * Set the maximum envelope size (default: 10 MB).
   *
   * Port of `IpfsKv::with_max_size()` from ipfs/kv.rs lines 84-87.
   */
  withMaxSize(size: number): this {
    this.maxEnvelopeSize = size;
    return this;
  }

  /**
   * Set the IPNS resolve timeout (default: 30 seconds).
   *
   * Port of `IpfsKv::with_resolve_timeout()` from ipfs/kv.rs lines 90-93.
   *
   * @param timeoutMs - Timeout in milliseconds
   */
  withResolveTimeout(timeoutMs: number): this {
    this.resolveTimeoutMs = timeoutMs;
    return this;
  }

  /**
   * Set whether to pin content (default: false).
   *
   * Port of `IpfsKv::with_pin_content()` from ipfs/kv.rs lines 96-99.
   */
  withPinContent(pin: boolean): this {
    this.pinContent = pin;
    return this;
  }

  /**
   * Get or create an IPNS key for the given ARID.
   *
   * Port of `IpfsKv::get_or_create_key()` from ipfs/kv.rs lines 102-142.
   *
   * @internal
   */
  private async getOrCreateKey(arid: ARID): Promise<KeyInfo> {
    const keyName = deriveIpfsKeyName(arid);

    // Check cache first
    const cachedInfo = this.keyCache.get(keyName);
    if (cachedInfo) {
      return cachedInfo;
    }

    try {
      // List existing keys to see if it already exists
      const keys = await this.client.key.list();

      const existingKey = keys.find((k) => k.name === keyName);
      if (existingKey) {
        const info: KeyInfo = { peerId: existingKey.id };
        this.keyCache.set(keyName, info);
        return info;
      }

      // Generate new key
      const keyInfo = await this.client.key.gen(keyName, { type: "ed25519" });
      const info: KeyInfo = { peerId: keyInfo.id };
      this.keyCache.set(keyName, info);
      return info;
    } catch (error) {
      throw new IpfsDaemonError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Check if an IPNS name is already published.
   *
   * Port of `IpfsKv::is_published()` from ipfs/kv.rs lines 145-161.
   *
   * @internal
   */
  private async isPublished(peerId: string): Promise<boolean> {
    try {
      // Try to resolve the name
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _path of this.client.name.resolve(peerId, { recursive: false })) {
        return true;
      }
      return true;
    } catch (error) {
      const errStr = error instanceof Error ? error.message : String(error);
      // IPNS name not found errors indicate unpublished name
      if (
        errStr.includes("could not resolve name") ||
        errStr.includes("no link named") ||
        errStr.includes("not found")
      ) {
        return false;
      }
      throw new IpfsDaemonError(errStr);
    }
  }

  /**
   * Publish a CID to an IPNS name (write-once).
   *
   * Port of `IpfsKv::publish_once()` from ipfs/kv.rs lines 164-204.
   *
   * @internal
   */
  private async publishOnce(
    keyName: string,
    peerId: string,
    cid: string,
    ttlSeconds: number | undefined,
    arid: ARID,
  ): Promise<void> {
    // Check if already published
    if (await this.isPublished(peerId)) {
      throw new AlreadyExistsError(arid.urString);
    }

    // Convert TTL seconds to lifetime string for IPNS
    // Format: "Ns" for seconds, "Nm" for minutes, "Nh" for hours, "Nd" for days
    let lifetime: string | undefined;
    if (ttlSeconds !== undefined) {
      if (ttlSeconds < 60) {
        lifetime = `${ttlSeconds}s`;
      } else if (ttlSeconds < 3600) {
        lifetime = `${Math.floor(ttlSeconds / 60)}m`;
      } else if (ttlSeconds < 86400) {
        lifetime = `${Math.floor(ttlSeconds / 3600)}h`;
      } else {
        lifetime = `${Math.floor(ttlSeconds / 86400)}d`;
      }
    }

    try {
      // Publish to IPNS
      await this.client.name.publish(`/ipfs/${cid}`, {
        key: keyName,
        lifetime,
      });
    } catch (error) {
      throw new IpfsDaemonError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Resolve an IPNS name to a CID with polling and custom timeout.
   *
   * Port of `IpfsKv::resolve_with_retry_timeout()` from ipfs/kv.rs lines 207-258.
   *
   * @internal
   */
  private async resolveWithRetryTimeout(
    peerId: string,
    timeoutMs: number,
    verbose: boolean,
  ): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    // Changed to 1000ms for verbose mode polling
    const pollInterval = 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        for await (const path of this.client.name.resolve(peerId, { recursive: false })) {
          // Extract CID from path (e.g., "/ipfs/bafy..." -> "bafy...")
          const pathStr = path.toString();
          if (pathStr.startsWith("/ipfs/")) {
            return pathStr.slice(6);
          } else {
            throw new UnexpectedIpnsPathFormatError(pathStr);
          }
        }
        // If iterator completes without yielding, name not found
        return null;
      } catch (error) {
        const errStr = error instanceof Error ? error.message : String(error);
        // Check if name simply doesn't exist (not published)
        if (
          errStr.includes("could not resolve name") ||
          errStr.includes("no link named") ||
          errStr.includes("not found")
        ) {
          return null;
        }

        // Check if we've timed out
        if (Date.now() >= deadline) {
          throw new IpfsTimeoutError();
        }

        // Print polling dot if verbose
        if (verbose) {
          verbosePrintDot();
        }

        // Retry after interval (now 1000ms)
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }
  }

  /**
   * Store an envelope at the given ARID.
   *
   * Port of `KvStore::put()` implementation from ipfs/kv.rs lines 289-367.
   */
  async put(
    arid: ARID,
    envelope: Envelope,
    ttlSeconds?: number,
    verbose?: boolean,
  ): Promise<string> {
    if (verbose) {
      verbosePrintln("Starting IPFS put operation");
    }

    // Serialize envelope
    const bytes = envelope.cborData;

    if (verbose) {
      verbosePrintln(`Envelope size: ${bytes.length} bytes`);
    }

    // Obfuscate with ARID-derived key so it appears as random data
    const obfuscated = obfuscateWithArid(arid, bytes);

    // Check size after obfuscation (same size, but check anyway)
    if (obfuscated.length > this.maxEnvelopeSize) {
      throw new EnvelopeTooLargeError(obfuscated.length);
    }

    if (verbose) {
      verbosePrintln("Obfuscated envelope data");
    }

    // Get or create IPNS key
    if (verbose) {
      verbosePrintln("Getting or creating IPNS key");
    }
    const keyInfo = await this.getOrCreateKey(arid);

    const keyName = deriveIpfsKeyName(arid);

    // Add obfuscated data to IPFS
    if (verbose) {
      verbosePrintln("Adding content to IPFS");
    }
    const cid = await addBytes(this.client, obfuscated);

    if (verbose) {
      verbosePrintln(`Content CID: ${cid}`);
    }

    // Pin if requested
    if (this.pinContent) {
      if (verbose) {
        verbosePrintln("Pinning content");
      }
      await pinCid(this.client, cid, true);
    }

    // Publish to IPNS (write-once)
    if (verbose) {
      verbosePrintln("Publishing to IPNS (write-once check)");
    }
    await this.publishOnce(keyName, keyInfo.peerId, cid, ttlSeconds, arid);

    if (verbose) {
      verbosePrintln("IPFS put operation completed");
    }

    return `ipns://${keyInfo.peerId} -> ipfs://${cid}`;
  }

  /**
   * Retrieve an envelope for the given ARID.
   *
   * Port of `KvStore::get()` implementation from ipfs/kv.rs lines 370-450.
   */
  async get(arid: ARID, timeoutSeconds?: number, verbose?: boolean): Promise<Envelope | null> {
    if (verbose) {
      verbosePrintln("Starting IPFS get operation");
    }

    const keyName = deriveIpfsKeyName(arid);

    // Get key info from cache or daemon
    if (verbose) {
      verbosePrintln("Looking up IPNS key");
    }

    try {
      const keys = await this.client.key.list();
      const key = keys.find((k) => k.name === keyName);

      if (!key) {
        // Key doesn't exist, so nothing published
        if (verbose) {
          verbosePrintln("Key not found");
        }
        return null;
      }

      const peerId = key.id;

      // Resolve IPNS to CID with specified timeout
      if (verbose) {
        verbosePrintln("Resolving IPNS name (polling)");
      }
      const timeout = timeoutSeconds !== undefined ? timeoutSeconds * 1000 : this.resolveTimeoutMs;
      const cid = await this.resolveWithRetryTimeout(peerId, timeout, verbose ?? false);

      if (verbose) {
        verboseNewline();
      }

      if (cid === null) {
        if (verbose) {
          verbosePrintln("IPNS name not published");
        }
        return null;
      }

      if (verbose) {
        verbosePrintln(`Resolved to CID: ${cid}`);
      }

      // Cat CID to get obfuscated bytes
      if (verbose) {
        verbosePrintln("Fetching content from IPFS");
      }
      const obfuscatedBytes = await catBytes(this.client, cid);

      // Deobfuscate using ARID-derived key
      const deobfuscated = obfuscateWithArid(arid, obfuscatedBytes);

      if (verbose) {
        verbosePrintln("Deobfuscated envelope data");
      }

      // Deserialize envelope from deobfuscated data
      const envelope = Envelope.fromCborData(deobfuscated);

      if (verbose) {
        verbosePrintln("IPFS get operation completed");
      }

      return envelope;
    } catch (error) {
      if (
        error instanceof AlreadyExistsError ||
        error instanceof EnvelopeTooLargeError ||
        error instanceof IpfsDaemonError ||
        error instanceof IpfsTimeoutError ||
        error instanceof UnexpectedIpnsPathFormatError
      ) {
        throw error;
      }
      throw new IpfsDaemonError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Check if an envelope exists at the given ARID.
   *
   * Port of `KvStore::exists()` implementation from ipfs/kv.rs lines 453-481.
   */
  async exists(arid: ARID): Promise<boolean> {
    const keyName = deriveIpfsKeyName(arid);

    try {
      // List keys to check if key exists
      const keys = await this.client.key.list();
      const key = keys.find((k) => k.name === keyName);

      if (!key) {
        return false;
      }

      const peerId = key.id;

      // Check if published (quick resolve)
      return await this.isPublished(peerId);
    } catch (error) {
      if (error instanceof IpfsDaemonError) {
        throw error;
      }
      throw new IpfsDaemonError(error instanceof Error ? error.message : String(error));
    }
  }
}
