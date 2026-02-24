/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Byte array utility functions.
 *
 * @module pattern/value/bytes-utils
 */

/**
 * Compares two Uint8Arrays for equality.
 */
export const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

/**
 * Tests if bytes start with a prefix.
 */
export const bytesStartsWith = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
  if (bytes.length < prefix.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) {
      return false;
    }
  }
  return true;
};

/**
 * Converts a Uint8Array to a Latin-1 string for regex matching.
 * Each byte value (0-255) maps directly to a character code.
 * This mimics Rust's regex::bytes::Regex behavior.
 */
export const bytesToLatin1 = (bytes: Uint8Array): string => {
  let result = "";
  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }
  return result;
};
