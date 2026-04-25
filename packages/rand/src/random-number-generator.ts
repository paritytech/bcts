/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-rand-rust/src/random_number_generator.rs

import { wideMulU8, wideMulU16, wideMulU32, wideMulU64 } from "./widening.js";
import { toMagnitude, toMagnitude64, fromMagnitude64 } from "./magnitude.js";

/**
 * Interface for random number generators.
 *
 * The TypeScript equivalent of Rust's `RandomNumberGenerator` trait
 * (which extends `RngCore + CryptoRng`).
 */
export interface RandomNumberGenerator {
  /** Returns the next random 32-bit unsigned integer. */
  nextU32(): number;

  /** Returns the next random 64-bit unsigned integer as a bigint. */
  nextU64(): bigint;

  /** Fills the given Uint8Array with random bytes. */
  fillBytes(dest: Uint8Array): void;

  /** Returns a Uint8Array of random bytes of the given size. */
  randomData(size: number): Uint8Array;

  /** Fills the given Uint8Array with random bytes. Alias for fillBytes. */
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

// =====================================================================
// Lemire's "nearly divisionless" upper-bound sampler
// (https://arxiv.org/abs/1805.10941)
//
// Rust exposes a single generic `rng_next_with_upper_bound<T>`. JavaScript
// has no integer-width generics, so we provide one specialization per
// width — `U8`, `U16`, `U32`, `U64` — exactly mirroring the Rust dispatch.
// =====================================================================

/**
 * Returns a random `u8` value strictly less than `upperBound`.
 */
export function rngNextWithUpperBoundU8(
  rng: RandomNumberGenerator,
  upperBound: number,
): number {
  if (upperBound === 0) throw new Error("upperBound must be non-zero");
  const ub = upperBound & 0xff;
  let random = Number(rng.nextU64() & 0xffn);
  let m = wideMulU8(random, ub);
  if (m[0] < ub) {
    const t = ((0x100 - ub) & 0xff) % ub;
    while (m[0] < t) {
      random = Number(rng.nextU64() & 0xffn);
      m = wideMulU8(random, ub);
    }
  }
  return m[1];
}

/**
 * Returns a random `u16` value strictly less than `upperBound`.
 */
export function rngNextWithUpperBoundU16(
  rng: RandomNumberGenerator,
  upperBound: number,
): number {
  if (upperBound === 0) throw new Error("upperBound must be non-zero");
  const ub = upperBound & 0xffff;
  let random = Number(rng.nextU64() & 0xffffn);
  let m = wideMulU16(random, ub);
  if (m[0] < ub) {
    const t = ((0x10000 - ub) & 0xffff) % ub;
    while (m[0] < t) {
      random = Number(rng.nextU64() & 0xffffn);
      m = wideMulU16(random, ub);
    }
  }
  return m[1];
}

/**
 * Returns a random `u32` value strictly less than `upperBound`.
 */
export function rngNextWithUpperBoundU32(
  rng: RandomNumberGenerator,
  upperBound: number,
): number {
  if (upperBound === 0) throw new Error("upperBound must be non-zero");
  const ub = upperBound >>> 0;
  let random = Number(rng.nextU64() & 0xffffffffn);
  let m = wideMulU32(random, ub);
  if (Number(m[0]) < ub) {
    const t = ((0x100000000 - ub) >>> 0) % ub;
    while (Number(m[0]) < t) {
      random = Number(rng.nextU64() & 0xffffffffn);
      m = wideMulU32(random, ub);
    }
  }
  return Number(m[1]);
}

/**
 * Returns a random `u64` value strictly less than `upperBound`.
 */
export function rngNextWithUpperBoundU64(
  rng: RandomNumberGenerator,
  upperBound: bigint,
): bigint {
  if (upperBound === 0n) throw new Error("upperBound must be non-zero");
  const mask64 = 0xffffffffffffffffn;
  const ub = upperBound & mask64;
  let random = rng.nextU64() & mask64;
  let m = wideMulU64(random, ub);
  if (m[0] < ub) {
    // wrapping_sub(0, ub) within u64
    const t = ((mask64 + 1n - ub) & mask64) % ub;
    while (m[0] < t) {
      random = rng.nextU64() & mask64;
      m = wideMulU64(random, ub);
    }
  }
  return m[1];
}

/**
 * Alias of `rngNextWithUpperBoundU64`. Kept for API backwards compatibility.
 *
 * @deprecated Prefer the explicit-width name `rngNextWithUpperBoundU64`.
 */
export const rngNextWithUpperBound = rngNextWithUpperBoundU64;

// =====================================================================
// Range / closed-range samplers
//
// Mirrors Rust `rng_next_in_range<T>` and `rng_next_in_closed_range<T>`.
// `from_u64(...).unwrap()` in the early-return branch panics in Rust when
// the random `u64` does not fit in `T`. We mirror that with a thrown
// `Error` so cross-platform behavior matches exactly.
// =====================================================================

function fromU64ThrowsIfAbove(value: bigint, max: bigint): bigint {
  if (value > max) {
    throw new Error("from_u64 conversion overflow");
  }
  return value;
}

/** Random `u8` in the half-open range [start, end). */
export function rngNextInRangeU8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start >= end) throw new Error("start must be less than end");
  const lo = start & 0xff;
  const hi = end & 0xff;
  const delta = (hi - lo) & 0xff;
  if (delta === 0xff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0xffn));
  }
  return (lo + rngNextWithUpperBoundU8(rng, delta)) & 0xff;
}

