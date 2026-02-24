/**
 * Copyright © 2025 Signal Messenger, LLC
 * Copyright © 2026 Parity Technologies
 *
 * GF(2^16) Galois field arithmetic.
 * Ported from the Rust SPQR implementation.
 *
 * Primitive polynomial: x^16 + x^12 + x^3 + x + 1 (0x1100b)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Primitive polynomial for GF(2^16): x^16 + x^12 + x^3 + x + 1 */
export const POLY = 0x1_100b;

// ---------------------------------------------------------------------------
// Precomputed reduction table (256 entries)
// ---------------------------------------------------------------------------

/**
 * Build one entry of the reduction table.
 *
 * Given a single byte `a` that appears in positions [16..23] or [24..31] of
 * a 32-bit product, compute the 16-bit XOR mask needed to reduce those bits
 * modulo POLY.
 */
function reduceFromByte(a: number): number {
  let byte = a;
  let out = 0;
  for (let i = 7; i >= 0; i--) {
    if (((1 << i) & byte) !== 0) {
      out ^= POLY << i;
      byte ^= ((POLY << i) >>> 16) & 0xff;
    }
  }
  return out & 0xffff;
}

/** Precomputed 256-entry lookup table for polynomial reduction. */
const REDUCE_BYTES: Uint16Array = /* @__PURE__ */ (() => {
  const table = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    table[i] = reduceFromByte(i);
  }
  return table;
})();

// ---------------------------------------------------------------------------
// Low-level polynomial arithmetic (operates on raw u16/u32 numbers)
// ---------------------------------------------------------------------------

/**
 * Polynomial multiplication in GF(2)[x] (no reduction).
 *
 * Both `a` and `b` must be in the range [0, 0xffff].
 * The result may be up to 31 bits wide.
 */
function polyMul(a: number, b: number): number {
  let acc = 0;
  for (let shift = 0; shift < 16; shift++) {
    if ((b & (1 << shift)) !== 0) {
      acc ^= a << shift;
    }
  }
  // Keep as unsigned 32-bit
  return acc >>> 0;
}

/**
 * Reduce a 32-bit polynomial product modulo POLY, yielding a 16-bit result.
 *
 * Uses the precomputed REDUCE_BYTES table to process the top two bytes.
 */
export function polyReduce(v: number): number {
  let r = v >>> 0;
  // Reduce byte at positions [24..31]
  r ^= REDUCE_BYTES[(r >>> 24) & 0xff] << 8;
  // Reduce byte at positions [16..23]
  r ^= REDUCE_BYTES[(r >>> 16) & 0xff];
  return r & 0xffff;
}

/**
 * Full GF(2^16) multiplication of two raw u16 values.
 * Returns a u16 result.
 */
function mulRaw(a: number, b: number): number {
  return polyReduce(polyMul(a, b));
}

// ---------------------------------------------------------------------------
// GF16 class
// ---------------------------------------------------------------------------

/**
 * An element of GF(2^16).
 *
 * The `value` field holds a 16-bit unsigned integer in [0, 65535].
 */
export class GF16 {
  readonly value: number;

  constructor(value: number) {
    this.value = value & 0xffff;
  }

  // -- Static constants -----------------------------------------------------

  static readonly ZERO = new GF16(0);
  static readonly ONE = new GF16(1);

  // -- Arithmetic -----------------------------------------------------------

  /** Addition in GF(2^n) is XOR. */
  add(other: GF16): GF16 {
    return new GF16(this.value ^ other.value);
  }

  /** Subtraction in GF(2^n) is the same as addition (XOR). */
  sub(other: GF16): GF16 {
    return this.add(other);
  }

  /** Multiplication in GF(2^16) using polynomial long-multiplication + reduction. */
  mul(other: GF16): GF16 {
    return new GF16(mulRaw(this.value, other.value));
  }

  /**
   * Division in GF(2^16).
   *
   * Computes `this / other` via Fermat's little theorem:
   *   other^(-1) = other^(2^16 - 2)
   *
   * The loop accumulates the inverse through repeated squaring:
   *   After 15 iterations (i = 1..15):
   *     out = this * other^(2^16 - 2) = this * other^(-1)
   *
   * Throws if `other` is zero.
   */
  div(other: GF16): GF16 {
    if (other.value === 0) {
      throw new Error("GF16: division by zero");
    }

    let sqVal = mulRaw(other.value, other.value); // other^2
    let outVal = this.value;

    for (let i = 1; i < 16; i++) {
      // Compute both products using the OLD square value
      const newSqVal = mulRaw(sqVal, sqVal);
      const newOutVal = mulRaw(sqVal, outVal);
      sqVal = newSqVal;
      outVal = newOutVal;
    }

    return new GF16(outVal);
  }

  // -- Comparison -----------------------------------------------------------

  equals(other: GF16): boolean {
    return this.value === other.value;
  }

  // -- Display --------------------------------------------------------------

  toString(): string {
    return `GF16(0x${this.value.toString(16).padStart(4, "0")})`;
  }
}

// ---------------------------------------------------------------------------
// Parallel multiplication
// ---------------------------------------------------------------------------

/**
 * Multiply every element of `into` by `a` in-place.
 *
 * This is the TypeScript equivalent of Rust's `parallel_mult` which benefits
 * from SIMD on native platforms. Here we just iterate.
 */
export function parallelMult(a: GF16, into: GF16[]): void {
  const av = a.value;
  for (let i = 0; i < into.length; i++) {
    into[i] = new GF16(mulRaw(av, into[i].value));
  }
}
