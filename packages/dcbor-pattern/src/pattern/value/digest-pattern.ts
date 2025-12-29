/**
 * Digest pattern for dCBOR pattern matching.
 *
 * @module pattern/value/digest-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { tagValue, isTagged, tagContent, asBytes, bytesToHex } from "@bcts/dcbor";
import type { Digest } from "@bcts/components";
import type { Path } from "../../format";

/**
 * Pattern for matching digest values in dCBOR.
 * Digests are represented as tagged values with tag 40001.
 *
 * Note: The BinaryRegex variant uses a RegExp that matches against the
 * hex-encoded string representation of the digest bytes. This is a known
 * difference from the Rust implementation which uses regex::bytes::Regex.
 */
export type DigestPattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: Digest }
  | { readonly variant: "Prefix"; readonly prefix: Uint8Array }
  | { readonly variant: "BinaryRegex"; readonly pattern: RegExp };

/** CBOR tag for digest (BCR-2021-002) */
const DIGEST_TAG = 40001n;

/** Expected size of a SHA-256 digest */
const DIGEST_SIZE = 32;

/**
 * Creates a DigestPattern that matches any digest.
 */
export const digestPatternAny = (): DigestPattern => ({ variant: "Any" });

/**
 * Creates a DigestPattern that matches a specific digest.
 */
export const digestPatternValue = (value: Digest): DigestPattern => ({
  variant: "Value",
  value,
});

/**
 * Creates a DigestPattern that matches digests with a prefix.
 */
export const digestPatternPrefix = (prefix: Uint8Array): DigestPattern => ({
  variant: "Prefix",
  prefix,
});

/**
 * Creates a DigestPattern that matches digests by binary regex.
 *
 * Note: In TypeScript, this matches against the hex-encoded representation
 * of the digest bytes.
 */
export const digestPatternBinaryRegex = (pattern: RegExp): DigestPattern => ({
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
 * Tests if bytes start with a prefix.
 */
const bytesStartsWith = (bytes: Uint8Array, prefix: Uint8Array): boolean => {
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
 * Extracts digest bytes from a tagged CBOR value if it's a digest (tag 40001).
 */
const extractDigestBytes = (haystack: Cbor): Uint8Array | undefined => {
  if (!isTagged(haystack)) {
    return undefined;
  }
  const tag = tagValue(haystack);
  if (tag !== DIGEST_TAG) {
    return undefined;
  }
  const content = tagContent(haystack);
  if (content === undefined) {
    return undefined;
  }
  const bytes = asBytes(content);
  if (bytes === undefined || bytes.length !== DIGEST_SIZE) {
    return undefined;
  }
  return bytes;
};

/**
 * Tests if a CBOR value matches this digest pattern.
 */
export const digestPatternMatches = (
  pattern: DigestPattern,
  haystack: Cbor,
): boolean => {
  const digestBytes = extractDigestBytes(haystack);
  if (digestBytes === undefined) {
    return false;
  }

  switch (pattern.variant) {
    case "Any":
      return true;
    case "Value":
      return bytesEqual(digestBytes, pattern.value.data());
    case "Prefix":
      return bytesStartsWith(digestBytes, pattern.prefix);
    case "BinaryRegex": {
      // Convert bytes to hex string for regex matching
      const hexString = bytesToHex(digestBytes);
      return pattern.pattern.test(hexString);
    }
  }
};

/**
 * Returns paths to matching digest values.
 */
export const digestPatternPaths = (
  pattern: DigestPattern,
  haystack: Cbor,
): Path[] => {
  if (digestPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a DigestPattern as a string.
 */
export const digestPatternDisplay = (pattern: DigestPattern): string => {
  switch (pattern.variant) {
    case "Any":
      return "digest";
    case "Value":
      // Use UR string if available, otherwise hex
      return `digest'${bytesToHex(pattern.value.data())}'`;
    case "Prefix":
      return `digest'${bytesToHex(pattern.prefix)}'`;
    case "BinaryRegex":
      return `digest'/${pattern.pattern.source}/'`;
  }
};

/**
 * Compares two DigestPatterns for equality.
 */
export const digestPatternEquals = (
  a: DigestPattern,
  b: DigestPattern,
): boolean => {
  if (a.variant !== b.variant) {
    return false;
  }
  switch (a.variant) {
    case "Any":
      return true;
    case "Value":
      return bytesEqual(a.value.data(), (b as typeof a).value.data());
    case "Prefix":
      return bytesEqual(a.prefix, (b as typeof a).prefix);
    case "BinaryRegex":
      return a.pattern.source === (b as typeof a).pattern.source;
  }
};
