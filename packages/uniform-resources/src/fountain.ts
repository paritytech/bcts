/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Fountain code implementation for multipart URs.
 *
 * This implements a hybrid fixed-rate and rateless fountain code system
 * as specified in BCR-2020-005 and BCR-2024-001.
 *
 * Key concepts:
 * - Parts 1-seqLen are "pure" fragments (fixed-rate)
 * - Parts > seqLen are "mixed" fragments using XOR (rateless)
 * - Xoshiro256** PRNG ensures encoder/decoder agree on mixing
 */

import { Xoshiro256, createSeed } from "./xoshiro.js";
import { crc32 } from "./utils.js";

/**
 * Represents a fountain code part with metadata.
 */
export interface FountainPart {
  /** Sequence number (1-based) */
  seqNum: number;
  /** Total number of pure fragments */
  seqLen: number;
  /** Length of original message */
  messageLen: number;
  /** CRC32 checksum of original message */
  checksum: number;
  /** Fragment data */
  data: Uint8Array;
}

/**
 * Calculates the quotient of `a` and `b`, rounded toward positive infinity.
 *
 * Mirrors Rust `ur-0.4.1/src/fountain.rs::div_ceil`.
 */
function divCeil(a: number, b: number): number {
  const d = Math.floor(a / b);
  const r = a % b;
  return r > 0 ? d + 1 : d;
}

/**
 * Computes the optimal fragment length for a given message length and
 * maximum fragment length.
 *
 * The algorithm:
 *   fragment_count  = ceil(data_length / max_fragment_length)
 *   fragment_length = ceil(data_length / fragment_count)
 *
 * This produces fragments that are as balanced as possible while still
 * respecting `maxFragmentLen` as an upper bound on each fragment. For
 * example, a 10-byte message with `maxFragmentLen = 6` yields a fragment
 * length of 5 (so two even 5-byte fragments) rather than 6 (one full
 * fragment plus a 4-byte tail).
 *
 * Mirrors Rust `ur-0.4.1/src/fountain.rs::fragment_length` byte-for-byte.
 */
export function fragmentLength(dataLength: number, maxFragmentLength: number): number {
  const fragmentCount = divCeil(dataLength, maxFragmentLength);
  return divCeil(dataLength, fragmentCount);
}

/**
 * Splits `data` into a list of `fragmentLen`-sized chunks, zero-padding
 * the last chunk if necessary so that every chunk is exactly
 * `fragmentLen` bytes long.
 *
 * Note: `fragmentLen` is the **already-computed** fragment length (see
 * {@link fragmentLength}), not the user-facing maximum fragment length.
 *
 * Mirrors Rust `ur-0.4.1/src/fountain.rs::partition` byte-for-byte.
 */
export function partition(data: Uint8Array, fragmentLen: number): Uint8Array[] {
  if (fragmentLen < 1) {
    throw new Error("fragment length must be at least 1");
  }
  const remainder = data.length % fragmentLen;
  const padding = remainder === 0 ? 0 : fragmentLen - remainder;
  const padded = new Uint8Array(data.length + padding);
  padded.set(data);
  // Trailing bytes are already zero by Uint8Array's default initialization.

  const fragments: Uint8Array[] = [];
  for (let start = 0; start < padded.length; start += fragmentLen) {
    fragments.push(padded.slice(start, start + fragmentLen));
  }
  return fragments;
}

/**
 * Convenience: compute the optimal fragment length for `message` given
 * `maxFragmentLen` and partition the message into that many fragments.
 *
 * Equivalent to:
 * ```ts
 * partition(message, fragmentLength(message.length, maxFragmentLen))
 * ```
 *
 * This is what {@link FountainEncoder} does internally when constructing
 * its fragment table.
 */
export function splitMessage(message: Uint8Array, maxFragmentLen: number): Uint8Array[] {
  if (maxFragmentLen < 1) {
    throw new Error("max fragment length must be at least 1");
  }
  if (message.length === 0) {
    return [];
  }
  return partition(message, fragmentLength(message.length, maxFragmentLen));
}

/**
 * XOR two Uint8Arrays together.
 */
export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.max(a.length, b.length);
  const result = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    result[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return result;
}

/**
 * Chooses which fragments to mix for a given sequence number.
 *
 * This uses a seeded Xoshiro256** PRNG to deterministically select fragments,
 * ensuring encoder and decoder agree without explicit coordination.
 *
 * The algorithm matches the BC-UR reference implementation:
 * 1. For pure parts (seqNum <= seqLen), return single fragment index
 * 2. For mixed parts, use weighted sampling to choose degree
 * 3. Shuffle all indices and take the first 'degree' indices
 *
 * @param seqNum - The sequence number (1-based)
 * @param seqLen - Total number of pure fragments
 * @param checksum - CRC32 checksum of the message
 * @returns Array of fragment indices (0-based)
 */
