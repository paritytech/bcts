/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Or pattern for dCBOR pattern matching.
 * Matches if any contained pattern matches.
 *
 * @module pattern/meta/or-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { matchPattern } from "../match-registry";

/**
 * A pattern that matches if any contained pattern matches.
 */
export interface OrPattern {
  readonly variant: "Or";
  readonly patterns: Pattern[];
}

/**
 * Creates an OrPattern with the given patterns.
 */
export const orPattern = (patterns: Pattern[]): OrPattern => ({
  variant: "Or",
  patterns,
});

/**
 * Tests if a CBOR value matches this or pattern.
 * At least one pattern must match.
 */
export const orPatternMatches = (pattern: OrPattern, haystack: Cbor): boolean => {
  return pattern.patterns.some((p: Pattern) => matchPattern(p, haystack));
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
  return parts.join(" | ");
};
