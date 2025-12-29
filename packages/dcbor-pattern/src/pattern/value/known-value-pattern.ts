/**
 * KnownValue pattern for dCBOR pattern matching.
 *
 * @module pattern/value/known-value-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { tagValue, isTagged, tagContent, asUnsigned } from "@bcts/dcbor";
import { KnownValue, KNOWN_VALUE_TAG } from "@bcts/known-values";
import type { Path } from "../../format";

/**
 * Pattern for matching known values in dCBOR.
 * Known values are represented as tagged values with tag 40000.
 */
export type KnownValuePattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: KnownValue }
  | { readonly variant: "Named"; readonly name: string }
  | { readonly variant: "Regex"; readonly pattern: RegExp };

/**
 * Creates a KnownValuePattern that matches any known value.
 */
export const knownValuePatternAny = (): KnownValuePattern => ({
  variant: "Any",
});

/**
 * Creates a KnownValuePattern that matches a specific known value.
 */
export const knownValuePatternValue = (
  value: KnownValue,
): KnownValuePattern => ({
  variant: "Value",
  value,
});

/**
 * Creates a KnownValuePattern that matches a known value by name.
 */
export const knownValuePatternNamed = (name: string): KnownValuePattern => ({
  variant: "Named",
  name,
});

/**
 * Creates a KnownValuePattern that matches known values by regex on name.
 */
export const knownValuePatternRegex = (pattern: RegExp): KnownValuePattern => ({
  variant: "Regex",
  pattern,
});

/**
 * Extracts a KnownValue from a tagged CBOR value if it's a known value (tag 40000).
 */
const extractKnownValue = (haystack: Cbor): KnownValue | undefined => {
  if (!isTagged(haystack)) {
    return undefined;
  }
  const tag = tagValue(haystack);
  if (tag !== KNOWN_VALUE_TAG.value) {
    return undefined;
  }
  const content = tagContent(haystack);
  if (content === undefined) {
    return undefined;
  }
  const value = asUnsigned(content);
  if (value === undefined) {
    return undefined;
  }
  return new KnownValue(value);
};

/**
 * Tests if a CBOR value matches this known value pattern.
 */
export const knownValuePatternMatches = (
  pattern: KnownValuePattern,
  haystack: Cbor,
): boolean => {
  const knownValue = extractKnownValue(haystack);
  if (knownValue === undefined) {
    return false;
  }

  switch (pattern.variant) {
    case "Any":
      return true;
    case "Value":
      return knownValue.valueBigInt() === pattern.value.valueBigInt();
    case "Named": {
      // Look up the known value by name and compare
      // KnownValue has a name method that we can compare
      return knownValue.name() === pattern.name;
    }
    case "Regex":
      return pattern.pattern.test(knownValue.name());
  }
};

/**
 * Returns paths to matching known values.
 */
export const knownValuePatternPaths = (
  pattern: KnownValuePattern,
  haystack: Cbor,
): Path[] => {
  if (knownValuePatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a KnownValuePattern as a string.
 */
export const knownValuePatternDisplay = (
  pattern: KnownValuePattern,
): string => {
  switch (pattern.variant) {
    case "Any":
      return "known";
    case "Value":
      return `'${pattern.value.name()}'`;
    case "Named":
      return `'${pattern.name}'`;
    case "Regex":
      return `'/${pattern.pattern.source}/'`;
  }
};

/**
 * Compares two KnownValuePatterns for equality.
 */
export const knownValuePatternEquals = (
  a: KnownValuePattern,
  b: KnownValuePattern,
): boolean => {
  if (a.variant !== b.variant) {
    return false;
  }
  switch (a.variant) {
    case "Any":
      return true;
    case "Value":
      return a.value.valueBigInt() === (b as typeof a).value.valueBigInt();
    case "Named":
      return a.name === (b as typeof a).name;
    case "Regex":
      return a.pattern.source === (b as typeof a).pattern.source;
  }
};
