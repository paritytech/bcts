/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Utility functions for byte array conversions and comparisons.
 *
 * These functions provide cross-platform support for common byte manipulation
 * operations needed in cryptographic and encoding contexts.
 *
 * @packageDocumentation
 */

/**
 * Convert a Uint8Array to a lowercase hexadecimal string.
 *
 * @param data - The byte array to convert
 * @returns A lowercase hex string representation (2 characters per byte)
 *
 * @example
 * ```typescript
 * const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
 * bytesToHex(bytes); // "deadbeef"
 * ```
 */
export function bytesToHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a hexadecimal string to a Uint8Array.
 *
 * @param hex - A hex string (must have even length, case-insensitive)
 * @returns The decoded byte array
 * @throws {Error} If the hex string has odd length or contains invalid characters
 *
 * @example
 * ```typescript
 * hexToBytes("deadbeef"); // Uint8Array([0xde, 0xad, 0xbe, 0xef])
 * hexToBytes("DEADBEEF"); // Uint8Array([0xde, 0xad, 0xbe, 0xef])
 * hexToBytes("xyz"); // throws Error: Invalid hex string
 * ```
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`Hex string must have even length, got ${hex.length}`);
  }
  if (!/^[0-9A-Fa-f]*$/.test(hex)) {
    throw new Error("Invalid hex string: contains non-hexadecimal characters");
  }
  const data = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    data[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return data;
}

/**
 * Convert a Uint8Array to a base64-encoded string.
 *
 * This function works in both browser and Node.js environments.
 * Uses btoa which is available in browsers and Node.js 16+.
 *
 * @param data - The byte array to encode
 * @returns A base64-encoded string
 *
 * @example
 * ```typescript
 * const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
 * toBase64(bytes); // "SGVsbG8="
 * ```
 */
export function toBase64(data: Uint8Array): string {
  // Convert bytes to binary string without spread operator to avoid
  // call stack limits for large arrays (spread would fail at ~65k bytes)
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Convert a base64-encoded string to a Uint8Array.
 *
 * This function works in both browser and Node.js environments.
 * Uses atob which is available in browsers and Node.js 16+.
 *
 * @param base64 - A base64-encoded string
 * @returns The decoded byte array
 *
 * @example
 * ```typescript
 * fromBase64("SGVsbG8="); // Uint8Array([72, 101, 108, 108, 111])
 * ```
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compare two Uint8Arrays for equality using constant-time comparison.
 *
 * This function is designed to be resistant to timing attacks by always
 * comparing all bytes regardless of where a difference is found. The
 * comparison time depends only on the length of the arrays, not on where
 * they differ.
 *
 * **Security Note**: If the arrays have different lengths, this function
 * returns `false` immediately, which does leak length information. For
 * cryptographic uses where length should also be secret, ensure both
 * arrays are the same length before comparison.
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns `true` if both arrays have the same length and identical contents
 *
 * @example
 * ```typescript
 * const key1 = new Uint8Array([1, 2, 3, 4]);
 * const key2 = new Uint8Array([1, 2, 3, 4]);
 * const key3 = new Uint8Array([1, 2, 3, 5]);
 *
 * bytesEqual(key1, key2); // true
 * bytesEqual(key1, key3); // false
 * ```
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
