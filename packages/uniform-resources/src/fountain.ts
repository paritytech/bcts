/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
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
 * Splits data into fragments of the specified size.
 */
export function splitMessage(message: Uint8Array, fragmentLen: number): Uint8Array[] {
  const fragments: Uint8Array[] = [];
  const fragmentCount = Math.ceil(message.length / fragmentLen);

  for (let i = 0; i < fragmentCount; i++) {
    const start = i * fragmentLen;
    const end = Math.min(start + fragmentLen, message.length);
    const fragment = new Uint8Array(fragmentLen);

    // Copy data and pad with zeros if needed
    const sourceSlice = message.slice(start, end);
    fragment.set(sourceSlice);

    fragments.push(fragment);
  }

  return fragments;
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
   */
  constructor(message: Uint8Array, maxFragmentLen: number) {
    if (maxFragmentLen < 1) {
      throw new Error("Fragment length must be at least 1");
    }

    this.messageLen = message.length;
    this.checksum = crc32(message);
    this.fragments = splitMessage(message, maxFragmentLen);
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

  // Storage for received data
  private readonly pureFragments = new Map<number, Uint8Array>();
  private readonly mixedParts = new Map<number, { indices: number[]; data: Uint8Array }>();

  /**
   * Receives a fountain part and attempts to decode.
   *
   * @param part - The fountain part to receive
   * @returns true if the message is now complete
   */
  receive(part: FountainPart): boolean {
    // Initialize on first part
    if (this.seqLen === null) {
      this.seqLen = part.seqLen;
      this.messageLen = part.messageLen;
      this.checksum = part.checksum;
    }

    // Validate consistency
    if (
      part.seqLen !== this.seqLen ||
      part.messageLen !== this.messageLen ||
      part.checksum !== this.checksum
    ) {
      throw new Error("Inconsistent part metadata");
    }

    // Determine which fragments this part contains
    const indices = chooseFragments(part.seqNum, this.seqLen, this.checksum);

    if (indices.length === 1) {
      // Pure fragment (or degree-1 mixed that acts like pure)
      const index = indices[0];
      if (!this.pureFragments.has(index)) {
        this.pureFragments.set(index, part.data);
      }
    } else {
      // Mixed fragment - store for later reduction
      if (!this.mixedParts.has(part.seqNum)) {
        this.mixedParts.set(part.seqNum, { indices, data: part.data });
      }
    }

    // Try to reduce mixed parts
    this.reduceMixedParts();

    return this.isComplete();
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
    this.pureFragments.clear();
    this.mixedParts.clear();
  }
}
