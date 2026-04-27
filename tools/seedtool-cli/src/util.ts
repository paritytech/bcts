/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Utility functions for data conversion
 * Ported from seedtool-cli-rust/src/util.rs
 */

/**
 * Convert bytes to hex string.
 * Matches Rust data_to_hex function.
 */
export function dataToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert hex string to bytes.
 *
 * Mirrors the error wording produced by Rust's `hex` crate
 * (`FromHexError::OddLength` and `FromHexError::InvalidHexCharacter`),
 * which seedtool-cli-rust surfaces unchanged through anyhow:
 *
 *   "Odd number of digits"
 *   "Invalid character '{c}' at position {n}"
 *
 * The outer CLI layer adds the `Error: ` prefix to match Rust's anyhow
 * output.
 */
export function hexToData(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Odd number of digits");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const hi = hexCharToNibble(hex, i);
    const lo = hexCharToNibble(hex, i + 1);
    bytes[i / 2] = (hi << 4) | lo;
  }
  return bytes;
}

function hexCharToNibble(hex: string, index: number): number {
  const c = hex.charCodeAt(index);
  // 0..9
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  // a..f
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  // A..F
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
  throw new Error(`Invalid character '${hex[index]}' at position ${index}`);
}

/**
 * Convert byte values to a different base range [0, base-1].
 * Each byte (0-255) is scaled proportionally to the target base.
 * Matches Rust data_to_base function.
 *
 * @param buf - Input bytes
 * @param base - Target base (e.g., 6 for base-6)
 * @returns Array of values in range [0, base-1]
 */
export function dataToBase(buf: Uint8Array, base: number): Uint8Array {
  const result = new Uint8Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    // Scale from [0,255] to [0,base-1] with rounding
    result[i] = Math.round((buf[i] / 255) * (base - 1));
  }
  return result;
}

/**
 * Convert bytes to an alphabet string using a base and alphabet function.
 * Matches Rust data_to_alphabet function.
 *
 * @param buf - Input bytes
 * @param base - Target base
 * @param toAlphabet - Function to convert index to character
 * @returns String of alphabet characters
 */
export function dataToAlphabet(
  buf: Uint8Array,
  base: number,
  toAlphabet: (n: number) => string,
): string {
  const data = dataToBase(buf, base);
  return Array.from(data)
    .map((b) => toAlphabet(b))
    .join("");
}

/**
 * Parse whitespace-separated integers.
 * Matches Rust parse_ints function.
 *
 * @param input - Space-separated integer string
 * @returns Array of bytes
 * @throws Error if any integer is out of range [0, 255]
 */
export function parseInts(input: string): Uint8Array {
  const parts = input.trim().split(/\s+/);
  const result: number[] = [];
  for (const s of parts) {
    if (s === "") continue;
    const i = parseInt(s, 10);
    if (isNaN(i)) {
      throw new Error(`Invalid integer: ${s}`);
    }
    if (i < 0 || i > 255) {
      throw new Error("Integer out of range. Allowed: [0-255]");
    }
    result.push(i);
  }
  return new Uint8Array(result);
}

/**
 * Convert bytes to a string of integers in a given range.
 * Matches Rust data_to_ints function.
 *
 * @param buf - Input bytes
 * @param low - Lowest output value (0-254)
 * @param high - Highest output value (1-255), low < high
 * @param separator - String to separate values
 * @returns String of integers
 * @throws Error if range is invalid
 */
export function dataToInts(buf: Uint8Array, low: number, high: number, separator: string): string {
  if (!(low < high && high <= 255)) {
    throw new Error("Int conversion range must be in 0 <= low < high <= 255.");
  }
  const base = high - low + 1;
  const data = dataToBase(buf, base);
  return Array.from(data)
    .map((b) => (b + low).toString())
    .join(separator);
}

/**
 * Parse a string of digits in a given range to bytes.
 * Matches Rust digits_to_data function.
 *
 * @param inStr - String of digits
 * @param low - Lowest valid digit
 * @param high - Highest valid digit
 * @returns Array of digit values
 * @throws Error if any digit is out of range
 */
export function digitsToData(inStr: string, low: number, high: number): Uint8Array {
  const result: number[] = [];
  for (const c of inStr) {
    const n = c.charCodeAt(0) - "0".charCodeAt(0);
    if (n < low || n > high) {
      // Mirrors Rust util.rs:64 (`bail!("Invalid digit.")`). The terser wording
      // is intentional — if Rust's diagnostic is broadened upstream, mirror here.
      throw new Error("Invalid digit.");
    }
    result.push(n);
  }
  return new Uint8Array(result);
}
