/**
 * Not pattern for dCBOR pattern matching.
 * Matches if the inner pattern does NOT match.
 *
 * @module pattern/meta/not-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

/**
 * A pattern that matches if the inner pattern does NOT match.
 */
export type NotPattern = {
  readonly variant: "Not";
  readonly pattern: Pattern;
};

/**
 * Creates a NotPattern with the given inner pattern.
 */
export const notPattern = (pattern: Pattern): NotPattern => ({
  variant: "Not",
  pattern,
});

// Forward declaration
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this not pattern.
 * Returns true if the inner pattern does NOT match.
 */
export const notPatternMatches = (
  pattern: NotPattern,
  haystack: Cbor,
): boolean => {
  return !patternMatches(pattern.pattern, haystack);
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
 * Formats a NotPattern as a string.
 */
export const notPatternDisplay = (
  pattern: NotPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  return `!${patternDisplay(pattern.pattern)}`;
};
