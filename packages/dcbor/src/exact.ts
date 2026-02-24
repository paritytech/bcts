/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Exact numeric conversions.
 *
 * This module is based on the Swift `exactly` initializers.
 * See https://github.com/apple/swift-evolution/blob/main/proposals/0080-failable-numeric-initializers.md
 * See https://github.com/apple/swift/blob/main/stdlib/public/core/IntegerTypes.swift.gyb
 *
 * Provides exact conversions between numeric types (f16/f32/f64/integers).
 * Returns undefined if the conversion cannot be represented exactly.
 *
 * @module exact
 */

import { binary16ToNumber, binary32ToNumber, numberToBinary16, numberToBinary32 } from "./float";

// TypeScript doesn't have native integer types with overflow, so we use number for most operations
// and bigint for values that exceed Number.MAX_SAFE_INTEGER

// Helper to check if a number has a fractional part
const hasFract = (n: number): boolean => {
  return n % 1 !== 0;
};

/**
 * Exact conversions for i16 (-32768 to 32767).
 */
export class ExactI16 {
  static readonly MIN = -32768;
  static readonly MAX = 32767;

  static exactFromF16(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -32768.0 || source >= 32768.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF32(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -32769.0 || source >= 32768.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF64(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -32769.0 || source >= 32768.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromU64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n > 32767) return undefined;
    return n;
  }

  static exactFromI64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n < -32768 || n > 32767) return undefined;
    return n;
  }

  static exactFromU128(source: bigint): number | undefined {
    if (source > 32767n) return undefined;
    return Number(source);
  }

  static exactFromI128(source: bigint): number | undefined {
    if (source < -32768n || source > 32767n) return undefined;
    return Number(source);
  }
}

/**
 * Exact conversions for i32 (-2147483648 to 2147483647).
 */
export class ExactI32 {
  static readonly MIN = -2147483648;
  static readonly MAX = 2147483647;

  static exactFromF16(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    // A Float16 value, if finite, is always in-range for 32-bit signed integer types
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF32(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -2147483904.0 || source >= 2147483648.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF64(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -2147483649.0 || source >= 2147483648.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromU64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n > 2147483647) return undefined;
    return n;
  }

  static exactFromI64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n < -2147483648 || n > 2147483647) return undefined;
    return n;
  }

  static exactFromU128(source: bigint): number | undefined {
    if (source > 2147483647n) return undefined;
    return Number(source);
  }

  static exactFromI128(source: bigint): number | undefined {
    if (source < -2147483648n || source > 2147483647n) return undefined;
    return Number(source);
  }
}

/**
 * Exact conversions for i64 (-9223372036854775808 to 9223372036854775807).
 */
export class ExactI64 {
  static readonly MIN = -9223372036854775808n;
  static readonly MAX = 9223372036854775807n;

  static exactFromF16(source: number): number | bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    // A Float16 value, if finite, is always in-range for 64-bit signed integer types
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF32(source: number): number | bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -9223373136366403584.0 || source >= 9223372036854775808.0) return undefined;
    if (hasFract(source)) return undefined;
    const result = Math.trunc(source);
    return result > Number.MAX_SAFE_INTEGER || result < Number.MIN_SAFE_INTEGER
      ? BigInt(result)
      : result;
  }

  static exactFromF64(source: number): number | bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -9223372036854777856.0 || source >= 9223372036854775808.0) return undefined;
    if (hasFract(source)) return undefined;
    const result = Math.trunc(source);
    return result > Number.MAX_SAFE_INTEGER || result < Number.MIN_SAFE_INTEGER
      ? BigInt(result)
      : result;
  }

  static exactFromU64(source: number | bigint): number | bigint | undefined {
    const n = typeof source === "bigint" ? source : BigInt(source);
    if (n > 9223372036854775807n) return undefined;
    return n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n;
  }

  static exactFromI64(source: number | bigint): number | bigint | undefined {
    // Identity conversion
    return source;
  }

  static exactFromU128(source: bigint): number | bigint | undefined {
    if (source > 9223372036854775807n) return undefined;
    return source <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(source) : source;
  }

  static exactFromI128(source: bigint): number | bigint | undefined {
    if (source < -9223372036854775808n || source > 9223372036854775807n) return undefined;
    return source <= BigInt(Number.MAX_SAFE_INTEGER) && source >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(source)
      : source;
  }
}

/**
 * Exact conversions for i128 (JavaScript bigint).
 */