/** Random `u16` in the half-open range [start, end). */
export function rngNextInRangeU16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start >= end) throw new Error("start must be less than end");
  const lo = start & 0xffff;
  const hi = end & 0xffff;
  const delta = (hi - lo) & 0xffff;
  if (delta === 0xffff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0xffffn));
  }
  return (lo + rngNextWithUpperBoundU16(rng, delta)) & 0xffff;
}

/** Random `u32` in the half-open range [start, end). */
export function rngNextInRangeU32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start >= end) throw new Error("start must be less than end");
  const lo = start >>> 0;
  const hi = end >>> 0;
  const delta = (hi - lo) >>> 0;
  if (delta === 0xffffffff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0xffffffffn));
  }
  return (lo + rngNextWithUpperBoundU32(rng, delta)) >>> 0;
}

/** Random `u64` in the half-open range [start, end). */
export function rngNextInRangeU64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  if (start >= end) throw new Error("start must be less than end");
  const mask64 = 0xffffffffffffffffn;
  const delta = (end - start) & mask64;
  if (delta === mask64) {
    // Every u64 fits in u64 — `from_u64::<u64>` is total — no throw.
    return rng.nextU64();
  }
  return (start + rngNextWithUpperBoundU64(rng, delta)) & mask64;
}

/**
 * Alias of `rngNextInRangeU64`. Kept for API backwards compatibility.
 *
 * @deprecated Prefer the explicit-width name `rngNextInRangeU64`.
 */
export const rngNextInRange = rngNextInRangeU64;

/** Random `i8` in the half-open range [start, end). */
export function rngNextInRangeI8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start >= end) throw new Error("start must be less than end");
  const lo = (start << 24) >> 24;
  const hi = (end << 24) >> 24;
  const delta = toMagnitude(hi - lo, 8);
  if (delta === 0xff) {
    // i8::from_u64 succeeds only when value <= i8::MAX = 127
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0x7fn));
  }
  const random = rngNextWithUpperBoundU8(rng, delta);
  return ((lo + random) << 24) >> 24;
}

/** Random `i16` in the half-open range [start, end). */
export function rngNextInRangeI16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start >= end) throw new Error("start must be less than end");
  const lo = (start << 16) >> 16;
  const hi = (end << 16) >> 16;
  const delta = toMagnitude(hi - lo, 16);
  if (delta === 0xffff) {
    // i16::from_u64 succeeds only when value <= i16::MAX = 32767
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0x7fffn));
  }
  const random = rngNextWithUpperBoundU16(rng, delta);
  return ((lo + random) << 16) >> 16;
}

/** Random `i32` in the half-open range [start, end). */
export function rngNextInRangeI32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start >= end) throw new Error("start must be less than end");
  const lo = start | 0;
  const hi = end | 0;
  const delta = toMagnitude(hi - lo, 32);
  if (delta === 0xffffffff) {
    // i32::from_u64 succeeds only when value <= i32::MAX = 2147483647
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0x7fffffffn));
  }
  const random = rngNextWithUpperBoundU32(rng, delta);
  return (lo + random) | 0;
}

/** Random `i64` in the half-open range [start, end). */
export function rngNextInRangeI64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  if (start >= end) throw new Error("start must be less than end");
  const delta = toMagnitude64(end - start);
  const mask64 = 0xffffffffffffffffn;
  if (delta === mask64) {
    // i64::from_u64 succeeds only when value <= i64::MAX = (2^63 - 1)
    return fromU64ThrowsIfAbove(rng.nextU64(), 0x7fffffffffffffffn);
  }
  const random = rngNextWithUpperBoundU64(rng, delta);
  return fromMagnitude64((toMagnitude64(start) + random) & mask64);
}

