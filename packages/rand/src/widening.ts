/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// The below is so we don't have to use #![feature(bigint_helper_methods)]
// Ported from bc-rand-rust/src/widening.rs

/**
 * Wide multiplication result type - returns (low, high) parts.
 * For a multiplication of two N-bit values, the result is 2N bits
 * split into two N-bit parts.
 */
export type WideMulResult = [bigint, bigint];

/**
 * Performs wide multiplication for unsigned integers.
 * Returns (low, high) parts of the full-width result.
 *
 * This is equivalent to Rust's widening_mul for unsigned types.
 */
export function wideMul(a: bigint, b: bigint, bits: number): WideMulResult {
  const mask = (1n << BigInt(bits)) - 1n;
  const wide = (a & mask) * (b & mask);
  const low = wide & mask;
  const high = wide >> BigInt(bits);
  return [low, high];
}

/**
 * Wide multiplication for 8-bit unsigned integers.
 * @param a - First 8-bit value
 * @param b - Second 8-bit value
 * @returns Tuple of (low 8 bits, high 8 bits)
 */
export function wideMulU8(a: number, b: number): [number, number] {
  const wide = (a & 0xff) * (b & 0xff);
  return [wide & 0xff, (wide >> 8) & 0xff];
}

/**
 * Wide multiplication for 16-bit unsigned integers.
 * @param a - First 16-bit value
 * @param b - Second 16-bit value
 * @returns Tuple of (low 16 bits, high 16 bits)
 */
export function wideMulU16(a: number, b: number): [number, number] {
  const wide = (a & 0xffff) * (b & 0xffff);
  return [wide & 0xffff, (wide >>> 16) & 0xffff];
}

/**
 * Wide multiplication for 32-bit unsigned integers.
 * @param a - First 32-bit value
 * @param b - Second 32-bit value
 * @returns Tuple of (low 32 bits, high 32 bits) as bigints
 */
export function wideMulU32(a: number, b: number): [bigint, bigint] {
  const aBig = BigInt(a >>> 0);
  const bBig = BigInt(b >>> 0);
  const wide = aBig * bBig;
  return [wide & 0xffffffffn, wide >> 32n];
}

/**
 * Wide multiplication for 64-bit unsigned integers.
 * @param a - First 64-bit value as bigint
 * @param b - Second 64-bit value as bigint
 * @returns Tuple of (low 64 bits, high 64 bits) as bigints
 */
export function wideMulU64(a: bigint, b: bigint): [bigint, bigint] {
  const mask64 = 0xffffffffffffffffn;
  const wide = (a & mask64) * (b & mask64);
  return [wide & mask64, wide >> 64n];
}
