/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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
 */
export function modulo(dividend: number, divisor: number): number {
  return ((dividend % divisor) + divisor) % divisor;
}
