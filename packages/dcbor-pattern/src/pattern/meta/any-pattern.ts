/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Any pattern for dCBOR pattern matching.
 * Always matches any CBOR value.
 *
 * @module pattern/meta/any-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";

/**
 * A pattern that always matches any CBOR value.
 */
export interface AnyPattern {
  readonly variant: "Any";
}

/**
 * Creates an AnyPattern.
 */
export const anyPattern = (): AnyPattern => ({ variant: "Any" });

/**
 * Tests if a CBOR value matches this any pattern.
 * Always returns true.
 */
export const anyPatternMatches = (_pattern: AnyPattern, _haystack: Cbor): boolean => {
  return true;
};

/**
 * Returns paths to matching values.
 */
export const anyPatternPaths = (_pattern: AnyPattern, haystack: Cbor): Path[] => {
  return [[haystack]];
};

/**
 * Formats an AnyPattern as a string.
 */
export const anyPatternDisplay = (_pattern: AnyPattern): string => {
  return "*";
};