export function chooseFragments(seqNum: number, seqLen: number, checksum: number): number[] {
  // Pure parts (seqNum <= seqLen) contain exactly one fragment
  if (seqNum <= seqLen) {
    return [seqNum - 1];
  }

  // Mixed parts use PRNG to select fragments
  const seed = createSeed(checksum, seqNum);
  const rng = new Xoshiro256(seed);

  // Choose degree using weighted sampler (1/k distribution)
  const degree = rng.chooseDegree(seqLen);

  // Create array of all indices [0, 1, 2, ..., seqLen-1]
  const allIndices: number[] = [];
  for (let i = 0; i < seqLen; i++) {
    allIndices.push(i);
  }

  // Shuffle all indices and take the first 'degree' indices
  const shuffled = rng.shuffled(allIndices);
  return shuffled.slice(0, degree);
}

/**
 * Mixes the selected fragments using XOR.
 */
export function mixFragments(fragments: Uint8Array[], indices: number[]): Uint8Array {
  if (indices.length === 0) {
    throw new Error("No fragments to mix");
  }

  let result: Uint8Array = new Uint8Array(fragments[0].length);

  for (const index of indices) {
    const fragment = fragments[index];
    if (fragment === undefined) {
      throw new Error(`Fragment at index ${index} not found`);
    }
    result = xorBytes(result, fragment);
  }

  return result;
}

/**
 * Fountain encoder for creating multipart URs.
 */
export class FountainEncoder {
  private readonly fragments: Uint8Array[];
  private readonly messageLen: number;
  private readonly checksum: number;
  private seqNum = 0;

  /**
   * Creates a fountain encoder for the given message.
   *
   * @param message - The message to encode
   * @param maxFragmentLen - Maximum length of each fragment
   *
   * @throws if `message` is empty (mirrors Rust `Error::EmptyMessage`).
   * @throws if `maxFragmentLen < 1` (mirrors Rust `Error::InvalidFragmentLen`).
   */
  constructor(message: Uint8Array, maxFragmentLen: number) {
    if (message.length === 0) {
      throw new Error("expected non-empty message");
    }
    if (maxFragmentLen < 1) {
      throw new Error("expected positive maximum fragment length");
    }

    this.messageLen = message.length;
    this.checksum = crc32(message);
    // Mirrors Rust `Encoder::new`:
    //   let fragment_length = fragment_length(message.len(), max_fragment_length);
    //   let fragments = partition(message.to_vec(), fragment_length);
    const optimalLen = fragmentLength(message.length, maxFragmentLen);
    this.fragments = partition(message, optimalLen);
  }

  /**
   * Returns the number of pure fragments.
   */
  get seqLen(): number {
    return this.fragments.length;
  }

  /**
   * Returns whether the message fits in a single part.
   */
  isSinglePart(): boolean {
    return this.fragments.length === 1;
  }

  /**
   * Returns whether all pure parts have been emitted.
   */
  isComplete(): boolean {
    return this.seqNum >= this.seqLen;
  }

  /**
   * Generates the next fountain part.
   */
  nextPart(): FountainPart {
    this.seqNum++;

    const indices = chooseFragments(this.seqNum, this.seqLen, this.checksum);
    const data = mixFragments(this.fragments, indices);

    return {
      seqNum: this.seqNum,
      seqLen: this.seqLen,
      messageLen: this.messageLen,
      checksum: this.checksum,
      data,
    };
  }

  /**
   * Returns the current sequence number.
   */
  currentSeqNum(): number {
    return this.seqNum;
  }

  /**
   * Resets the encoder to start from the beginning.
   */
  reset(): void {
    this.seqNum = 0;
  }
}

/**
 * Fountain decoder for reassembling multipart URs.
 */
export class FountainDecoder {
  private seqLen: number | null = null;
  private messageLen: number | null = null;
  private checksum: number | null = null;
  private fragmentLen: number | null = null;

  // Storage for received data
  private readonly pureFragments = new Map<number, Uint8Array>();
  private readonly mixedParts = new Map<number, { indices: number[]; data: Uint8Array }>();
  // Set of already-received `indices` keys (joined by `,`) — Rust uses
  // `BTreeSet<Vec<usize>>` so two parts producing the same index set are
  // deduped even when they have different sequence numbers. Mirrors
  // `ur-0.4.1/src/fountain.rs::Decoder.received`.
  private readonly receivedIndexSets = new Set<string>();

