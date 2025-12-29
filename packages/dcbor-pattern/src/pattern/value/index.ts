/**
 * Value patterns for dCBOR pattern matching.
 *
 * @module pattern/value
 */

export * from "./bool-pattern";
export * from "./null-pattern";
export * from "./number-pattern";
export * from "./text-pattern";
export * from "./bytestring-pattern";
export * from "./date-pattern";
export * from "./digest-pattern";
export * from "./known-value-pattern";

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";

import {
  type BoolPattern,
  boolPatternPaths,
  boolPatternDisplay,
} from "./bool-pattern";
import {
  type NullPattern,
  nullPatternPaths,
  nullPatternDisplay,
} from "./null-pattern";
import {
  type NumberPattern,
  numberPatternPaths,
  numberPatternDisplay,
} from "./number-pattern";
import {
  type TextPattern,
  textPatternPaths,
  textPatternDisplay,
} from "./text-pattern";
import {
  type ByteStringPattern,
  byteStringPatternPaths,
  byteStringPatternDisplay,
} from "./bytestring-pattern";
import {
  type DatePattern,
  datePatternPaths,
  datePatternDisplay,
} from "./date-pattern";
import {
  type DigestPattern,
  digestPatternPaths,
  digestPatternDisplay,
} from "./digest-pattern";
import {
  type KnownValuePattern,
  knownValuePatternPaths,
  knownValuePatternDisplay,
} from "./known-value-pattern";

/**
 * Union of all value pattern types.
 */
export type ValuePattern =
  | { readonly type: "Bool"; readonly pattern: BoolPattern }
  | { readonly type: "Null"; readonly pattern: NullPattern }
  | { readonly type: "Number"; readonly pattern: NumberPattern }
  | { readonly type: "Text"; readonly pattern: TextPattern }
  | { readonly type: "ByteString"; readonly pattern: ByteStringPattern }
  | { readonly type: "Date"; readonly pattern: DatePattern }
  | { readonly type: "Digest"; readonly pattern: DigestPattern }
  | { readonly type: "KnownValue"; readonly pattern: KnownValuePattern };

/**
 * Returns paths to matching values for a ValuePattern.
 */
export const valuePatternPaths = (
  pattern: ValuePattern,
  haystack: Cbor,
): Path[] => {
  switch (pattern.type) {
    case "Bool":
      return boolPatternPaths(pattern.pattern, haystack);
    case "Null":
      return nullPatternPaths(pattern.pattern, haystack);
    case "Number":
      return numberPatternPaths(pattern.pattern, haystack);
    case "Text":
      return textPatternPaths(pattern.pattern, haystack);
    case "ByteString":
      return byteStringPatternPaths(pattern.pattern, haystack);
    case "Date":
      return datePatternPaths(pattern.pattern, haystack);
    case "Digest":
      return digestPatternPaths(pattern.pattern, haystack);
    case "KnownValue":
      return knownValuePatternPaths(pattern.pattern, haystack);
  }
};

/**
 * Tests if a CBOR value matches a ValuePattern.
 */
export const valuePatternMatches = (
  pattern: ValuePattern,
  haystack: Cbor,
): boolean => {
  return valuePatternPaths(pattern, haystack).length > 0;
};

/**
 * Formats a ValuePattern as a string.
 */
export const valuePatternDisplay = (pattern: ValuePattern): string => {
  switch (pattern.type) {
    case "Bool":
      return boolPatternDisplay(pattern.pattern);
    case "Null":
      return nullPatternDisplay(pattern.pattern);
    case "Number":
      return numberPatternDisplay(pattern.pattern);
    case "Text":
      return textPatternDisplay(pattern.pattern);
    case "ByteString":
      return byteStringPatternDisplay(pattern.pattern);
    case "Date":
      return datePatternDisplay(pattern.pattern);
    case "Digest":
      return digestPatternDisplay(pattern.pattern);
    case "KnownValue":
      return knownValuePatternDisplay(pattern.pattern);
  }
};

// Convenience constructors for ValuePattern

/**
 * Creates a Bool ValuePattern.
 */
export const valueBool = (pattern: BoolPattern): ValuePattern => ({
  type: "Bool",
  pattern,
});

/**
 * Creates a Null ValuePattern.
 */
export const valueNull = (pattern: NullPattern): ValuePattern => ({
  type: "Null",
  pattern,
});

/**
 * Creates a Number ValuePattern.
 */
export const valueNumber = (pattern: NumberPattern): ValuePattern => ({
  type: "Number",
  pattern,
});

/**
 * Creates a Text ValuePattern.
 */
export const valueText = (pattern: TextPattern): ValuePattern => ({
  type: "Text",
  pattern,
});

/**
 * Creates a ByteString ValuePattern.
 */
export const valueByteString = (pattern: ByteStringPattern): ValuePattern => ({
  type: "ByteString",
  pattern,
});

/**
 * Creates a Date ValuePattern.
 */
export const valueDate = (pattern: DatePattern): ValuePattern => ({
  type: "Date",
  pattern,
});

/**
 * Creates a Digest ValuePattern.
 */
export const valueDigest = (pattern: DigestPattern): ValuePattern => ({
  type: "Digest",
  pattern,
});

/**
 * Creates a KnownValue ValuePattern.
 */
export const valueKnownValue = (pattern: KnownValuePattern): ValuePattern => ({
  type: "KnownValue",
  pattern,
});
