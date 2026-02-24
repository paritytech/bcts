/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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
export interface SequencePattern {
  readonly variant: "Sequence";
  readonly patterns: Pattern[];
}

/**
 * Creates a SequencePattern with the given patterns.
 */
export const sequencePattern = (patterns: Pattern[]): SequencePattern => ({
  variant: "Sequence",
  patterns,
});

/**
 * Tests if a CBOR value matches this sequence pattern.
 *
 * Note: Sequence patterns are used within array patterns for matching
 * consecutive elements. When used standalone (not within an array),
 * they return false/empty as the actual sequence matching logic is
 * handled by the VM and array pattern matching.
 */
export const sequencePatternMatches = (_pattern: SequencePattern, _haystack: Cbor): boolean => {
  // Sequence patterns are meant for array element matching.
  // When used standalone, they don't match any single CBOR value.
  // The VM handles actual sequence matching within arrays.
  return false;
};

/**
 * Returns paths to matching values.
 *
 * Note: Sequence patterns return empty paths when used directly.
 * The actual sequence matching is handled by the VM within array contexts.
 */
export const sequencePatternPaths = (_pattern: SequencePattern, _haystack: Cbor): Path[] => {
  // Sequence patterns return empty paths when used directly.
  // This matches Rust behavior where sequence matching is VM-based.
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
export const sequencePatternPatterns = (pattern: SequencePattern): Pattern[] => {
  return pattern.patterns;
};
