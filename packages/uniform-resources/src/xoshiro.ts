/**
 * Xoshiro256** PRNG implementation.
 *
 * This is a high-quality, fast pseudo-random number generator used
 * for deterministic fragment selection in fountain codes.
 *
 * Reference: https://prng.di.unimi.it/
 */

import { sha256 } from "@noble/hashes/sha2.js";

const MAX_UINT64 = BigInt("0xffffffffffffffff");

/**
 * Performs a left rotation on a 64-bit BigInt.
 */
function rotl(x: bigint, k: number): bigint {
  const kBigInt = BigInt(k);
  return ((x << kBigInt) | (x >> (64n - kBigInt))) & MAX_UINT64;
}

/**
 * Xoshiro256** pseudo-random number generator.
 *
 * This PRNG is used for deterministic mixing in fountain codes,
 * allowing both encoder and decoder to agree on which fragments
 * are combined without transmitting that information.
 */
export class Xoshiro256 {
  private s: [bigint, bigint, bigint, bigint];

  /**
   * Creates a new Xoshiro256** instance from a 32-byte seed.
   *
   * The seed must be exactly 32 bytes (256 bits). Use createSeed()
   * to generate the appropriate seed from checksum and sequence number.
   *
   * @param seed - The seed bytes (must be exactly 32 bytes)
   */
  constructor(seed: Uint8Array) {
    if (seed.length !== 32) {
      throw new Error(`Seed must be 32 bytes, got ${seed.length}`);
    }

    // Initialize the 4x64-bit state from the seed (little-endian)
    this.s = [
      this.bytesToBigInt(seed.slice(0, 8)),
      this.bytesToBigInt(seed.slice(8, 16)),
      this.bytesToBigInt(seed.slice(16, 24)),
      this.bytesToBigInt(seed.slice(24, 32)),
    ];
  }

  /**
   * Creates a Xoshiro256** instance from raw state values.
   * Useful for seeding with specific values.
   */
  static fromState(s0: bigint, s1: bigint, s2: bigint, s3: bigint): Xoshiro256 {
    const instance = Object.create(Xoshiro256.prototype) as Xoshiro256;
    instance.s = [s0, s1, s2, s3];
    return instance;
  }

  /**
   * Converts 8 bytes to a 64-bit BigInt (little-endian).
   */
  private bytesToBigInt(bytes: Uint8Array): bigint {
    let result = 0n;
    for (let i = 7; i >= 0; i--) {
      result = (result << 8n) | BigInt(bytes[i] ?? 0);
    }
    return result;
  }

  /**
   * Generates the next 64-bit random value.
   */
  next(): bigint {
    const result = (rotl((this.s[1] * 5n) & MAX_UINT64, 7) * 9n) & MAX_UINT64;

    const t = (this.s[1] << 17n) & MAX_UINT64;

    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];

    this.s[2] ^= t;
    this.s[3] = rotl(this.s[3], 45);

    return result;
  }

  /**
   * Generates a random double in [0, 1).
   */
  nextDouble(): number {
    // Use the upper 53 bits for double precision
    const value = this.next();
    return Number(value >> 11n) / Number(1n << 53n);
  }

  /**
   * Generates a random integer in [low, high).
   */
  nextInt(low: number, high: number): number {
    const range = high - low;
    return low + Math.floor(this.nextDouble() * range);
  }

  /**
   * Generates a random byte [0, 255].
   */
  nextByte(): number {
    return Number(this.next() & 0xffn);
  }

  /**
   * Generates an array of random bytes.
   */
  nextData(count: number): Uint8Array {
    const result = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.nextByte();
    }
    return result;
  }
}

/**
 * Creates a 32-byte seed for the Xoshiro PRNG from message checksum and sequence number.
 *
 * This uses SHA-256 to hash the concatenation of seqNum and checksum (both big-endian),
 * producing a deterministic 32-byte seed. This ensures that both encoder and decoder
 * produce the same random sequence for a given message and part number.
 *
 * Per BCR-2020-005 specification for fountain code fragment selection.
 */
export function createSeed(checksum: number, seqNum: number): Uint8Array {
  const input = new Uint8Array(8);

  // Pack seqNum first (4 bytes, big-endian)
  input[0] = (seqNum >>> 24) & 0xff;
  input[1] = (seqNum >>> 16) & 0xff;
  input[2] = (seqNum >>> 8) & 0xff;
  input[3] = seqNum & 0xff;

  // Pack checksum second (4 bytes, big-endian)
  input[4] = (checksum >>> 24) & 0xff;
  input[5] = (checksum >>> 16) & 0xff;
  input[6] = (checksum >>> 8) & 0xff;
  input[7] = checksum & 0xff;

  // SHA-256 produces exactly 32 bytes
  return sha256(input);
}