export class ExactI128 {
  static readonly MIN = -(2n ** 127n);
  static readonly MAX = 2n ** 127n - 1n;

  static exactFromF16(source: number): bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    // A Float16 value, if finite, is always in-range for 128-bit signed integer types
    if (hasFract(source)) return undefined;
    return BigInt(Math.trunc(source));
  }

  static exactFromF32(source: number): bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    // f32::MIN and f32::MAX are both in range of i128
    if (hasFract(source)) return undefined;
    return BigInt(Math.trunc(source));
  }

  static exactFromF64(source: number): bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    // f64::MIN and f64::MAX are both in range of i128
    if (hasFract(source)) return undefined;
    return BigInt(Math.trunc(source));
  }

  static exactFromU64(source: number | bigint): bigint | undefined {
    return BigInt(source);
  }

  static exactFromI64(source: number | bigint): bigint | undefined {
    return BigInt(source);
  }

  static exactFromU128(source: bigint): bigint | undefined {
    const max = 2n ** 127n - 1n;
    if (source > max) return undefined;
    return source;
  }

  static exactFromI128(source: bigint): bigint | undefined {
    // Identity conversion
    return source;
  }
}

/**
 * Exact conversions for u16 (0 to 65535).
 */
export class ExactU16 {
  static readonly MIN = 0;
  static readonly MAX = 65535;

  static exactFromF16(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    // A Float16 value, if greater than -1 and finite, is always in-range for 16-bit unsigned integer types
    if (source <= -1.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF32(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0 || source >= 65536.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF64(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0 || source >= 65536.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromU64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n > 65535) return undefined;
    return n;
  }

  static exactFromI64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n < 0 || n > 65535) return undefined;
    return n;
  }

  static exactFromU128(source: bigint): number | undefined {
    if (source > 65535n) return undefined;
    return Number(source);
  }

  static exactFromI128(source: bigint): number | undefined {
    if (source < 0n || source > 65535n) return undefined;
    return Number(source);
  }
}

/**
 * Exact conversions for u32 (0 to 4294967295).
 */
export class ExactU32 {
  static readonly MIN = 0;
  static readonly MAX = 4294967295;

  static exactFromF16(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    // A Float16 value, if greater than -1 and finite, is always in-range for 32-bit unsigned integer types
    if (source <= -1.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF32(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0 || source >= 4294967296.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF64(source: number): number | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0 || source >= 4294967296.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromU64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n > 4294967295) return undefined;
    return n;
  }

  static exactFromI64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    if (n < 0 || n > 4294967295) return undefined;
    return n;
  }

  static exactFromU128(source: bigint): number | undefined {
    if (source > 4294967295n) return undefined;
    return Number(source);
  }

  static exactFromI128(source: bigint): number | undefined {
    if (source < 0n || source > 4294967295n) return undefined;
    return Number(source);
  }
}

/**
 * Exact conversions for u64 (0 to 18446744073709551615).
 */
export class ExactU64 {
  static readonly MIN = 0n;
  static readonly MAX = 18446744073709551615n;

  static exactFromF16(source: number): number | bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    // A Float16 value, if greater than -1 and finite, is always in-range for 64-bit unsigned integer types
    if (source <= -1.0) return undefined;
    if (hasFract(source)) return undefined;
    return Math.trunc(source);
  }

  static exactFromF32(source: number): number | bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0 || source >= 18446744073709551616.0) return undefined;
    if (hasFract(source)) return undefined;
    const result = Math.trunc(source);
    return result > Number.MAX_SAFE_INTEGER ? BigInt(result) : result;
  }

  static exactFromF64(source: number): number | bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0 || source >= 18446744073709551616.0) return undefined;
    if (hasFract(source)) return undefined;
    const result = Math.trunc(source);
    return result > Number.MAX_SAFE_INTEGER ? BigInt(result) : result;
  }

  static exactFromU64(source: number | bigint): number | bigint | undefined {
    // Identity conversion
    return source;
  }

  static exactFromI64(source: number | bigint): number | bigint | undefined {
    const n = typeof source === "bigint" ? source : BigInt(source);
    if (n < 0n) return undefined;
    return source;
  }

  static exactFromU128(source: bigint): number | bigint | undefined {
    if (source > 18446744073709551615n) return undefined;
    return source <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(source) : source;
  }

  static exactFromI128(source: bigint): number | bigint | undefined {
    if (source < 0n || source > 18446744073709551615n) return undefined;
    return source <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(source) : source;
  }
}