/** Random `u8` in the closed range [start, end]. */
export function rngNextInClosedRangeU8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new Error("start must be less than or equal to end");
  const lo = start & 0xff;
  const hi = end & 0xff;
  const delta = (hi - lo) & 0xff;
  if (delta === 0xff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0xffn));
  }
  return (lo + rngNextWithUpperBoundU8(rng, delta + 1)) & 0xff;
}

/** Random `u16` in the closed range [start, end]. */
export function rngNextInClosedRangeU16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new Error("start must be less than or equal to end");
  const lo = start & 0xffff;
  const hi = end & 0xffff;
  const delta = (hi - lo) & 0xffff;
  if (delta === 0xffff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0xffffn));
  }
  return (lo + rngNextWithUpperBoundU16(rng, delta + 1)) & 0xffff;
}

/** Random `u32` in the closed range [start, end]. */
export function rngNextInClosedRangeU32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new Error("start must be less than or equal to end");
  const lo = start >>> 0;
  const hi = end >>> 0;
  const delta = (hi - lo) >>> 0;
  if (delta === 0xffffffff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0xffffffffn));
  }
  return (lo + rngNextWithUpperBoundU32(rng, delta + 1)) >>> 0;
}

/** Random `u64` in the closed range [start, end]. */
export function rngNextInClosedRangeU64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  if (start > end) throw new Error("start must be less than or equal to end");
  const mask64 = 0xffffffffffffffffn;
  const delta = (end - start) & mask64;
  if (delta === mask64) {
    return rng.nextU64();
  }
  return (start + rngNextWithUpperBoundU64(rng, delta + 1n)) & mask64;
}

/**
 * Alias of `rngNextInClosedRangeU64`. Kept for API backwards compatibility.
 *
 * @deprecated Prefer the explicit-width name `rngNextInClosedRangeU64`.
 */
export const rngNextInClosedRange = rngNextInClosedRangeU64;

/** Random `i8` in the closed range [start, end]. */
export function rngNextInClosedRangeI8(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new Error("start must be less than or equal to end");
  const lo = (start << 24) >> 24;
  const hi = (end << 24) >> 24;
  const delta = toMagnitude(hi - lo, 8);
  if (delta === 0xff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0x7fn));
  }
  const random = rngNextWithUpperBoundU8(rng, delta + 1);
  return ((lo + random) << 24) >> 24;
}

/** Random `i16` in the closed range [start, end]. */
export function rngNextInClosedRangeI16(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new Error("start must be less than or equal to end");
  const lo = (start << 16) >> 16;
  const hi = (end << 16) >> 16;
  const delta = toMagnitude(hi - lo, 16);
  if (delta === 0xffff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0x7fffn));
  }
  const random = rngNextWithUpperBoundU16(rng, delta + 1);
  return ((lo + random) << 16) >> 16;
}

/** Random `i32` in the closed range [start, end]. */
export function rngNextInClosedRangeI32(
  rng: RandomNumberGenerator,
  start: number,
  end: number,
): number {
  if (start > end) throw new Error("start must be less than or equal to end");
  const lo = start | 0;
  const hi = end | 0;
  const delta = toMagnitude(hi - lo, 32);
  if (delta === 0xffffffff) {
    return Number(fromU64ThrowsIfAbove(rng.nextU64(), 0x7fffffffn));
  }
  const random = rngNextWithUpperBoundU32(rng, delta + 1);
  return (lo + random) | 0;
}

/** Random `i64` in the closed range [start, end]. */
export function rngNextInClosedRangeI64(
  rng: RandomNumberGenerator,
  start: bigint,
  end: bigint,
): bigint {
  if (start > end) throw new Error("start must be less than or equal to end");
  const delta = toMagnitude64(end - start);
  const mask64 = 0xffffffffffffffffn;
  if (delta === mask64) {
    return fromU64ThrowsIfAbove(rng.nextU64(), 0x7fffffffffffffffn);
  }
  const random = rngNextWithUpperBoundU64(rng, delta + 1n);
  return fromMagnitude64((toMagnitude64(start) + random) & mask64);
}

/**
 * Returns a random fixed-size byte array.
 *
 * Mirrors Rust's `rng_random_array<const N: usize>()` but takes the size at
 * runtime since JavaScript lacks const generics.
 */
export function rngRandomArray(rng: RandomNumberGenerator, size: number): Uint8Array {
  const data = new Uint8Array(size);
  rng.fillRandomData(data);
  return data;
}

/**
 * Returns a random boolean. Mirrors Rust's `rng_random_bool` which tests
 * whether `next_u32()` is a multiple of 2.
 */
export function rngRandomBool(rng: RandomNumberGenerator): boolean {
  return (rng.nextU32() & 1) === 0;
}

/**
 * Returns a random 32-bit unsigned integer.
 */
export function rngRandomU32(rng: RandomNumberGenerator): number {
  return rng.nextU32();
}
