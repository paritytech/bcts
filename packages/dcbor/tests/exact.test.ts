/**
 * Exact-conversion tests — 1:1 port of Rust's `src/exact.rs` `mod tests`.
 *
 * The `Exact*` helpers underpin dCBOR's numeric reduction (float→int and
 * width-narrowing) and were previously untested on the TypeScript side. Each
 * case asserts the same boundary behavior as the reference: exact integers
 * convert, fractional/NaN/Infinity/out-of-range inputs reject (undefined), and
 * float round-trips use the same saturating-cast semantics as Rust's `as`.
 *
 * Rust uses i16/i32/i64/i128/u16/u32/u64/u128 and f16/f32/f64. TypeScript maps:
 *   - small integer targets -> `number`
 *   - 64/128-bit values     -> `bigint`
 *   - f16/f32/f64 inputs    -> `number` (JS has a single float type; f16/f32
 *                              inputs are passed as exactly-representable values)
 */

import {
  ExactI16,
  ExactI32,
  ExactI64,
  ExactI128,
  ExactU16,
  ExactU32,
  ExactU64,
  ExactU128,
  ExactF32,
  ExactF64,
} from "../src/exact";

const U64_MAX = 18446744073709551615n;
const I64_MAX = 9223372036854775807n;
const I64_MIN = -9223372036854775808n;
const U128_MAX = (1n << 128n) - 1n;
const I128_MAX = (1n << 127n) - 1n;
const I128_MIN = -(1n << 127n);

