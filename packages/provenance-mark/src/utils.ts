/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Utility functions for byte array conversions.
 *
 * These functions provide cross-platform support for common byte manipulation
 * operations needed in provenance mark encoding.
 */

/**
 * Convert a Uint8Array to a lowercase hexadecimal string.
 *
 * @param data - The byte array to convert
 * @returns A lowercase hex string representation (2 characters per byte)
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
 *
 * @param data - The byte array to encode
 * @returns A base64-encoded string
 */
export function toBase64(data: Uint8Array): string {
  // Convert bytes to binary string without spread operator to avoid
  // call stack limits for large arrays
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
 *
 * @param base64 - A base64-encoded string
 * @returns The decoded byte array
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
 * Parse a base64-encoded provenance seed.
 *
 * Mirrors Rust's `parse_seed` user helper
 * (`provenance-mark-rust/src/util.rs:34-38`), which round-trips the
 * input through serde JSON / `deserialize_block` and so requires the
 * decoded bytes to be exactly {@link PROVENANCE_SEED_LENGTH} (32) long.
 * The TS equivalent decodes the base64 directly and delegates to
 * {@link ProvenanceSeed.fromBytes} for the length check.
 *
 * @param s - Base64-encoded 32-byte seed string.
 * @returns The decoded {@link ProvenanceSeed}.
 * @throws {ProvenanceMarkError} If the input is not valid base64 or the
 *   decoded length is not exactly 32 bytes.
 */
export function parseSeed(s: string): ProvenanceSeed {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(s);
  } catch (e) {
    throw new ProvenanceMarkError(
      ProvenanceMarkErrorType.Base64Error,
      "invalid base64 encoding for provenance seed",
      { details: e instanceof Error ? e.message : String(e) },
    );
  }
  return ProvenanceSeed.fromBytes(bytes);
}

/**
 * Parse a date string (`YYYY-MM-DD` or full RFC 3339) into a `Date`.
 *
 * Mirrors Rust's `parse_date` user helper
 * (`provenance-mark-rust/src/util.rs:40-42`), which delegates to
 * `Date::from_string` (the same parser the JSON deserializer uses).
 * Accepts the same shapes the Rust parser does:
 *
 * - `YYYY-MM-DD` (interpreted as UTC midnight, matching JS spec).
 * - Full RFC 3339, e.g. `2023-06-20T15:30:45Z` or
 *   `2023-06-20T15:30:45.123Z`.
 *
 * @throws {ProvenanceMarkError} If the input fails to parse.
 */
export function parseDate(s: string): Date {
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) {
    throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidDate, `cannot parse date: ${s}`);
  }
  return date;
}

import { ProvenanceSeed } from "./seed.js";
import { ProvenanceMarkError, ProvenanceMarkErrorType } from "./error.js";
