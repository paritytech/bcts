/**
 * Or pattern for dCBOR pattern matching.
 * Matches if any contained pattern matches.
 *
 * @module pattern/meta/or-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

/**
 * A pattern that matches if any contained pattern matches.
 */
export type OrPattern = {
  readonly variant: "Or";
  readonly patterns: Pattern[];
};

/**
 * Creates an OrPattern with the given patterns.
 */
export const orPattern = (patterns: Pattern[]): OrPattern => ({
  variant: "Or",
  patterns,
});

// Forward declaration
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this or pattern.
 * At least one pattern must match.
 */
export const orPatternMatches = (
  pattern: OrPattern,
  haystack: Cbor,
): boolean => {
  return pattern.patterns.some((p) => patternMatches(p, haystack));
};

/**
 * Returns paths to matching values.
 */
export const orPatternPaths = (pattern: OrPattern, haystack: Cbor): Path[] => {
  if (orPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats an OrPattern as a string.
 */
export const orPatternDisplay = (
  pattern: OrPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  const parts = pattern.patterns.map(patternDisplay);
  return `(${parts.join(" | ")})`;
};