describe("Exact conversions (port of Rust exact.rs tests)", () => {
  test("exact_from_i16 (ExactI16)", () => {
    expect(ExactI16.exactFromF16(21.0)).toBe(21);
    expect(ExactI16.exactFromF16(21.5)).toBeUndefined();
    expect(ExactI16.exactFromF16(NaN)).toBeUndefined();
    expect(ExactI16.exactFromF16(Infinity)).toBeUndefined();
    expect(ExactI16.exactFromF16(-Infinity)).toBeUndefined();

    expect(ExactI16.exactFromF32(21.0)).toBe(21);
    expect(ExactI16.exactFromF32(21.5)).toBeUndefined();
    expect(ExactI16.exactFromF64(21.0)).toBe(21);
    expect(ExactI16.exactFromF64(21.5)).toBeUndefined();
    expect(ExactI16.exactFromF64(NaN)).toBeUndefined();
    expect(ExactI16.exactFromF64(Infinity)).toBeUndefined();

    expect(ExactI16.exactFromU64(21)).toBe(21);
    expect(ExactI16.exactFromU64(U64_MAX)).toBeUndefined();
    expect(ExactI16.exactFromU64(65536)).toBeUndefined();

    expect(ExactI16.exactFromI64(21)).toBe(21);
    expect(ExactI16.exactFromI64(-21)).toBe(-21);
    expect(ExactI16.exactFromI64(I64_MAX)).toBeUndefined();
    expect(ExactI16.exactFromI64(I64_MIN)).toBeUndefined();
    expect(ExactI16.exactFromI64(-65536)).toBeUndefined();

    expect(ExactI16.exactFromU128(21n)).toBe(21);
    expect(ExactI16.exactFromU128(U128_MAX)).toBeUndefined();
    expect(ExactI16.exactFromI128(21n)).toBe(21);
    expect(ExactI16.exactFromI128(-21n)).toBe(-21);
    expect(ExactI16.exactFromI128(I128_MAX)).toBeUndefined();
    expect(ExactI16.exactFromI128(I128_MIN)).toBeUndefined();
  });

  test("exact_from_i32 (ExactI32)", () => {
    expect(ExactI32.exactFromF64(21.0)).toBe(21);
    expect(ExactI32.exactFromF64(21.5)).toBeUndefined();
    expect(ExactI32.exactFromF64(NaN)).toBeUndefined();
    expect(ExactI32.exactFromF64(Infinity)).toBeUndefined();

    expect(ExactI32.exactFromU64(21)).toBe(21);
    expect(ExactI32.exactFromU64(U64_MAX)).toBeUndefined();
    expect(ExactI32.exactFromU64(4294967296)).toBeUndefined();

    expect(ExactI32.exactFromI64(21)).toBe(21);
    expect(ExactI32.exactFromI64(-21)).toBe(-21);
    expect(ExactI32.exactFromI64(I64_MAX)).toBeUndefined();
    expect(ExactI32.exactFromI64(I64_MIN)).toBeUndefined();
    expect(ExactI32.exactFromI64(-4294967296)).toBeUndefined();

    expect(ExactI32.exactFromI128(I128_MAX)).toBeUndefined();
    expect(ExactI32.exactFromI128(I128_MIN)).toBeUndefined();
  });

  test("exact_from_i64 (ExactI64)", () => {
    expect(ExactI64.exactFromF64(21.0)).toBe(21);
    expect(ExactI64.exactFromF64(21.5)).toBeUndefined();
    expect(ExactI64.exactFromF64(NaN)).toBeUndefined();
    expect(ExactI64.exactFromF64(Infinity)).toBeUndefined();

    expect(ExactI64.exactFromU64(21)).toBe(21);
    expect(ExactI64.exactFromU64(U64_MAX)).toBeUndefined();
    expect(ExactI64.exactFromU64(9223372036854775809n)).toBeUndefined();

    expect(ExactI64.exactFromI64(21)).toBe(21);
    expect(ExactI64.exactFromI64(-21)).toBe(-21);
    expect(ExactI64.exactFromI64(I64_MAX)).toBe(I64_MAX);
    expect(ExactI64.exactFromI64(I64_MIN)).toBe(I64_MIN);

    expect(ExactI64.exactFromU128(U128_MAX)).toBeUndefined();
    expect(ExactI64.exactFromI128(I128_MAX)).toBeUndefined();
    expect(ExactI64.exactFromI128(I128_MIN)).toBeUndefined();
  });

  test("exact_from_i128 (ExactI128)", () => {
    expect(ExactI128.exactFromF16(21.0)).toBe(21n);
    expect(ExactI128.exactFromF16(21.5)).toBeUndefined();
    expect(ExactI128.exactFromF64(21.0)).toBe(21n);
    expect(ExactI128.exactFromF64(21.5)).toBeUndefined();
    expect(ExactI128.exactFromF64(NaN)).toBeUndefined();
    expect(ExactI128.exactFromF64(Infinity)).toBeUndefined();

    expect(ExactI128.exactFromI64(I64_MAX)).toBe(I64_MAX);
    expect(ExactI128.exactFromI64(I64_MIN)).toBe(I64_MIN);
  });

  test("exact_from_u16 (ExactU16)", () => {
    expect(ExactU16.exactFromF16(21.0)).toBe(21);
    expect(ExactU16.exactFromF16(21.5)).toBeUndefined();
    expect(ExactU16.exactFromF16(NaN)).toBeUndefined();
    expect(ExactU16.exactFromF16(Infinity)).toBeUndefined();

    expect(ExactU16.exactFromF64(21.0)).toBe(21);
    expect(ExactU16.exactFromF64(21.5)).toBeUndefined();

    expect(ExactU16.exactFromU64(21)).toBe(21);
    expect(ExactU16.exactFromU64(U64_MAX)).toBeUndefined();
    expect(ExactU16.exactFromU64(65536)).toBeUndefined();

    expect(ExactU16.exactFromI64(21)).toBe(21);
    expect(ExactU16.exactFromI64(-21)).toBeUndefined();
    expect(ExactU16.exactFromI64(I64_MIN)).toBeUndefined();

    expect(ExactU16.exactFromU128(21n)).toBe(21);
    expect(ExactU16.exactFromU128(U128_MAX)).toBeUndefined();
    expect(ExactU16.exactFromI128(-21n)).toBeUndefined();
  });

  test("exact_from_u32 (ExactU32)", () => {
    expect(ExactU32.exactFromF64(21.0)).toBe(21);
    expect(ExactU32.exactFromF64(21.5)).toBeUndefined();
    expect(ExactU32.exactFromF64(NaN)).toBeUndefined();
    expect(ExactU32.exactFromF64(Infinity)).toBeUndefined();

    expect(ExactU32.exactFromU64(21)).toBe(21);
    expect(ExactU32.exactFromU64(U64_MAX)).toBeUndefined();
    expect(ExactU32.exactFromU64(4294967296)).toBeUndefined();

    expect(ExactU32.exactFromI64(21)).toBe(21);
    expect(ExactU32.exactFromI64(-21)).toBeUndefined();
  });

  test("exact_from_u64 (ExactU64)", () => {
    expect(ExactU64.exactFromU64(21)).toBe(21);
    expect(ExactU64.exactFromU64(U64_MAX)).toBe(U64_MAX);

    expect(ExactU64.exactFromI64(21)).toBe(21);
    expect(ExactU64.exactFromI64(-21)).toBeUndefined();
    expect(ExactU64.exactFromI64(I64_MAX)).toBe(I64_MAX);
    expect(ExactU64.exactFromI64(I64_MIN)).toBeUndefined();

    expect(ExactU64.exactFromU128(21n)).toBe(21);
    expect(ExactU64.exactFromU128(U128_MAX)).toBeUndefined();
    expect(ExactU64.exactFromI128(21n)).toBe(21);
    expect(ExactU64.exactFromI128(-21n)).toBeUndefined();
  });

  test("exact_from_u128 (ExactU128)", () => {
    expect(ExactU128.exactFromU64(21)).toBe(21n);
    expect(ExactU128.exactFromU128(U128_MAX)).toBe(U128_MAX);
    expect(ExactU128.exactFromI64(-21n)).toBeUndefined();
  });

  test("exact_from_f32 (ExactF32)", () => {
    expect(ExactF32.exactFromF16(21.0)).toBe(21.0);
    expect(ExactF32.exactFromF16(21.5)).toBe(21.5);
    expect(Number.isNaN(ExactF32.exactFromF16(NaN) as number)).toBe(true);
    expect(ExactF32.exactFromF16(Infinity)).toBe(Infinity);
    expect(ExactF32.exactFromF16(-Infinity)).toBe(-Infinity);

    expect(ExactF32.exactFromF64(21.0)).toBe(21.0);
    expect(ExactF32.exactFromF64(21.5)).toBe(21.5);

    expect(ExactF32.exactFromU64(21)).toBe(21.0);
    // u64::MAX rounds to 2^64 (finite in f32) and the saturating round-trip
    // clamps 2^64 back to u64::MAX, so this is accepted (matches Rust).
    expect(ExactF32.exactFromU64(U64_MAX)).toBe(18446744073709551616.0);
    expect(ExactF32.exactFromU64(9223372036854775809n)).toBeUndefined();

    expect(ExactF32.exactFromI64(21)).toBe(21.0);
    expect(ExactF32.exactFromI64(-21)).toBe(-21.0);
    expect(ExactF32.exactFromI64(I64_MAX)).toBe(9223372036854775808.0);
    expect(ExactF32.exactFromI64(I64_MIN)).toBe(-9223372036854775808.0);
    expect(ExactF32.exactFromI64(-9223372036854775807n)).toBeUndefined();

    expect(ExactF32.exactFromU128(21n)).toBe(21.0);
    expect(ExactF32.exactFromU128(U128_MAX)).toBeUndefined();
    expect(ExactF32.exactFromU128(9223372036854775809n)).toBeUndefined();

    expect(ExactF32.exactFromI128(21n)).toBe(21.0);
    expect(ExactF32.exactFromI128(-21n)).toBe(-21.0);
    expect(ExactF32.exactFromI128(I128_MAX)).toBeUndefined();
    expect(ExactF32.exactFromI128(I128_MIN)).toBeUndefined();
    expect(ExactF32.exactFromI128(-9223372036854775807n)).toBeUndefined();
  });

  test("exact_from_f64 (ExactF64)", () => {
    expect(ExactF64.exactFromF16(21.0)).toBe(21.0);
    expect(ExactF64.exactFromF32(21.5)).toBe(21.5);
    expect(ExactF64.exactFromF64(21.0)).toBe(21.0);
    expect(ExactF64.exactFromF64(21.5)).toBe(21.5);
    expect(ExactF64.exactFromF64(Infinity)).toBe(Infinity);

    expect(ExactF64.exactFromU64(21)).toBe(21.0);
    expect(ExactF64.exactFromU64(U64_MAX)).toBe(18446744073709551616.0);
    expect(ExactF64.exactFromU64(9223372036854775809n)).toBeUndefined();

    expect(ExactF64.exactFromI64(21)).toBe(21.0);
    expect(ExactF64.exactFromI64(-21)).toBe(-21.0);
    expect(ExactF64.exactFromI64(-9223372036854775807n)).toBeUndefined();

    expect(ExactF64.exactFromU128(21n)).toBe(21.0);
    // u128::MAX rounds to 2^128 (finite in f64); the saturating round-trip
    // clamps 2^128 back to u128::MAX, so this is accepted (matches Rust).
    expect(ExactF64.exactFromU128(U128_MAX)).toBe(3.402823669209385e38);
    expect(ExactF64.exactFromU128(9223372036854775809n)).toBeUndefined();

    expect(ExactF64.exactFromI128(21n)).toBe(21.0);
    expect(ExactF64.exactFromI128(-21n)).toBe(-21.0);
    expect(ExactF64.exactFromI128(I128_MAX)).toBeUndefined();
    expect(ExactF64.exactFromI128(I128_MIN)).toBeUndefined();
    expect(ExactF64.exactFromI128(-9223372036854775807n)).toBeUndefined();
  });

  // Detailed port of Rust `test_exact_u64_from_f64`.
  test("exact_u64_from_f64 boundaries", () => {
    const t = (n: number, expected: number | bigint | undefined) =>
      expect(ExactU64.exactFromF64(n)).toBe(expected);
    t(1234.0, 1234);
    expect(ExactU64.exactFromF64(-1234.0)).toBeUndefined();
    // Shortest exponential forms; === 18446744073709550000.0 / ...552000.0.
    expect(ExactU64.exactFromF64(1.844674407370955e19)).toBe(18446744073709549568n);
    expect(ExactU64.exactFromF64(1.8446744073709552e19)).toBeUndefined();
    // 0.0 and -0.0 both reduce to numeric zero (use === so -0 equals 0).
    expect(ExactU64.exactFromF64(0.0) === 0).toBe(true);
    expect(ExactU64.exactFromF64(-0.0) === 0).toBe(true);
    expect(ExactU64.exactFromF64(0.5)).toBeUndefined();
    expect(ExactU64.exactFromF64(-0.5)).toBeUndefined();
    expect(ExactU64.exactFromF64(NaN)).toBeUndefined();
    expect(ExactU64.exactFromF64(Infinity)).toBeUndefined();
    expect(ExactU64.exactFromF64(-Infinity)).toBeUndefined();
    // 2^53 - 1, largest exact integer in f64.
    t(9007199254740991.0, 9007199254740991);
    t(1.0, 1);
    expect(ExactU64.exactFromF64(5e-324)).toBeUndefined();
    // 2^64 as f64 cannot round-trip back to a distinct u64.
    expect(ExactU64.exactFromF64(18446744073709551616.0)).toBeUndefined();
    expect(ExactU64.exactFromF64(1.0000000000000002)).toBeUndefined();
    expect(ExactU64.exactFromF64(4503599627370495.5)).toBeUndefined();
    // Smallest positive normal f64 and largest f64 — neither is an exact u64.
    expect(ExactU64.exactFromF64(2.2250738585072014e-308)).toBeUndefined(); // f64::MIN_POSITIVE
    expect(ExactU64.exactFromF64(1.7976931348623157e308)).toBeUndefined(); // f64::MAX
  });

  // Detailed port of Rust `test_exact_i64_from_f64_exact`.
  test("exact_i64_from_f64 boundaries", () => {
    // 0.0 and -0.0 both reduce to numeric zero (use === so -0 equals 0).
    expect(ExactI64.exactFromF64(0.0) === 0).toBe(true);
    expect(ExactI64.exactFromF64(-0.0) === 0).toBe(true);
    expect(ExactI64.exactFromF64(0.5)).toBeUndefined();
    expect(ExactI64.exactFromF64(-0.5)).toBeUndefined();
    expect(ExactI64.exactFromF64(1234.0)).toBe(1234);
    expect(ExactI64.exactFromF64(-1234.0)).toBe(-1234);
    expect(ExactI64.exactFromF64(NaN)).toBeUndefined();
    expect(ExactI64.exactFromF64(Infinity)).toBeUndefined();
    expect(ExactI64.exactFromF64(1024.0)).toBe(1024);
    expect(ExactI64.exactFromF64(-1024.0)).toBe(-1024);
    expect(ExactI64.exactFromF64(1234.56)).toBeUndefined();
    // 2^53 - 1 == Number.MAX_SAFE_INTEGER, so it is returned as a `number`.
    expect(ExactI64.exactFromF64(9007199254740991.0)).toBe(9007199254740991);
    expect(ExactI64.exactFromF64(-9007199254740991.0)).toBe(-9007199254740991);
    // Most negative double that converts to int64 (exceeds the safe range, so
    // returned as a bigint).
    expect(ExactI64.exactFromF64(-9223372036854774784.0)).toBe(-9223372036854774784n);
    // i64::MAX as f64 rounds up to 2^63 (out of range) -> undefined; i64::MIN
    // as f64 is exact (-2^63), returned as bigint.
    expect(ExactI64.exactFromF64(9223372036854775808.0)).toBeUndefined();
    expect(ExactI64.exactFromF64(-9223372036854775808.0)).toBe(I64_MIN);
    // Subnormal magnitudes are not exact integers.
    expect(ExactI64.exactFromF64(1e-308)).toBeUndefined();
    expect(ExactI64.exactFromF64(-1e-308)).toBeUndefined();
  });
});
