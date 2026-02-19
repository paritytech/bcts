/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-rand-rust/src/seeded_random.rs

import type { RandomNumberGenerator } from "./random-number-generator.js";

/**
 * Xoshiro256** state
 * Based on xoshiro256** 1.0 by David Blackman and Sebastiano Vigna
 * https://prng.di.unimi.it/
 */
interface Xoshiro256State {
  s0: bigint;
  s1: bigint;
  s2: bigint;
  s3: bigint;
}

/**
 * Rotate left for 64-bit bigint
 */
function rotl(x: bigint, k: number): bigint {
  const mask = 0xffffffffffffffffn;
  return ((x << BigInt(k)) | (x >> BigInt(64 - k))) & mask;
}

/**
 * Xoshiro256** PRNG implementation
 * This is the same algorithm used by rand_xoshiro in Rust
 */
function xoshiro256StarStar(state: Xoshiro256State): bigint {
  const mask = 0xffffffffffffffffn;

  // result = rotl(s1 * 5, 7) * 9
  const result = (rotl((state.s1 * 5n) & mask, 7) * 9n) & mask;

  // t = s1 << 17
  const t = (state.s1 << 17n) & mask;

  // Update state
  state.s2 ^= state.s0;
  state.s3 ^= state.s1;
  state.s1 ^= state.s2;
  state.s0 ^= state.s3;

  state.s2 ^= t;
  state.s3 = rotl(state.s3, 45);

  return result;
}

/**
 * A random number generator that can be used as a source of deterministic
 * pseudo-randomness for testing purposes.
 *
 * Uses the Xoshiro256** algorithm, which is the same algorithm used by
 * rand_xoshiro in Rust. This ensures cross-platform compatibility with
 * the Rust implementation.
 *
 * WARNING: This is NOT cryptographically secure and should only be used
 * for testing purposes.
 */
export class SeededRandomNumberGenerator implements RandomNumberGenerator {
  private readonly state: Xoshiro256State;

  /**
   * Creates a new seeded random number generator.
   *
   * The seed should be a 256-bit value, represented as an array of 4 64-bit
   * integers (as bigints). For the output distribution to look random, the seed
   * should not have any obvious patterns, like all zeroes or all ones.
   *
   * This is not cryptographically secure, and should only be used for
   * testing purposes.
   *
   * @param seed - Array of 4 64-bit unsigned integers as bigints
   */
  constructor(seed: [bigint, bigint, bigint, bigint]) {
    this.state = {
      s0: seed[0] & 0xffffffffffffffffn,
      s1: seed[1] & 0xffffffffffffffffn,
      s2: seed[2] & 0xffffffffffffffffn,
      s3: seed[3] & 0xffffffffffffffffn,
    };
  }

  /**
   * Creates a new seeded random number generator from a seed array.
   * Convenience method that accepts numbers and converts to bigints.
   *
   * @param seed - Array of 4 64-bit unsigned integers
   */
  static fromSeed(seed: [bigint, bigint, bigint, bigint]): SeededRandomNumberGenerator {
    return new SeededRandomNumberGenerator(seed);
  }

  /**
   * Returns the next random 64-bit unsigned integer as a bigint.
   */
  nextU64(): bigint {
    return xoshiro256StarStar(this.state);
  }

  /**
   * Returns the next random 32-bit unsigned integer.
   */
  nextU32(): number {
    return Number(this.nextU64() & 0xffffffffn) >>> 0;
  }

  /**
   * Fills the given Uint8Array with random bytes.
   *
   * Note: This implementation matches the Rust behavior exactly -
   * it uses one nextU64() call per byte (taking only the low byte),
   * which matches the Swift version's behavior.
   */
  fillBytes(dest: Uint8Array): void {
    for (let i = 0; i < dest.length; i++) {
      dest[i] = Number(this.nextU64() & 0xffn);
    }
  }

  /**
   * Returns a Uint8Array of random bytes of the given size.
   *
   * This might not be the most efficient implementation,
   * but it works the same as the Swift version.
   */
  randomData(size: number): Uint8Array {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = Number(this.nextU64() & 0xffn);
    }
    return data;
  }

  /**
   * Fills the given Uint8Array with random bytes.
   */
  fillRandomData(data: Uint8Array): void {
    this.fillBytes(data);
  }
}

/**
 * The standard test seed used across all Blockchain Commons implementations.
 */
export const TEST_SEED: [bigint, bigint, bigint, bigint] = [
  17295166580085024720n,
  422929670265678780n,
  5577237070365765850n,
  7953171132032326923n,
];

/**
 * Creates a seeded random number generator with a fixed seed.
 * This is useful for reproducible testing across different platforms.
 */
export function makeFakeRandomNumberGenerator(): SeededRandomNumberGenerator {
  return new SeededRandomNumberGenerator(TEST_SEED);
}

/**
 * Creates a Uint8Array of random data with a fixed seed.
 * This is useful for reproducible testing.
 *
 * @param size - The number of bytes to generate
 * @returns A Uint8Array of pseudo-random bytes
 */
export function fakeRandomData(size: number): Uint8Array {
  return makeFakeRandomNumberGenerator().randomData(size);
}
