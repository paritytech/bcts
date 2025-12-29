/**
 * Boolean pattern for dCBOR pattern matching.
 *
 * @module pattern/value/bool-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { asBoolean } from "@bcts/dcbor";
import type { Path } from "../../format";

/**
 * Pattern for matching boolean values in dCBOR.
 */
export type BoolPattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: boolean };

/**
 * Creates a BoolPattern that matches any boolean value.
 */
export const boolPatternAny = (): BoolPattern => ({ variant: "Any" });

/**
 * Creates a BoolPattern that matches a specific boolean value.
 */
export const boolPatternValue = (value: boolean): BoolPattern => ({
  variant: "Value",
  value,
});

/**
 * Tests if a CBOR value matches this boolean pattern.
 */
export const boolPatternMatches = (pattern: BoolPattern, haystack: Cbor): boolean => {
  const value = asBoolean(haystack);
  if (value === undefined) {
    return false;
  }
  switch (pattern.variant) {
    case "Any":
      return true;
    case "Value":
      return value === pattern.value;
  }
};

/**
 * Returns paths to matching boolean values.
 */
export const boolPatternPaths = (pattern: BoolPattern, haystack: Cbor): Path[] => {
  if (boolPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a BoolPattern as a string.
 */
export const boolPatternDisplay = (pattern: BoolPattern): string => {
  switch (pattern.variant) {
    case "Any":
      return "bool";
    case "Value":
      return pattern.value ? "true" : "false";
  }
};
