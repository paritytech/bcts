/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Float encoding and conversion utilities for dCBOR.
 *
 * # Floating Point Number Support in dCBOR
 *
 * dCBOR provides canonical encoding for floating point values.
 *
 * Per the dCBOR specification, the canonical encoding rules ensure
 * deterministic representation:
 *
 * - Numeric reduction: Floating point values with zero fractional part in
 *   range [-2^63, 2^64-1] are automatically encoded as integers (e.g., 42.0
 *   becomes 42)
 * - Values are encoded in the smallest possible representation that preserves
 *   their value
 * - All NaN values are canonicalized to a single representation: 0xf97e00
 * - Positive/negative infinity are canonicalized to half-precision
 *   representations
 *
 * @module float
 */

import * as byteData from "byte-data";
import { encodeVarInt } from "./varint";
import { MajorType } from "./cbor";
import { ExactU64, ExactU32, ExactU16, ExactI128 } from "./exact";

/**
 * Canonical NaN representation in CBOR: 0xf97e00
 */
export const CBOR_NAN = new Uint8Array([0xf9, 0x7e, 0x00]);

/**
 * Check if a number has a fractional part.
 */
export const hasFractionalPart = (n: number): boolean => n !== Math.floor(n);

/**
 * Convert 64-bit binary to number.
 * @internal
 */
export const binary64ToNumber = (data: Uint8Array): number => {
  return byteData.unpack(data, { bits: 64, fp: true, be: true });
};

/**
 * Convert number to 32-bit float binary (big-endian).
 */
export const numberToBinary32 = (n: number): Uint8Array => {
  const data = new Uint8Array(4);
  byteData.packTo(n, { bits: 32, fp: true, be: true }, data);
  return data;
};

/**
 * Convert 32-bit binary to number.
 */
export const binary32ToNumber = (data: Uint8Array): number => {
  return byteData.unpack(data, { bits: 32, fp: true, be: true });
};

/**
 * Convert number to 16-bit float binary (big-endian).
 */
export const numberToBinary16 = (n: number): Uint8Array => {
  const data = new Uint8Array(2);
  byteData.packTo(n, { bits: 16, fp: true, be: true }, data);
  return data;
};

/**
 * Convert 16-bit binary to number.
 */
export const binary16ToNumber = (data: Uint8Array): number => {
  return byteData.unpack(data, { bits: 16, fp: true, be: true });
};

/**
 * Encode f64 value to CBOR data bytes.
 * Implements numeric reduction and canonical encoding rules.
 * Matches Rust's f64_cbor_data function.
 * @internal
 */
export const f64CborData = (value: number): Uint8Array => {
  const n = value;

  // Try to reduce to f32 first
  const f32Bytes = numberToBinary32(n);
  const f = binary32ToNumber(f32Bytes);
  if (f === n) {
    return f32CborData(f);
  }

  // Try numeric reduction to negative integer
  if (n < 0.0) {
    const i128 = ExactI128.exactFromF64(n);
    if (i128 !== undefined) {
      const i = ExactU64.exactFromI128(-1n - i128);
      if (i !== undefined) {
        // Encode as a negative integer. Pass the bigint straight through:
        // encodeVarInt handles u64 losslessly via setBigUint64, whereas
        // narrowing through Number() would round magnitudes above 2^53.
        return encodeVarInt(i, MajorType.Negative);
      }
    }
  }

  // Try numeric reduction to unsigned integer
  const u = ExactU64.exactFromF64(n);
  if (u !== undefined) {
    return encodeVarInt(u, MajorType.Unsigned);
  }

  // Canonical NaN
  if (Number.isNaN(value)) {
    return CBOR_NAN;
  }

  // Encode as f64 - create binary manually (always 8 bytes with 0xfb prefix)
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, n, false); // big-endian
  const bytes = new Uint8Array(buffer);
  const majorByte = 0xfb; // 0x1b | (MajorType.Simple << 5) = 0x1b | 0xe0 = 0xfb
  return new Uint8Array([majorByte, ...bytes]);
};

