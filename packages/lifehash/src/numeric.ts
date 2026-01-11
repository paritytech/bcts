// Float32 conversion buffer for C++ float emulation
const float32Buffer = new Float32Array(1);

/**
 * Convert a double to float precision (matches C++ float behavior).
 */
export function toFloat(n: number): number {
  float32Buffer[0] = n;
  return float32Buffer[0];
}

/**
 * Float version of fmod (matches C++ fmodf).
 */
export function fmodf(dividend: number, divisor: number): number {
  return toFloat(toFloat(dividend) % toFloat(divisor));
}

/**
 * Float version of floor (matches C++ floorf).
 */
export function floorf(n: number): number {
  return Math.floor(toFloat(n));
}

/**
 * Float version of sqrt (matches C++ sqrtf).
 */
export function sqrtf(n: number): number {
  return toFloat(Math.sqrt(toFloat(n)));
}

/**
 * Float version of pow (matches C++ powf).
 */
export function powf(base: number, exp: number): number {
  return toFloat(Math.pow(toFloat(base), toFloat(exp)));
}

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
export function lerp(
  fromA: number,
  fromB: number,
  toC: number,
  toD: number,
  t: number,
): number {
  return lerpTo(toC, toD, lerpFrom(fromA, fromB, t));
}

/**
 * Return the minimum of `a` and `b`.
 */
export function min(a: number, b: number): number;
/**
 * Return the minimum of `a`, `b`, and `c`.
 */
export function min(a: number, b: number, c: number): number;
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
export function max(a: number, b: number, c: number): number;
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
 * Uses fmodf for C++ parity.
 */
export function modulo(dividend: number, divisor: number): number {
  return fmodf(fmodf(dividend, divisor) + divisor, divisor);
}
