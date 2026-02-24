/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Standard library re-exports and compatibility layer.
 *
 * In Rust, this handles std/no_std feature flags.
 * In TypeScript, this is primarily documentation.
 *
 * @module stdlib
 */

import { CborError } from "./error";

/**
 * Concatenate multiple byte arrays into one.
 */
export const concatBytes = (arrays: Uint8Array[]): Uint8Array => {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
};

/**
 * Check if two byte arrays are equal.
 */
export const areBytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/**
 * Lexicographically compare two byte arrays.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export const lexicographicallyCompareBytes = (a: Uint8Array, b: Uint8Array): number => {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal === undefined || bVal === undefined) {
      throw new CborError({ type: "Custom", message: "Unexpected undefined byte in array" });
    }
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }
  if (a.length < b.length) return -1;
  if (a.length > b.length) return 1;
  return 0;
};
