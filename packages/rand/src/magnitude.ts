/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-rand-rust/src/magnitude.rs

/**
 * Converts a signed integer to its unsigned magnitude.
 * For positive numbers, returns the number unchanged.
 * For negative numbers, returns the absolute value (wrapping for MIN values).
 *
 * This matches Rust's wrapping_abs() behavior.
 */
export function toMagnitude(value: number, bits: 8 | 16 | 32): number {
  switch (bits) {
    case 8: {
      // i8 to u8: wrapping_abs
      const i8Value = (value << 24) >> 24; // Sign extend to i8
      return Math.abs(i8Value) & 0xff;
    }
    case 16: {
      // i16 to u16: wrapping_abs
      const i16Value = (value << 16) >> 16; // Sign extend to i16
      return Math.abs(i16Value) & 0xffff;
    }
    case 32: {
      // i32 to u32: wrapping_abs
      const i32Value = value | 0; // Force to i32
      // Handle MIN_VALUE specially (wrapping behavior)
      if (i32Value === -2147483648) {
        return 2147483648; // Returns as positive
      }
      return Math.abs(i32Value) >>> 0; // Convert to unsigned
    }
  }
}

/**
 * Converts a signed bigint to its unsigned magnitude for 64-bit values.
 */
export function toMagnitude64(value: bigint): bigint {
  const mask = 0xffffffffffffffffn;
  // Handle negative values
  if (value < 0n) {
    // Wrapping absolute value
    const absValue = -value;
    return absValue & mask;
  }
  return value & mask;
}

/**
 * Converts an unsigned magnitude back to a signed value.
 * Simply reinterprets the bits.
 */
export function fromMagnitude(magnitude: number, bits: 8 | 16 | 32): number {
  switch (bits) {
    case 8:
      return (magnitude << 24) >> 24; // Sign extend from u8 to i8
    case 16:
      return (magnitude << 16) >> 16; // Sign extend from u16 to i16
    case 32:
      return magnitude | 0; // Reinterpret as i32
  }
}

/**
 * Converts an unsigned 64-bit magnitude back to a signed bigint.
 */
export function fromMagnitude64(magnitude: bigint): bigint {
  const mask = 0xffffffffffffffffn;
  const signBit = 1n << 63n;
  const maskedMag = magnitude & mask;
  if ((maskedMag & signBit) !== 0n) {
    // Negative value - convert from two's complement
    return maskedMag - (1n << 64n);
  }
  return maskedMag;
}
