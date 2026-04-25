/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Digest pattern for dCBOR pattern matching.
 *
 * @module pattern/value/digest-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { tagValue, isTagged, tagContent, asBytes, bytesToHex } from "@bcts/dcbor";
import type { Digest } from "@bcts/components";
import type { Path } from "../../format";
import { bytesEqual, bytesStartsWith, bytesToLatin1 } from "./bytes-utils";

/**
 * Pattern for matching digest values in dCBOR.
 * Digests are represented as tagged values with tag 40001.
 *
 * Note on `BinaryRegex`: this variant matches the regex against a
 * **Latin-1** decoding of the digest bytes (each byte becomes the
 * char-code-equal Unicode code unit). Mirrors the
 * `ByteStringPattern.BinaryRegex` strategy and Rust's
 * `regex::bytes::Regex` semantics for byte-level patterns expressed as
 * `\xNN` escapes. Earlier this port matched against the hex-encoded
 * digest, which silently rejected `/^\xff/`-style byte patterns and
 * was inconsistent with `ByteStringPattern`.
 */
export type DigestPattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: Digest }
  | { readonly variant: "Prefix"; readonly prefix: Uint8Array }
  | { readonly variant: "BinaryRegex"; readonly pattern: RegExp };

/** CBOR tag for digest (BCR-2021-002) */
const DIGEST_TAG = 40001;

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
 * Note: matches against a Latin-1 decoding of the digest bytes (matching
 * Rust's `regex::bytes::Regex`-on-`Vec<u8>` semantics for byte-level
 * patterns). Use `\xNN` escapes for individual bytes.
 */
export const digestPatternBinaryRegex = (pattern: RegExp): DigestPattern => ({
  variant: "BinaryRegex",
  pattern,
});

/**
 * Extracts digest bytes from a tagged CBOR value if it's a digest (tag 40001).
 */
const extractDigestBytes = (haystack: Cbor): Uint8Array | undefined => {
  if (!isTagged(haystack)) {
    return undefined;
  }
  const tag = tagValue(haystack);
  // Compare with Number() to handle both number and bigint types
  if (tag === undefined || Number(tag) !== DIGEST_TAG) {
    return undefined;
  }
  const content = tagContent(haystack);
  if (content === undefined) {
    return undefined;
  }
  const bytes = asBytes(content);
  if (bytes?.length !== DIGEST_SIZE) {
    return undefined;
  }
  return bytes;
};

/**
 * Tests if a CBOR value matches this digest pattern.
 */
export const digestPatternMatches = (pattern: DigestPattern, haystack: Cbor): boolean => {
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
      // Latin-1 decode mirrors Rust's `regex::bytes::Regex.is_match`
      // against `&[u8]` for byte-level patterns. Each byte becomes the
      // identically-numbered Unicode code unit, so `\xNN` escapes in
      // the regex source compare correctly. Earlier this port hex-
      // encoded the digest bytes here, which was inconsistent with
      // `ByteStringPattern.BinaryRegex` and silently broke
      // byte-pattern parity.
      const latin1 = bytesToLatin1(digestBytes);
      return pattern.pattern.test(latin1);
    }
  }
};

/**
 * Returns paths to matching digest values.
 */
export const digestPatternPaths = (pattern: DigestPattern, haystack: Cbor): Path[] => {
  if (digestPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a DigestPattern as a string.
 *
 * Mirrors Rust `Display for DigestPattern`
 * (`bc-dcbor-pattern-rust/src/pattern/value/digest_pattern.rs`):
 *
 * - `Any`        → `digest`
 * - `Value(d)`   → `digest'{ur:digest/...}'` (UR string of the digest)
 * - `Prefix(b)`  → `digest'{hex}'`
 * - `BinaryRegex` → `digest'/{regex}/'`
 *
 * Earlier this port emitted the raw hex of the full digest for the
 * `Value` variant. Rust's parser would re-parse that as a `Prefix`
 * (since hex with even length ≤ 64 chars is treated as prefix), so the
 * formatter break silently changed pattern semantics during round-trip.
 */
export const digestPatternDisplay = (pattern: DigestPattern): string => {
  switch (pattern.variant) {
    case "Any":
      return "digest";
    case "Value":
      // UR string preserves the full 32-byte digest unambiguously.
      return `digest'${pattern.value.urString()}'`;
    case "Prefix":
      return `digest'${bytesToHex(pattern.prefix)}'`;
    case "BinaryRegex":
      return `digest'/${pattern.pattern.source}/'`;
  }
};
