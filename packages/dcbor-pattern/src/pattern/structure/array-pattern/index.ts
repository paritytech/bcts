/**
 * Array pattern for dCBOR pattern matching.
 *
 * @module pattern/structure/array-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { isArray, arrayLength, arrayItem } from "@bcts/dcbor";
import type { Path } from "../../../format";
import type { Pattern } from "../../index";
import { Interval } from "../../../interval";

/**
 * Pattern for matching CBOR array structures.
 */
export type ArrayPattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Elements"; readonly pattern: Pattern }
  | { readonly variant: "Length"; readonly length: Interval };

/**
 * Creates an ArrayPattern that matches any array.
 */
export const arrayPatternAny = (): ArrayPattern => ({ variant: "Any" });

/**
 * Creates an ArrayPattern that matches arrays with elements matching the pattern.
 */
export const arrayPatternWithElements = (pattern: Pattern): ArrayPattern => ({
  variant: "Elements",
  pattern,
});

/**
 * Creates an ArrayPattern that matches arrays with a specific length.
 */
export const arrayPatternWithLength = (length: number): ArrayPattern => ({
  variant: "Length",
  length: Interval.exactly(length),
});

/**
 * Creates an ArrayPattern that matches arrays with length in a range.
 */
export const arrayPatternWithLengthRange = (
  min: number,
  max?: number,
): ArrayPattern => ({
  variant: "Length",
  length: max !== undefined ? Interval.from(min, max) : Interval.atLeast(min),
});

/**
 * Creates an ArrayPattern that matches arrays with length in an interval.
 */
export const arrayPatternWithLengthInterval = (
  interval: Interval,
): ArrayPattern => ({
  variant: "Length",
  length: interval,
});

// Forward declaration - will be implemented in pattern/index.ts
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this array pattern.
 *
 * Note: This is a simplified implementation. Complex sequence matching
 * with backtracking will be implemented when meta patterns are complete.
 */
export const arrayPatternMatches = (
  pattern: ArrayPattern,
  haystack: Cbor,
): boolean => {
  if (!isArray(haystack)) {
    return false;
  }

  switch (pattern.variant) {
    case "Any":
      return true;
    case "Elements": {
      const len = arrayLength(haystack);
      if (len === undefined) {
        return false;
      }
      // Simple case: single element pattern should match array with one element
      // TODO: Complex sequence matching with meta patterns
      for (let i = 0; i < len; i++) {
        const item = arrayItem(haystack, i);
        if (item === undefined) {
          return false;
        }
        if (patternMatches(pattern.pattern, item)) {
          return true;
        }
      }
      return false;
    }
    case "Length": {
      const len = arrayLength(haystack);
      return len !== undefined && pattern.length.contains(len);
    }
  }
};

/**
 * Returns paths to matching array values.
 */
export const arrayPatternPaths = (
  pattern: ArrayPattern,
  haystack: Cbor,
): Path[] => {
  if (arrayPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats an ArrayPattern as a string.
 */
export const arrayPatternDisplay = (
  pattern: ArrayPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  switch (pattern.variant) {
    case "Any":
      return "array";
    case "Elements":
      return `[${patternDisplay(pattern.pattern)}]`;
    case "Length":
      return `[${pattern.length.toString()}]`;
  }
};

/**
 * Compares two ArrayPatterns for equality.
 */
export const arrayPatternEquals = (
  a: ArrayPattern,
  b: ArrayPattern,
  patternEquals: (p1: Pattern, p2: Pattern) => boolean,
): boolean => {
  if (a.variant !== b.variant) {
    return false;
  }
  switch (a.variant) {
    case "Any":
      return true;
    case "Elements":
      return patternEquals(a.pattern, (b as typeof a).pattern);
    case "Length":
      return a.length.equals((b as typeof a).length);
  }
};
