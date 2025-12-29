/**
 * Sequence pattern for dCBOR pattern matching.
 * Matches a sequence of patterns in order.
 *
 * @module pattern/meta/sequence-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

/**
 * A pattern that matches a sequence of patterns in order.
 * Used primarily for matching array elements.
 */
export type SequencePattern = {
  readonly variant: "Sequence";
  readonly patterns: Pattern[];
};

/**
 * Creates a SequencePattern with the given patterns.
 */
export const sequencePattern = (patterns: Pattern[]): SequencePattern => ({
  variant: "Sequence",
  patterns,
});

// Forward declaration
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this sequence pattern.
 * Note: Sequences are meant for array element matching.
 * Simple case: check if haystack matches all patterns (for single values).
 */
export const sequencePatternMatches = (
  pattern: SequencePattern,
  haystack: Cbor,
): boolean => {
  // For single CBOR values, all patterns must match
  // This is a simplified implementation - full sequence matching
  // for arrays is done in ArrayPattern
  return pattern.patterns.every((p) => patternMatches(p, haystack));
};

/**
 * Returns paths to matching values.
 */
export const sequencePatternPaths = (
  pattern: SequencePattern,
  haystack: Cbor,
): Path[] => {
  if (sequencePatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a SequencePattern as a string.
 */
export const sequencePatternDisplay = (
  pattern: SequencePattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  const parts = pattern.patterns.map(patternDisplay);
  return parts.join(", ");
};

/**
 * Gets the patterns in this sequence.
 */
export const sequencePatternPatterns = (
  pattern: SequencePattern,
): Pattern[] => {
  return pattern.patterns;
};
