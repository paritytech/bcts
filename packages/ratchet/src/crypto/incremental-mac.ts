/**
 * Incremental MAC -- streaming HMAC-SHA256 verification.
 *
 * Used for large message/attachment verification where the entire content
 * cannot be held in memory at once.
 *
 * The HMAC state is carried forward: each emitted MAC covers all data from
 * the beginning through that chunk boundary, computed by cloning the running
 * HMAC instance (O(n) total work, not O(n^2)).
 *
 * Reference: libsignal/rust/protocol/src/incremental_mac.rs
 */

import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { constantTimeEqual } from "./constant-time.js";

/** SHA-256 output size in bytes. */
const DIGEST_SIZE = 32;

/** Minimum chunk size (64 KiB). */
const MINIMUM_CHUNK_SIZE = 64 * 1024;

/** Maximum chunk size (2 MiB). */
const MAXIMUM_CHUNK_SIZE = 2 * 1024 * 1024;

/**
 * Target total digest overhead (8 KiB).
 * The chunk size is chosen so that the total MAC output stays near this.
 */
const TARGET_TOTAL_DIGEST_SIZE = 8 * 1024;

/**
 * Calculate the optimal chunk size for a given data size.
 *
 * Mirrors libsignal's `calculate_chunk_size<Sha256>`:
 * - For small data, uses MINIMUM_CHUNK_SIZE (64 KiB)
 * - For medium data, scales linearly to keep total digest near 8 KiB
 * - For large data, caps at MAXIMUM_CHUNK_SIZE (2 MiB)
 *
 * @param dataSize - Total data size in bytes
 * @param digestSize - Digest output size (default 32 for SHA-256)
 */
export function calculateChunkSize(dataSize: number, digestSize: number = DIGEST_SIZE): number {
  const targetChunkCount = Math.floor(TARGET_TOTAL_DIGEST_SIZE / digestSize);

  if (dataSize < targetChunkCount * MINIMUM_CHUNK_SIZE) {
    return MINIMUM_CHUNK_SIZE;
  }
  if (dataSize < targetChunkCount * MAXIMUM_CHUNK_SIZE) {
    return Math.ceil(dataSize / targetChunkCount);
  }
  return MAXIMUM_CHUNK_SIZE;
}

/**
 * Computes HMAC-SHA256 incrementally, emitting a MAC after each full chunk.
 *
 * Each emitted MAC covers all data from the beginning through the end of that
 * chunk. The HMAC state carries forward -- at each chunk boundary the running
 * HMAC is cloned and the clone is finalized to produce the MAC.
 *
 * The final MAC (from `finalize()`) covers all data including any partial
 * trailing chunk.
 */
export class IncrementalMac {
  /** Running HMAC instance; updated with every byte fed in. */
  private mac: ReturnType<typeof hmac.create>;
  readonly chunkSize: number;
  /** Bytes remaining until the current chunk is full. */
  private unusedLength: number;
  /** Total bytes fed so far. */
  private totalFed: number;

  constructor(key: Uint8Array, chunkSize: number) {
    if (chunkSize <= 0) {
      throw new Error("chunk size must be positive");
    }
    this.mac = hmac.create(sha256, key);
    this.chunkSize = chunkSize;
    this.unusedLength = chunkSize;
    this.totalFed = 0;
  }

  /**
   * Feed data into the incremental MAC.
   * Returns MACs for any completed chunks.
   */
  update(data: Uint8Array): Uint8Array[] {
    const macs: Uint8Array[] = [];

    const splitPoint = Math.min(data.length, this.unusedLength);
    const toWrite = data.subarray(0, splitPoint);
    const overflow = data.subarray(splitPoint);

    // Process the first piece that fits in the current chunk
    const firstMac = this.updateChunk(toWrite);
    if (firstMac) macs.push(firstMac);

    // Process remaining data in chunkSize-sized pieces
    let offset = 0;
    while (offset < overflow.length) {
      const end = Math.min(offset + this.chunkSize, overflow.length);
      const piece = overflow.subarray(offset, end);
      const mac = this.updateChunk(piece);
      if (mac) macs.push(mac);
      offset = end;
    }

    return macs;
  }

  /**
   * Finalize and return the MAC covering all data (including any partial
   * trailing chunk).
   */
  finalize(): Uint8Array {
    return this.mac.digest();
  }

  /** Bytes in the current partial chunk (not yet emitted). */
  get pendingBytesSize(): number {
    return this.chunkSize - this.unusedLength;
  }

  /** Total number of bytes fed into the MAC. */
  get totalLength(): number {
    return this.totalFed;
  }

  /**
   * Feed a sub-chunk into the running HMAC.
   * If the current chunk becomes full, clone + finalize to emit a MAC.
   */
  private updateChunk(bytes: Uint8Array): Uint8Array | null {
    if (bytes.length === 0) return null;

    this.mac.update(bytes);
    this.unusedLength -= bytes.length;
    this.totalFed += bytes.length;

    if (this.unusedLength === 0) {
      this.unusedLength = this.chunkSize;
      return this.mac.clone().digest();
    }
    return null;
  }
}

/**
 * Validates data against expected incremental MACs.
 *
 * Wraps an `IncrementalMac` and checks each emitted chunk MAC (and the final
 * MAC) against the expected list. Throws on any mismatch.
 */
export class IncrementalMacValidator {
  private readonly inc: IncrementalMac;
  /**
   * Expected MACs stored in reverse order so we can pop from the end
   * (matching libsignal's approach for efficient removal).
   */
  private readonly expected: Uint8Array[];

  /**
   * @param key - HMAC-SHA256 key
   * @param chunkSize - Bytes per chunk
   * @param expectedMacs - Expected MACs in order (chunk MACs + final MAC)
   */
  constructor(key: Uint8Array, chunkSize: number, expectedMacs: Uint8Array[]) {
    this.inc = new IncrementalMac(key, chunkSize);
    // Store reversed so we can pop from the end
    this.expected = [...expectedMacs].reverse();
  }

  /**
   * Feed data and validate any emitted chunk MACs.
   * Returns the number of fully validated bytes (whole chunks).
   * Throws if a MAC does not match.
   */
  update(data: Uint8Array): number {
    const macs = this.inc.update(data);

    let wholeChunks = 0;
    for (const mac of macs) {
      const expected = this.expected.at(-1);
      if (expected && constantTimeEqual(expected, mac)) {
        wholeChunks++;
        this.expected.pop();
      } else {
        throw new Error("MAC validation failed: mismatch");
      }
    }

    return wholeChunks * this.inc.chunkSize;
  }

  /**
   * Finalize and validate the final MAC.
   * Returns the number of remaining validated bytes (partial trailing chunk).
   * Throws if the final MAC does not match.
   */
  finalize(): number {
    const pendingBytes = this.inc.pendingBytesSize;
    const mac = this.inc.finalize();

    if (this.expected.length !== 1 || !constantTimeEqual(this.expected[0], mac)) {
      throw new Error("MAC validation failed: final mismatch");
    }

    return pendingBytes;
  }
}
