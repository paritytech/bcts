/**
 * Capture pattern for dCBOR pattern matching.
 * Captures matched values with a name.
 *
 * @module pattern/meta/capture-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

/**
 * A pattern that captures matched values with a name.
 */
export type CapturePattern = {
  readonly variant: "Capture";
  readonly name: string;
  readonly pattern: Pattern;
};

/**
 * Creates a CapturePattern with the given name and inner pattern.
 */
export const capturePattern = (
  name: string,
  pattern: Pattern,
): CapturePattern => ({
  variant: "Capture",
  name,
  pattern,
});

// Forward declaration
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this capture pattern.
 * Capture itself doesn't affect matching - it delegates to inner pattern.
 */
export const capturePatternMatches = (
  pattern: CapturePattern,
  haystack: Cbor,
): boolean => {
  return patternMatches(pattern.pattern, haystack);
};

/**
 * Returns paths to matching values.
 */
export const capturePatternPaths = (
  pattern: CapturePattern,
  haystack: Cbor,
): Path[] => {
  if (capturePatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a CapturePattern as a string.
 */
export const capturePatternDisplay = (
  pattern: CapturePattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  return `@${pattern.name}(${patternDisplay(pattern.pattern)})`;
};

/**
 * Collects capture names from this pattern.
 */
export const capturePatternCollectNames = (
  pattern: CapturePattern,
  names: string[],
): void => {
  names.push(pattern.name);
  // Note: Nested captures in pattern.pattern should also be collected
  // This will be done when implementing the full Pattern type
};
