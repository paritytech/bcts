/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Repeat pattern for dCBOR pattern matching.
 * Matches with repetition based on a quantifier.
 *
 * @module pattern/meta/repeat-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { Quantifier } from "../../quantifier";

/**
 * A pattern that matches with repetition.
 */
export interface RepeatPattern {
  readonly variant: "Repeat";
  readonly pattern: Pattern;
  readonly quantifier: Quantifier;
}

/**
 * Creates a RepeatPattern with the given pattern and quantifier.
 */
export const repeatPattern = (pattern: Pattern, quantifier: Quantifier): RepeatPattern => ({
  variant: "Repeat",
  pattern,
  quantifier,
});

/**
 * Creates a RepeatPattern that matches zero or more times (greedy).
 */
export const repeatZeroOrMore = (pattern: Pattern): RepeatPattern => ({
  variant: "Repeat",
  pattern,
  quantifier: Quantifier.zeroOrMore(),
});

/**
 * Creates a RepeatPattern that matches one or more times (greedy).
 */
export const repeatOneOrMore = (pattern: Pattern): RepeatPattern => ({
  variant: "Repeat",
  pattern,
  quantifier: Quantifier.oneOrMore(),
});

/**
 * Creates a RepeatPattern that matches zero or one time (greedy).
 */
export const repeatOptional = (pattern: Pattern): RepeatPattern => ({
  variant: "Repeat",
  pattern,
  quantifier: Quantifier.zeroOrOne(),
});

/**
 * Creates a RepeatPattern that matches exactly n times.
 */
export const repeatExact = (pattern: Pattern, n: number): RepeatPattern => ({
  variant: "Repeat",
  pattern,
  quantifier: Quantifier.exactly(n),
});

/**
 * Creates a RepeatPattern that matches between min and max times.
 */
export const repeatRange = (pattern: Pattern, min: number, max?: number): RepeatPattern => ({
  variant: "Repeat",
  pattern,
  quantifier: max !== undefined ? Quantifier.between(min, max) : Quantifier.atLeast(min),
});

import { matchPattern } from "../match-registry";

/**
 * Tests if a CBOR value matches this repeat pattern.
 * Note: This is a simplified implementation. Complex matching
 * will be implemented with the VM.
 */
export const repeatPatternMatches = (pattern: RepeatPattern, haystack: Cbor): boolean => {
  // Simple case: check if the inner pattern matches at least once
  // and the quantifier allows it
  const innerMatches = matchPattern(pattern.pattern, haystack);
  const min = pattern.quantifier.min();
  const max = pattern.quantifier.max();

  if (innerMatches) {
    // If pattern matches once, check if 1 is in valid range
    return min <= 1 && (max === undefined || max >= 1);
  }
  // If pattern doesn't match, only valid if min is 0
  return min === 0;
};

/**
 * Returns paths to matching values.
 */
export const repeatPatternPaths = (pattern: RepeatPattern, haystack: Cbor): Path[] => {
  if (repeatPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a RepeatPattern as a string.
 * Always wraps the inner pattern in parentheses to match Rust behavior.
 */
export const repeatPatternDisplay = (
  pattern: RepeatPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  return `(${patternDisplay(pattern.pattern)})${pattern.quantifier.toString()}`;
};