  /**
   * Receives a fountain part and attempts to decode.
   *
   * @param part - The fountain part to receive
   * @returns `true` if this part contributed new information,
   *          `false` if it was an exact duplicate of a part already seen
   *          (or if the decoder was already complete).
   *
   * @throws if the part is empty or inconsistent with previously received
   *   parts. Mirrors Rust `Error::EmptyPart` and `Error::InconsistentPart`.
   */
  receive(part: FountainPart): boolean {
    // Mirrors Rust `Decoder::receive`:
    //   if self.complete() { return Ok(false); }
    if (this.isComplete()) {
      return false;
    }

    // Mirrors Rust's eager EmptyPart check.
    if (part.seqLen === 0 || part.data.length === 0 || part.messageLen === 0) {
      throw new Error("expected non-empty part");
    }

    // Initialize on first part
    if (this.seqLen === null) {
      this.seqLen = part.seqLen;
      this.messageLen = part.messageLen;
      this.checksum = part.checksum;
      this.fragmentLen = part.data.length;
    } else if (
      // Mirrors Rust `Decoder::validate` exactly: every metadata field
      // (sequence_count, message_length, checksum, fragment_length) must
      // match across all received parts.
      part.seqLen !== this.seqLen ||
      part.messageLen !== this.messageLen ||
      part.checksum !== this.checksum ||
      part.data.length !== this.fragmentLen
    ) {
      throw new Error("part is inconsistent with previous ones");
    }

    // Determine which fragments this part contains.
    const indices = chooseFragments(part.seqNum, this.seqLen, this.checksum ?? 0);
    // Rust sorts the indices implicitly via `BTreeSet` membership; we
    // explicitly sort the key so that two parts whose `chooseFragments`
    // output is the same multiset (regardless of order) collapse to the
    // same dedup key. In practice `chooseFragments` already produces a
    // deterministic shuffle, so this is just defensive.
    const indexSetKey = [...indices].sort((a, b) => a - b).join(",");
    if (this.receivedIndexSets.has(indexSetKey)) {
      return false;
    }
    this.receivedIndexSets.add(indexSetKey);

    if (indices.length === 1) {
      // Pure fragment (or degree-1 mixed that acts like pure).
      const index = indices[0];
      if (!this.pureFragments.has(index)) {
        this.pureFragments.set(index, part.data);
      }
    } else {
      // Mixed fragment - store for later reduction.
      this.mixedParts.set(part.seqNum, { indices, data: part.data });
    }

    // Try to reduce mixed parts.
    this.reduceMixedParts();

    return true;
  }

  /**
   * Attempts to extract pure fragments from mixed parts.
   */
  private reduceMixedParts(): void {
    let progress = true;

    while (progress) {
      progress = false;

      for (const [seqNum, mixed] of this.mixedParts) {
        // Find which indices we're missing
        const missing: number[] = [];
        let reduced = mixed.data;

        for (const index of mixed.indices) {
          const pure = this.pureFragments.get(index);
          if (pure !== undefined) {
            // XOR out the known fragment
            reduced = xorBytes(reduced, pure);
          } else {
            missing.push(index);
          }
        }

        if (missing.length === 0) {
          // All fragments known, remove this mixed part
          this.mixedParts.delete(seqNum);
          progress = true;
        } else if (missing.length === 1) {
          // Can extract the missing fragment
          const missingIndex = missing[0];
          this.pureFragments.set(missingIndex, reduced);
          this.mixedParts.delete(seqNum);
          progress = true;
        }
      }
    }
  }

  /**
   * Returns whether all fragments have been received.
   */
  isComplete(): boolean {
    if (this.seqLen === null) {
      return false;
    }

    return this.pureFragments.size === this.seqLen;
  }

  /**
   * Reconstructs the original message.
   *
   * @returns The original message, or null if not yet complete
   */
  message(): Uint8Array | null {
    if (!this.isComplete() || this.seqLen === null || this.messageLen === null) {
      return null;
    }

    // Calculate fragment size from first fragment
    const firstFragment = this.pureFragments.get(0);
    if (firstFragment === undefined) {
      return null;
    }

    const fragmentLen = firstFragment.length;
    const result = new Uint8Array(this.messageLen);

    // Assemble fragments
    for (let i = 0; i < this.seqLen; i++) {
      const fragment = this.pureFragments.get(i);
      if (fragment === undefined) {
        return null;
      }

      const start = i * fragmentLen;
      const end = Math.min(start + fragmentLen, this.messageLen);
      const len = end - start;

      result.set(fragment.slice(0, len), start);
    }

    // Verify checksum
    const actualChecksum = crc32(result);
    if (actualChecksum !== this.checksum) {
      throw new Error(`Checksum mismatch: expected ${this.checksum}, got ${actualChecksum}`);
    }

    return result;
  }

  /**
   * Returns the progress as a fraction (0 to 1).
   */
  progress(): number {
    if (this.seqLen === null) {
      return 0;
    }
    return this.pureFragments.size / this.seqLen;
  }

  /**
   * Resets the decoder.
   */
  reset(): void {
    this.seqLen = null;
    this.messageLen = null;
    this.checksum = null;
    this.fragmentLen = null;
    this.pureFragments.clear();
    this.mixedParts.clear();
    this.receivedIndexSets.clear();
  }
}
