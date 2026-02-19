/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Not pattern for dCBOR pattern matching.
 * Matches if the inner pattern does NOT match.
 *
 * @module pattern/meta/not-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { matchPattern } from "../match-registry";

/**
 * A pattern that matches if the inner pattern does NOT match.
 */
export interface NotPattern {
  readonly variant: "Not";
  readonly pattern: Pattern;
}

/**
 * Creates a NotPattern with the given inner pattern.
 */
export const notPattern = (pattern: Pattern): NotPattern => ({
  variant: "Not",
  pattern,
});

/**
 * Tests if a CBOR value matches this not pattern.
 * Returns true if the inner pattern does NOT match.
 */
export const notPatternMatches = (pattern: NotPattern, haystack: Cbor): boolean => {
  return !matchPattern(pattern.pattern, haystack);
};

/**
 * Returns paths to matching values.
 */
export const notPatternPaths = (pattern: NotPattern, haystack: Cbor): Path[] => {
  if (notPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Check if a pattern is complex for display purposes.
 * Complex patterns need parentheses when inside a NOT pattern.
 */
const isComplex = (pattern: Pattern): boolean => {
  if (pattern.kind === "Meta") {
    // AND, OR, NOT, Sequence are complex
    return ["And", "Or", "Not", "Sequence"].includes(pattern.pattern.type);
  }
  return false;
};

/**
 * Formats a NotPattern as a string.
 */
export const notPatternDisplay = (
  pattern: NotPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  if (isComplex(pattern.pattern)) {
    return `!(${patternDisplay(pattern.pattern)})`;
  }
  return `!${patternDisplay(pattern.pattern)}`;
};
