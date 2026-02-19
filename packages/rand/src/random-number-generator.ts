/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-rand-rust/src/random_number_generator.rs

import { wideMulU32, wideMulU64 } from "./widening.js";
import {
  toMagnitude,
  toMagnitude64 as _toMagnitude64,
  fromMagnitude as _fromMagnitude,
  fromMagnitude64 as _fromMagnitude64,
} from "./magnitude.js";

/**
 * Interface for random number generators.
 * This is the TypeScript equivalent of Rust's RandomNumberGenerator trait
 * which extends RngCore + CryptoRng.
 *
 * This is compatible with the RandomNumberGenerator Swift protocol used
 * in MacOS and iOS, which is important for cross-platform testing.
 */
export interface RandomNumberGenerator {
  /**
   * Returns the next random 32-bit unsigned integer.
   */
  nextU32(): number;

  /**
   * Returns the next random 64-bit unsigned integer as a bigint.
   */
  nextU64(): bigint;

  /**
   * Fills the given Uint8Array with random bytes.
   */
  fillBytes(dest: Uint8Array): void;

  /**
   * Returns a Uint8Array of random bytes of the given size.
   */
  randomData(size: number): Uint8Array;

  /**
   * Fills the given Uint8Array with random bytes.
   * Alias for fillBytes for compatibility.
   */
  fillRandomData(data: Uint8Array): void;
}

/**
 * Returns a Uint8Array of random bytes of the given size.
 */
export function rngRandomData(rng: RandomNumberGenerator, size: number): Uint8Array {
  const data = new Uint8Array(size);
  rng.fillRandomData(data);
  return data;
}

/**
 * Fills the given Uint8Array with random bytes.
 */
export function rngFillRandomData(rng: RandomNumberGenerator, data: Uint8Array): void {
  rng.fillRandomData(data);
}

/**
 * Returns a random value that is less than the given upper bound.
 *
 * Uses Lemire's "nearly divisionless" method for generating random
 * integers in an interval. For a detailed explanation, see:
 * https://arxiv.org/abs/1805.10941
 *
 * @param rng - The random number generator to use
 * @param upperBound - The upper bound for the randomly generated value. Must be non-zero.
 * @returns A random value in the range [0, upperBound). Every value in the range is equally likely.
 */
export function rngNextWithUpperBound(rng: RandomNumberGenerator, upperBound: bigint): bigint {
  if (upperBound === 0n) {
    throw new Error("upperBound must be non-zero");
  }

  // We use Lemire's "nearly divisionless" method for generating random
  // integers in an interval. For a detailed explanation, see:
  // https://arxiv.org/abs/1805.10941

  const bitmask = 0xffffffffffffffffn; // u64 max
  let random = rng.nextU64() & bitmask;
  let m = wideMulU64(random, upperBound);

  if (m[0] < upperBound) {
    // t = (0 - upperBound) % upperBound
    const negUpperBound = (bitmask + 1n - upperBound) & bitmask;
    const t = negUpperBound % upperBound;
    while (m[0] < t) {
      random = rng.nextU64() & bitmask;
      m = wideMulU64(random, upperBound);
    }
  }

  return m[1];
}

/**
 * Returns a random 32-bit value that is less than the given upper bound.
 * This matches Rust's behavior when called with u32 type.
 *
 * Uses Lemire's "nearly divisionless" method with 32-bit arithmetic.
 *
 * @param rng - The random number generator to use
 * @param upperBound - The upper bound for the randomly generated value. Must be non-zero and fit in u32.
 * @returns A random u32 value in the range [0, upperBound).
 */
export function rngNextWithUpperBoundU32(rng: RandomNumberGenerator, upperBound: number): number {
  if (upperBound === 0) {
    throw new Error("upperBound must be non-zero");
  }

  const upperBoundU32 = upperBound >>> 0;
  const bitmask = 0xffffffff;

  // Get random and mask to 32 bits (matches Rust behavior)
  let random = Number(rng.nextU64() & BigInt(bitmask));
  let m = wideMulU32(random, upperBoundU32);

  if (Number(m[0]) < upperBoundU32) {
    // t = (0 - upperBound) % upperBound (wrapping subtraction)
    const t = ((bitmask + 1 - upperBoundU32) >>> 0) % upperBoundU32;
    while (Number(m[0]) < t) {
      random = Number(rng.nextU64() & BigInt(bitmask));
      m = wideMulU32(random, upperBoundU32);
    }
  }

  return Number(m[1]);
}

