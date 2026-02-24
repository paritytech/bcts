/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Number pattern for dCBOR pattern matching.
 *
 * @module pattern/value/number-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { asNumber, isNumber } from "@bcts/dcbor";
import type { Path } from "../../format";

/**
 * Pattern for matching number values in dCBOR.
 */
export type NumberPattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: number }
  | { readonly variant: "Range"; readonly min: number; readonly max: number }
  | { readonly variant: "GreaterThan"; readonly value: number }
  | { readonly variant: "GreaterThanOrEqual"; readonly value: number }
  | { readonly variant: "LessThan"; readonly value: number }
  | { readonly variant: "LessThanOrEqual"; readonly value: number }
  | { readonly variant: "NaN" }
  | { readonly variant: "Infinity" }
  | { readonly variant: "NegInfinity" };

/**
 * Creates a NumberPattern that matches any number.
 */
export const numberPatternAny = (): NumberPattern => ({ variant: "Any" });

/**
 * Creates a NumberPattern that matches a specific number.
 */
export const numberPatternValue = (value: number): NumberPattern => ({
  variant: "Value",
  value,
});

/**
 * Creates a NumberPattern that matches numbers within a range (inclusive).
 */
export const numberPatternRange = (min: number, max: number): NumberPattern => ({
  variant: "Range",
  min,
  max,
});

/**
 * Creates a NumberPattern that matches numbers greater than a value.
 */
export const numberPatternGreaterThan = (value: number): NumberPattern => ({
  variant: "GreaterThan",
  value,
});

/**
 * Creates a NumberPattern that matches numbers greater than or equal to a value.
 */
export const numberPatternGreaterThanOrEqual = (value: number): NumberPattern => ({
  variant: "GreaterThanOrEqual",
  value,
});

/**
 * Creates a NumberPattern that matches numbers less than a value.
 */
export const numberPatternLessThan = (value: number): NumberPattern => ({
  variant: "LessThan",
  value,
});

/**
 * Creates a NumberPattern that matches numbers less than or equal to a value.
 */
export const numberPatternLessThanOrEqual = (value: number): NumberPattern => ({
  variant: "LessThanOrEqual",
  value,
});

/**
 * Creates a NumberPattern that matches NaN.
 */
export const numberPatternNaN = (): NumberPattern => ({ variant: "NaN" });

/**
 * Creates a NumberPattern that matches positive infinity.
 */
export const numberPatternInfinity = (): NumberPattern => ({
  variant: "Infinity",
});

/**
 * Creates a NumberPattern that matches negative infinity.
 */
export const numberPatternNegInfinity = (): NumberPattern => ({
  variant: "NegInfinity",
});

/**
 * Tests if a CBOR value matches this number pattern.
 */
export const numberPatternMatches = (pattern: NumberPattern, haystack: Cbor): boolean => {
  switch (pattern.variant) {
    case "Any":
      return isNumber(haystack);
    case "Value": {
      const value = asNumber(haystack);
      return value !== undefined && value === pattern.value;
    }
    case "Range": {
      const value = asNumber(haystack);
      return value !== undefined && value >= pattern.min && value <= pattern.max;
    }
    case "GreaterThan": {
      const value = asNumber(haystack);
      return value !== undefined && value > pattern.value;
    }
    case "GreaterThanOrEqual": {
      const value = asNumber(haystack);
      return value !== undefined && value >= pattern.value;
    }
    case "LessThan": {
      const value = asNumber(haystack);
      return value !== undefined && value < pattern.value;
    }
    case "LessThanOrEqual": {
      const value = asNumber(haystack);
      return value !== undefined && value <= pattern.value;
    }
    case "NaN": {
      const value = asNumber(haystack);
      return value !== undefined && Number.isNaN(value);
    }
    case "Infinity": {
      const value = asNumber(haystack);
      return value !== undefined && value === Number.POSITIVE_INFINITY;
    }
    case "NegInfinity": {
      const value = asNumber(haystack);
      return value !== undefined && value === Number.NEGATIVE_INFINITY;
    }
  }
};

/**
 * Returns paths to matching number values.
 */
export const numberPatternPaths = (pattern: NumberPattern, haystack: Cbor): Path[] => {
  if (numberPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a NumberPattern as a string.
 */
export const numberPatternDisplay = (pattern: NumberPattern): string => {
  switch (pattern.variant) {
    case "Any":
      return "number";
    case "Value":
      return String(pattern.value);
    case "Range":
      return `${pattern.min}..${pattern.max}`;
    case "GreaterThan":
      return `>${pattern.value}`;
    case "GreaterThanOrEqual":
      return `>=${pattern.value}`;
    case "LessThan":
      return `<${pattern.value}`;
    case "LessThanOrEqual":
      return `<=${pattern.value}`;
    case "NaN":
      return "NaN";
    case "Infinity":
      return "Infinity";
    case "NegInfinity":
      return "-Infinity";
  }
};
