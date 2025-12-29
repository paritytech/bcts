/**
 * ByteString pattern for dCBOR pattern matching.
 *
 * @module pattern/value/bytestring-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { asBytes, bytesToHex } from "@bcts/dcbor";
import type { Path } from "../../format";

/**
 * Pattern for matching byte string values in dCBOR.
 *
 * Note: The BinaryRegex variant uses a RegExp that matches against the
 * hex-encoded string representation of the bytes. This is a known difference
 * from the Rust implementation which uses regex::bytes::Regex for direct
 * binary matching.
 */
export type ByteStringPattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: Uint8Array }
  | { readonly variant: "BinaryRegex"; readonly pattern: RegExp };

/**
 * Creates a ByteStringPattern that matches any byte string.
 */
export const byteStringPatternAny = (): ByteStringPattern => ({
  variant: "Any",
});

/**
 * Creates a ByteStringPattern that matches a specific byte string value.
 */
export const byteStringPatternValue = (
  value: Uint8Array,
): ByteStringPattern => ({
  variant: "Value",
  value,
});

/**
 * Creates a ByteStringPattern that matches byte strings by binary regex.
 *
 * Note: In TypeScript, this matches against the hex-encoded representation
 * of the bytes. For example, to match bytes starting with 0x00, use /^00/.
 */
export const byteStringPatternBinaryRegex = (
  pattern: RegExp,
): ByteStringPattern => ({
  variant: "BinaryRegex",
  pattern,
});

/**
 * Compares two Uint8Arrays for equality.
 */
const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
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
 * Tests if a CBOR value matches this byte string pattern.
 */
export const byteStringPatternMatches = (
  pattern: ByteStringPattern,
  haystack: Cbor,
): boolean => {
  const value = asBytes(haystack);
  if (value === undefined) {
    return false;
  }
  switch (pattern.variant) {
    case "Any":
      return true;
    case "Value":
      return bytesEqual(value, pattern.value);
    case "BinaryRegex": {
      // Convert bytes to hex string for regex matching
      // This is a known difference from Rust's regex::bytes::Regex
      const hexString = bytesToHex(value);
      return pattern.pattern.test(hexString);
    }
  }
};

/**
 * Returns paths to matching byte string values.
 */
export const byteStringPatternPaths = (
  pattern: ByteStringPattern,
  haystack: Cbor,
): Path[] => {
  if (byteStringPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a ByteStringPattern as a string.
 */
export const byteStringPatternDisplay = (
  pattern: ByteStringPattern,
): string => {
  switch (pattern.variant) {
    case "Any":
      return "bstr";
    case "Value":
      return `h'${bytesToHex(pattern.value)}'`;
    case "BinaryRegex":
      return `h'/${pattern.pattern.source}/'`;
  }
};

/**
 * Compares two ByteStringPatterns for equality.
 */
export const byteStringPatternEquals = (
  a: ByteStringPattern,
  b: ByteStringPattern,
): boolean => {
  if (a.variant !== b.variant) {
    return false;
  }
  switch (a.variant) {
    case "Any":
      return true;
    case "Value":
      return bytesEqual(a.value, (b as typeof a).value);
    case "BinaryRegex":
      return a.pattern.source === (b as typeof a).pattern.source;
  }
};