/**
 * Exact conversions for u128 (JavaScript bigint, unsigned).
 */
export class ExactU128 {
  static readonly MIN = 0n;
  static readonly MAX = 2n ** 128n - 1n;

  static exactFromF16(source: number): bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0) return undefined;
    if (hasFract(source)) return undefined;
    return BigInt(Math.trunc(source));
  }

  static exactFromF32(source: number): bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0) return undefined;
    if (hasFract(source)) return undefined;
    return BigInt(Math.trunc(source));
  }

  static exactFromF64(source: number): bigint | undefined {
    if (!Number.isFinite(source)) return undefined;
    if (source <= -1.0) return undefined;
    if (hasFract(source)) return undefined;
    return BigInt(Math.trunc(source));
  }

  static exactFromU64(source: number | bigint): bigint | undefined {
    return BigInt(source);
  }

  static exactFromI64(source: number | bigint): bigint | undefined {
    const n = typeof source === "bigint" ? source : BigInt(source);
    if (n < 0n) return undefined;
    return n;
  }

  static exactFromU128(source: bigint): bigint | undefined {
    // Identity conversion
    return source;
  }

  static exactFromI128(source: bigint): bigint | undefined {
    if (source < 0n) return undefined;
    return source;
  }
}

/**
 * Exact conversions for f16 (half precision float).
 * In TypeScript, we work with f16 as raw bytes (Uint8Array of length 2).
 */
export class ExactF16 {
  static exactFromF16(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    return source;
  }

  static exactFromF32(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    if (!Number.isFinite(source)) return source; // Infinity

    // Convert to f16 and back to check exactness
    const f16Bytes = numberToBinary16(source);
    const roundTrip = binary16ToNumber(f16Bytes);
    return roundTrip === source ? roundTrip : undefined;
  }

  static exactFromF64(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    if (!Number.isFinite(source)) return source; // Infinity

    // Convert to f16 and back to check exactness
    const f16Bytes = numberToBinary16(source);
    const roundTrip = binary16ToNumber(f16Bytes);
    return roundTrip === source ? roundTrip : undefined;
  }

  static exactFromU64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    const f16Bytes = numberToBinary16(n);
    const f = binary16ToNumber(f16Bytes);
    if (!Number.isFinite(f)) return undefined;
    const roundTrip = typeof source === "bigint" ? BigInt(Math.trunc(f)) : Math.trunc(f);
    return roundTrip === source ? f : undefined;
  }

  static exactFromI64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    const f16Bytes = numberToBinary16(n);
    const f = binary16ToNumber(f16Bytes);
    if (!Number.isFinite(f)) return undefined;
    const roundTrip = typeof source === "bigint" ? BigInt(Math.trunc(f)) : Math.trunc(f);
    return roundTrip === source ? f : undefined;
  }

  static exactFromU128(source: bigint): number | undefined {
    const n = Number(source);
    const f16Bytes = numberToBinary16(n);
    const f = binary16ToNumber(f16Bytes);
    if (!Number.isFinite(f)) return undefined;
    const roundTrip = BigInt(Math.trunc(f));
    return roundTrip === source ? f : undefined;
  }

  static exactFromI128(source: bigint): number | undefined {
    const n = Number(source);
    const f16Bytes = numberToBinary16(n);
    const f = binary16ToNumber(f16Bytes);
    if (!Number.isFinite(f)) return undefined;
    const roundTrip = BigInt(Math.trunc(f));
    return roundTrip === source ? f : undefined;
  }
}

/**
 * Exact conversions for f32 (single precision float).
 */
export class ExactF32 {
  static exactFromF16(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    return source; // f16 always fits in f32
  }

  static exactFromF32(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    return source;
  }

  static exactFromF64(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    // JavaScript numbers are f64, need to check if it fits in f32 exactly
    const f32Bytes = numberToBinary32(source);
    const roundTrip = binary32ToNumber(f32Bytes);
    return roundTrip === source ? roundTrip : undefined;
  }