/**
 * Encode f32 value to CBOR data bytes.
 * Implements numeric reduction and canonical encoding rules.
 * Matches Rust's f32_cbor_data function.
 * @internal
 */
export const f32CborData = (value: number): Uint8Array => {
  const n = value;

  // Try to reduce to f16
  const f16Bytes = numberToBinary16(n);
  const f = binary16ToNumber(f16Bytes);
  if (f === n) {
    return f16CborData(f);
  }

  // Try numeric reduction to negative integer. Math.fround keeps `-1 - n` in
  // f32 precision to match Rust's `-1f32 - n`.
  if (n < 0.0) {
    const u = ExactU64.exactFromF32(Math.fround(-1.0 - n));
    if (u !== undefined) {
      return encodeVarInt(u, MajorType.Negative);
    }
  }

  // Try numeric reduction to unsigned integer
  const u = ExactU32.exactFromF32(n);
  if (u !== undefined) {
    return encodeVarInt(u, MajorType.Unsigned);
  }

  // Canonical NaN
  if (Number.isNaN(value)) {
    return CBOR_NAN;
  }

  // Encode as f32 - always use 0xfa prefix with 4 bytes
  const bytes = numberToBinary32(n);
  return new Uint8Array([0xfa, ...bytes]);
};

/**
 * Encode f16 value to CBOR data bytes.
 * Implements numeric reduction and canonical encoding rules.
 * Matches Rust's f16_cbor_data function.
 * @internal
 */
export const f16CborData = (value: number): Uint8Array => {
  const n = value;

  // Try numeric reduction to negative integer
  if (n < 0.0) {
    const u = ExactU64.exactFromF64(-1.0 - n);
    if (u !== undefined) {
      return encodeVarInt(u, MajorType.Negative);
    }
  }

  // Try numeric reduction to unsigned integer
  const u = ExactU16.exactFromF64(n);
  if (u !== undefined) {
    return encodeVarInt(u, MajorType.Unsigned);
  }

  // Canonical NaN
  if (Number.isNaN(value)) {
    return CBOR_NAN;
  }

  // Encode as f16 - always use 0xf9 prefix with 2 bytes
  const bytes = numberToBinary16(value);
  return new Uint8Array([0xf9, ...bytes]);
};

/**
 * Render a float to its diagnostic string, matching Rust's `Simple` Display.
 *
 * Finite non-zero values with magnitude in [1e-4, 1e16) print in decimal with
 * at least one fractional digit (whole values get a trailing `.0`); everything
 * else prints in exponential form. Zero prints as `0.0`/`-0.0`.
 *
 * JS already produces the same shortest round-tripping digits; we only fix up
 * the notation threshold, the `e+` → `e` exponent, and the `.0` suffix.
 *
 * @param value - The float value
 * @returns Rust-`Display`-compatible string
 */
export const floatDisplayString = (value: number): string => {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
  if (value === 0) return Object.is(value, -0) ? "-0.0" : "0.0";

  const abs = Math.abs(value);
  if (abs >= 1e-4 && abs < 1e16) {
    // In this range String() never switches to exponential. Ensure at least
    // one fractional digit.
    let str = String(value);
    if (!str.includes(".")) {
      str = `${str}.0`;
    }
    return str;
  }

  // Drop the `+` in the exponent to match Rust (`1.5e+20` → `1.5e20`);
  // negative exponents keep their sign.
  return value.toExponential().replace("e+", "e");
};

/**
 * Convert the smallest possible float binary representation to number.
 * This is the canonical decoder - validates that larger representations
 * are not reducible to smaller ones.
 * @internal
 */
export const numberToBinary = (n: number): Uint8Array => {
  if (Number.isNaN(n)) {
    return new Uint8Array([0x7e, 0x00]);
  }

  const n32 = numberToBinary32(n);
  const f32 = binary32ToNumber(n32);
  if (f32 === n) {
    const n16 = numberToBinary16(n);
    const f16 = binary16ToNumber(n16);
    if (f16 === n) {
      return n16;
    }
    return n32;
  }

  // Create a 64-bit float binary inline
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, n, false); // big-endian
  return new Uint8Array(buffer);
};
