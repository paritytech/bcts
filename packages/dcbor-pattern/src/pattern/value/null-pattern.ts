/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Null pattern for dCBOR pattern matching.
 *
 * @module pattern/value/null-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { isNull } from "@bcts/dcbor";
import type { Path } from "../../format";

/**
 * Pattern for matching null values in dCBOR.
 * This is a unit type - there's only one way to match null.
 */
export interface NullPattern {
  readonly variant: "Null";
}

/**
 * Creates a NullPattern.
 */
export const nullPattern = (): NullPattern => ({ variant: "Null" });

/**
 * Tests if a CBOR value matches the null pattern.
 */
export const nullPatternMatches = (_pattern: NullPattern, haystack: Cbor): boolean => {
  return isNull(haystack);
};

/**
 * Returns paths to matching null values.
 */
export const nullPatternPaths = (pattern: NullPattern, haystack: Cbor): Path[] => {
  if (nullPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a NullPattern as a string.
 */
export const nullPatternDisplay = (_pattern: NullPattern): string => {
  return "null";
};
