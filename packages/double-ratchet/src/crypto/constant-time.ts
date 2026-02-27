// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * Constant-time byte array comparison.
 *
 * Prevents timing side-channel attacks when comparing secrets
 * (MACs, keys, fingerprints, etc.).
 */

/**
 * Constant-time comparison of two byte arrays.
 *
 * Returns true if both arrays have the same length and identical contents.
 * The comparison always examines every byte to prevent timing leaks.
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns true if arrays are equal
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
