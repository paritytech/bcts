/**
 * Xoshiro256** PRNG implementation.
 *
 * This is a high-quality, fast pseudo-random number generator used
 * for deterministic fragment selection in fountain codes.
 *
 * Reference: https://prng.di.unimi.it/
 * BC-UR Reference: https://github.com/nicklockwood/fountain-codes
 */

import { sha256 } from "@bcts/crypto";

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
   * The seed must be exactly 32 bytes (256 bits). The bytes are interpreted
   * using the BC-UR reference algorithm: each 8-byte chunk is read as
   * big-endian then stored as little-endian for the state.
   *
   * @param seed - The seed bytes (must be exactly 32 bytes)
   */
  constructor(seed: Uint8Array) {
    if (seed.length !== 32) {
      throw new Error(`Seed must be 32 bytes, got ${seed.length}`);
    }

    // BC-UR reference implementation:
    // For each 8-byte chunk, read as big-endian u64, then convert to little-endian bytes
    // This effectively swaps the byte order within each 8-byte segment
    const s: [bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n];
    for (let i = 0; i < 4; i++) {
      // Read 8 bytes as big-endian u64
      let v = 0n;
      for (let n = 0; n < 8; n++) {
        v = (v << 8n) | BigInt(seed[8 * i + n] ?? 0);
      }
      s[i] = v;
    }

    this.s = s;
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
   * Matches BC-UR reference: self.next() as f64 / (u64::MAX as f64 + 1.0)
   */
  nextDouble(): number {
    const value = this.next();
    // u64::MAX as f64 + 1.0 = 18446744073709551616.0
    return Number(value) / 18446744073709551616.0;
  }

  /**
   * Generates a random integer in [low, high] (inclusive).
   * Matches BC-UR reference: (self.next_double() * ((high - low + 1) as f64)) as u64 + low
   */
  nextInt(low: number, high: number): number {
    const range = high - low + 1;
    return Math.floor(this.nextDouble() * range) + low;
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

  /**
   * Shuffles items by repeatedly picking random indices.
   * Matches BC-UR reference implementation.
   */
  shuffled<T>(items: T[]): T[] {
    const source = [...items];
    const shuffled: T[] = [];
    while (source.length > 0) {
      const index = this.nextInt(0, source.length - 1);
      const item = source.splice(index, 1)[0];
      if (item !== undefined) {
        shuffled.push(item);
      }
    }
    return shuffled;
  }

  /**
   * Chooses the degree (number of fragments to mix) using a weighted sampler.
   * Uses the robust soliton distribution with weights [1/1, 1/2, 1/3, ..., 1/n].
   * Matches BC-UR reference implementation.
   */
  chooseDegree(seqLen: number): number {
    // Create weights: [1/1, 1/2, 1/3, ..., 1/seqLen]
    const weights: number[] = [];
    for (let i = 1; i <= seqLen; i++) {
      weights.push(1.0 / i);
    }

    // Use Vose's alias method for weighted sampling
    const sampler = new WeightedSampler(weights);
    return sampler.next(this) + 1; // 1-indexed degree
  }
}

/**
 * Weighted sampler using Vose's alias method.
 * Allows O(1) sampling from a discrete probability distribution.
 */
class WeightedSampler {
  private readonly aliases: number[];
  private readonly probs: number[];

  constructor(weights: number[]) {
    const n = weights.length;
    if (n === 0) {
      throw new Error("Weights array cannot be empty");
    }

    // Normalize weights
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) {
      throw new Error("Weights must sum to a positive value");
    }

    const normalized = weights.map((w) => (w * n) / sum);

    // Initialize alias table
    this.aliases = new Array(n).fill(0);
    this.probs = new Array(n).fill(0);

    // Partition into small and large
    const small: number[] = [];
    const large: number[] = [];

    for (let i = n - 1; i >= 0; i--) {
      if (normalized[i] < 1.0) {
        small.push(i);
      } else {
        large.push(i);
      }
    }

    // Build the alias table
    while (small.length > 0 && large.length > 0) {
      const a = small.pop()!;
      const g = large.pop()!;
      this.probs[a] = normalized[a];
      this.aliases[a] = g;
      normalized[g] = normalized[g] + normalized[a] - 1.0;
      if (normalized[g] < 1.0) {
        small.push(g);
      } else {
        large.push(g);
      }
    }

    while (large.length > 0) {
      const g = large.pop()!;
      this.probs[g] = 1.0;
    }

    while (small.length > 0) {
      const a = small.pop()!;
      this.probs[a] = 1.0;
    }
  }

  /**
   * Sample from the distribution.
   */
  next(rng: Xoshiro256): number {
    const r1 = rng.nextDouble();
    const r2 = rng.nextDouble();
    const n = this.probs.length;
    const i = Math.floor(n * r1);
    if (r2 < this.probs[i]) {
      return i;
    } else {
      return this.aliases[i];
    }
  }
}

/**
 * Creates a Xoshiro256 PRNG instance from message checksum and sequence number.
 *
 * This creates an 8-byte seed by concatenating seqNum and checksum (both in
 * big-endian), then hashes it with SHA-256 to get the 32-byte seed for Xoshiro.
 *
 * This matches the BC-UR reference implementation.
 */
export function createSeed(checksum: number, seqNum: number): Uint8Array {
  // Create 8-byte seed: seqNum (big-endian) || checksum (big-endian)
  const seed8 = new Uint8Array(8);

  // seqNum in big-endian (bytes 0-3)
  seed8[0] = (seqNum >>> 24) & 0xff;
  seed8[1] = (seqNum >>> 16) & 0xff;
  seed8[2] = (seqNum >>> 8) & 0xff;
  seed8[3] = seqNum & 0xff;

  // checksum in big-endian (bytes 4-7)
  seed8[4] = (checksum >>> 24) & 0xff;
  seed8[5] = (checksum >>> 16) & 0xff;
  seed8[6] = (checksum >>> 8) & 0xff;
  seed8[7] = checksum & 0xff;

  // Hash with SHA-256 to get 32 bytes
  return sha256(seed8);
}
