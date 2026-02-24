/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Capture pattern for dCBOR pattern matching.
 * Captures matched values with a name.
 *
 * @module pattern/meta/capture-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { matchPattern } from "../match-registry";

/**
 * A pattern that captures matched values with a name.
 */
export interface CapturePattern {
  readonly variant: "Capture";
  readonly name: string;
  readonly pattern: Pattern;
}

/**
 * Creates a CapturePattern with the given name and inner pattern.
 */
export const capturePattern = (name: string, pattern: Pattern): CapturePattern => ({
  variant: "Capture",
  name,
  pattern,
});

/**
 * Tests if a CBOR value matches this capture pattern.
 * Capture itself doesn't affect matching - it delegates to inner pattern.
 */
export const capturePatternMatches = (pattern: CapturePattern, haystack: Cbor): boolean => {
  return matchPattern(pattern.pattern, haystack);
};

/**
 * Returns paths to matching values.
 */
export const capturePatternPaths = (pattern: CapturePattern, haystack: Cbor): Path[] => {
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
