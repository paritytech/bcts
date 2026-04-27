/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

/**
 * Interpolate `t` from [0..1] to [a..b].
 */
export function lerpTo(toA: number, toB: number, t: number): number {
  return t * (toB - toA) + toA;
}

/**
 * Interpolate `t` from [a..b] to [0..1].
 */
export function lerpFrom(fromA: number, fromB: number, t: number): number {
  return (fromA - t) / (fromA - fromB);
}

/**
 * Interpolate `t` from [a..b] to [c..d].
 */
export function lerp(fromA: number, fromB: number, toC: number, toD: number, t: number): number {
  return lerpTo(toC, toD, lerpFrom(fromA, fromB, t));
}

/**
 * Return the minimum of `a` and `b`.
 */
export function min(a: number, b: number): number;
/**
 * Return the minimum of `a`, `b`, and `c`.
 */
// eslint-disable-next-line no-redeclare
export function min(a: number, b: number, c: number): number;
// eslint-disable-next-line no-redeclare
export function min(a: number, b: number, c?: number): number {
  if (c !== undefined) {
    return Math.min(Math.min(a, b), c);
  }
  return a < b ? a : b;
}

/**
 * Return the maximum of `a` and `b`.
 */
export function max(a: number, b: number): number;
/**
 * Return the maximum of `a`, `b`, and `c`.
 */
// eslint-disable-next-line no-redeclare
export function max(a: number, b: number, c: number): number;
// eslint-disable-next-line no-redeclare
export function max(a: number, b: number, c?: number): number {
  if (c !== undefined) {
    return Math.max(Math.max(a, b), c);
  }
  return a > b ? a : b;
}

/**
 * Return `n` clamped to the range [0..1].
 */
export function clamped(n: number): number {
  return max(min(n, 1), 0);
}

/**
 * Return `dividend` MODULO `divisor` where `dividend` can be negative,
 * but the result is always non-negative.
 *
 * Round-trips through `f32` to mirror Rust's `(x as f32) % (y as f32)` —
 * which the Rust crate uses to match the original C++ `fmodf`.
 */
const moduloF32 = new Float32Array(1);
function toF32(x: number): number {
  moduloF32[0] = x;
  return moduloF32[0];
}
export function modulo(dividend: number, divisor: number): number {
  const d = toF32(divisor);
  const a = toF32(toF32(dividend) % d);
  const b = toF32(a + d) % d;
  return toF32(b);
}

/**
 * A struct representing a color.
 */
export class Color {
  constructor(
    public r = 0,
    public g = 0,
    public b = 0,
  ) {}

  static white = new Color(1, 1, 1);
  static black = new Color(0, 0, 0);
  static red = new Color(1, 0, 0);
  static green = new Color(0, 1, 0);
  static blue = new Color(0, 0, 1);
  static cyan = new Color(0, 1, 1);
  static magenta = new Color(1, 0, 1);
  static yellow = new Color(1, 1, 0);

  /**
   * Create a Color from uint8 values [0..255].
   */
  static fromUint8Values(r: number, g: number, b: number): Color {
    return new Color(r / 255, g / 255, b / 255);
  }

  /**
   * Linearly interpolate from this color to another.
   */
  lerpTo(other: Color, t: number): Color {
    const f = clamped(t);
    const red = clamped(this.r * (1 - f) + other.r * f);
    const green = clamped(this.g * (1 - f) + other.g * f);
    const blue = clamped(this.b * (1 - f) + other.b * f);
    return new Color(red, green, blue);
  }

  /**
   * Lighten this color by interpolating towards white.
   */
  lighten(t: number): Color {
    return this.lerpTo(Color.white, t);
  }

  /**
   * Darken this color by interpolating towards black.
   */
  darken(t: number): Color {
    return this.lerpTo(Color.black, t);
  }

  /**
   * Apply a burn effect to this color.
   */
  burn(t: number): Color {
    const f = max(1.0 - t, 1.0e-7);
    return new Color(
      min(1.0 - (1.0 - this.r) / f, 1.0),
      min(1.0 - (1.0 - this.g) / f, 1.0),
      min(1.0 - (1.0 - this.b) / f, 1.0),
    );
  }

  /**
   * Calculate the luminance of this color.
   *
   * Uses `f32`-precision multiplies/squares/sqrt to mirror Rust's
   * `as f32 → powi(2) → sqrt() → as f64`, which in turn mirrors the
   * original C++ `sqrtf`/`powf`.
   */
  luminance(): number {
    const r = Math.fround(0.299 * this.r);
    const g = Math.fround(0.587 * this.g);
    const b = Math.fround(0.114 * this.b);
    const r2 = Math.fround(r * r);
    const g2 = Math.fround(g * g);
    const b2 = Math.fround(b * b);
    const sum = Math.fround(Math.fround(r2 + g2) + b2);
    return Math.fround(Math.sqrt(sum));
  }
}
