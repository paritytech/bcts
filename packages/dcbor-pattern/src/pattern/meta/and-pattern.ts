/**
 * And pattern for dCBOR pattern matching.
 * Matches if all contained patterns match.
 *
 * @module pattern/meta/and-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

/**
 * A pattern that matches if all contained patterns match.
 */
export type AndPattern = {
  readonly variant: "And";
  readonly patterns: Pattern[];
};

/**
 * Creates an AndPattern with the given patterns.
 */
export const andPattern = (patterns: Pattern[]): AndPattern => ({
  variant: "And",
  patterns,
});

// Forward declaration
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this and pattern.
 * All patterns must match.
 */
export const andPatternMatches = (
  pattern: AndPattern,
  haystack: Cbor,
): boolean => {
  return pattern.patterns.every((p) => patternMatches(p, haystack));
};

/**
 * Returns paths to matching values.
 */
export const andPatternPaths = (
  pattern: AndPattern,
  haystack: Cbor,
): Path[] => {
  if (andPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats an AndPattern as a string.
 */
export const andPatternDisplay = (
  pattern: AndPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  const parts = pattern.patterns.map(patternDisplay);
  return `(${parts.join(" & ")})`;
};