/**
 * Returns a random value within the specified range [start, end) using 32-bit arithmetic.
 * This matches Rust's behavior when called with i32 types.
 *
 * @param rng - The random number generator to use
 * @param start - The lower bound (inclusive) as i32
 * @param end - The upper bound (exclusive) as i32
 * @returns A random i32 value within the bounds
 */
export function rngNextInRangeI32(rng: RandomNumberGenerator, start: number, end: number): number {
  if (start >= end) {
    throw new Error("start must be less than end");
  }

  const startI32 = start | 0;
  const endI32 = end | 0;
  const delta = toMagnitude(endI32 - startI32, 32);

  if (delta === 0xffffffff) {
    return rng.nextU32() | 0;
  }

  const random = rngNextWithUpperBoundU32(rng, delta);
  return (startI32 + random) | 0;
}

/**
 * Returns a random value within the specified range [start, end).
 *
 * @param rng - The random number generator to use
 * @param start - The lower bound (inclusive)
 * @param end - The upper bound (exclusive)
 * @returns A random value within the bounds of the range
 */
export function rngNextInRange(rng: RandomNumberGenerator, start: bigint, end: bigint): bigint {
  if (start >= end) {
    throw new Error("start must be less than end");
  }

  const delta = end - start;

  // If delta covers the entire range, just return a random value
  const maxU64 = 0xffffffffffffffffn;
  if (delta === maxU64) {
    return rng.nextU64();
  }

  const random = rngNextWithUpperBound(rng, delta);
  return start + random;
}

/**
 * Returns a random value within the specified closed range [start, end].
 *
 * @param rng - The random number generator to use
 * @param start - The lower bound (inclusive)
 * @param end - The upper bound (inclusive)
 * @returns A random value within the bounds of the range
 */
export function rngNextInClosedRange(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  if (start > end) {
    throw new Error("start must be less than or equal to end");
  }

  const delta = end - start;

  // If delta covers the entire range, just return a random value
  const maxU64 = 0xffffffffffffffffn;
  if (delta === maxU64) {
    return rng.nextU64();
  }

  const random = rngNextWithUpperBound(rng, delta + 1n);
  return start + random;
}

/**
 * Returns a random value within the specified closed range [start, end] for i32 values.
 * Convenience function that handles signed 32-bit integers.
 *
 * @param rng - The random number generator to use
 * @param start - The lower bound (inclusive) as i32
 * @param end - The upper bound (inclusive) as i32
 * @returns A random i32 value within the bounds of the range
 */
export function rngNextInClosedRangeI32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) {
    throw new Error("start must be less than or equal to end");
  }

  // Convert to i32
  const startI32 = start | 0;
  const endI32 = end | 0;

  // Calculate delta as u32 magnitude
  const delta = toMagnitude(endI32 - startI32, 32);

  // If delta covers the entire u32 range, just return a random value
  if (delta === 0xffffffff) {
    return rng.nextU32() | 0;
  }

  const random = rngNextWithUpperBoundU32(rng, delta + 1);
  return (startI32 + random) | 0;
}

/**
 * Returns a fixed-size array of random bytes.
 *
 * @param rng - The random number generator to use
 * @param size - The size of the array to return
 * @returns A Uint8Array of the specified size filled with random bytes
 */
export function rngRandomArray(rng: RandomNumberGenerator, size: number): Uint8Array {
  const data = new Uint8Array(size);
  rng.fillRandomData(data);
  return data;
}

/**
 * Returns a random boolean value.
 *
 * @param rng - The random number generator to use
 * @returns A random boolean
 */
export function rngRandomBool(rng: RandomNumberGenerator): boolean {
  return (rng.nextU32() & 1) === 0;
}

/**
 * Returns a random 32-bit unsigned integer.
 *
 * @param rng - The random number generator to use
 * @returns A random u32 value
 */
export function rngRandomU32(rng: RandomNumberGenerator): number {
  return rng.nextU32();
}