  static exactFromU64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    const f32Bytes = numberToBinary32(n);
    const f = binary32ToNumber(f32Bytes);
    const roundTrip = typeof source === "bigint" ? BigInt(Math.trunc(f)) : Math.trunc(f);
    return roundTrip === source ? f : undefined;
  }

  static exactFromI64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    const f32Bytes = numberToBinary32(n);
    const f = binary32ToNumber(f32Bytes);
    const roundTrip = typeof source === "bigint" ? BigInt(Math.trunc(f)) : Math.trunc(f);
    return roundTrip === source ? f : undefined;
  }

  static exactFromU128(source: bigint): number | undefined {
    const n = Number(source);
    const f32Bytes = numberToBinary32(n);
    const f = binary32ToNumber(f32Bytes);
    if (!Number.isFinite(f)) return undefined;
    const roundTrip = BigInt(Math.trunc(f));
    return roundTrip === source ? f : undefined;
  }

  static exactFromI128(source: bigint): number | undefined {
    // Check the range
    if (source < -0x8000_0000n || source > 0x7fff_ffffn) return undefined;

    const absSource = source < 0n ? -source : source;

    // Check the magnitude
    if (absSource <= 0xff_ffffn) {
      return Number(source);
    }

    // Check divisibility by powers of 2
    const trailingZeros = countTrailingZeros(absSource);
    if (trailingZeros >= 25 && trailingZeros <= 31) {
      return Number(source);
    }

    return undefined;
  }
}

/**
 * Exact conversions for f64 (double precision float).
 */
export class ExactF64 {
  static exactFromF16(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    return source; // f16 always fits in f64
  }

  static exactFromF32(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    return source; // f32 always fits in f64
  }

  static exactFromF64(source: number): number | undefined {
    if (Number.isNaN(source)) return NaN;
    return source;
  }

  static exactFromU64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    const roundTrip = typeof source === "bigint" ? BigInt(Math.trunc(n)) : Math.trunc(n);
    return roundTrip === source ? n : undefined;
  }

  static exactFromI64(source: number | bigint): number | undefined {
    const n = typeof source === "bigint" ? Number(source) : source;
    const roundTrip = typeof source === "bigint" ? BigInt(Math.trunc(n)) : Math.trunc(n);
    return roundTrip === source ? n : undefined;
  }

  static exactFromU128(source: bigint): number | undefined {
    const n = Number(source);
    const roundTrip = BigInt(Math.trunc(n));
    return roundTrip === source ? n : undefined;
  }

  static exactFromI128(source: bigint): number | undefined {
    // Check the range
    if (source < -0x8000_0000_0000_0000n || source > 0x7fff_ffff_ffff_ffffn) {
      return undefined;
    }

    const absSource = source < 0n ? -source : source;

    // Check the magnitude
    if (absSource <= 0xf_ffff_ffff_ffffn) {
      return Number(source);
    }

    // Check divisibility by powers of 2
    const trailingZeros = countTrailingZeros(absSource);
    if (trailingZeros >= 53 && trailingZeros <= 63) {
      return Number(source);
    }

    return undefined;
  }
}

// Helper function to count trailing zeros in a bigint
const countTrailingZeros = (n: bigint): number => {
  if (n === 0n) return 0;
  let count = 0;
  while ((n & 1n) === 0n) {
    count++;
    n = n >> 1n;
  }
  return count;
};

// ============================================================================
// CBOR Type Extraction Utilities
// ============================================================================

import { type Cbor, MajorType } from "./cbor";

/**
 * Extract exact unsigned integer value.
 * Returns undefined if not an unsigned integer.
 */
export const exactUnsigned = (cbor: Cbor): number | bigint | undefined => {
  if (cbor.type === MajorType.Unsigned) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract exact negative integer value (as actual negative number).
 * Returns undefined if not a negative integer.
 */
export const exactNegative = (cbor: Cbor): number | bigint | undefined => {
  if (cbor.type === MajorType.Negative) {
    if (typeof cbor.value === "bigint") {
      return -(cbor.value + 1n);
    }
    return -(cbor.value + 1);
  }
  return undefined;
};

/**
 * Extract exact integer value (unsigned or negative).
 * Returns undefined if not an integer.
 */
export const exactInteger = (cbor: Cbor): number | bigint | undefined => {
  return exactUnsigned(cbor) ?? exactNegative(cbor);
};

/**
 * Extract exact string value.
 * Returns undefined if not a text string.
 */
export const exactString = (cbor: Cbor): string | undefined => {
  if (cbor.type === MajorType.Text) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract exact byte string value.
 * Returns undefined if not a byte string.
 */
export const exactBytes = (cbor: Cbor): Uint8Array | undefined => {
  if (cbor.type === MajorType.ByteString) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract exact array value.
 * Returns undefined if not an array.
 */
export const exactArray = (cbor: Cbor): readonly Cbor[] | undefined => {
  if (cbor.type === MajorType.Array) {
    return cbor.value;
  }
  return undefined;
};
