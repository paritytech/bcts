/**
 * Map pattern for dCBOR pattern matching.
 *
 * @module pattern/structure/map-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { isMap, mapSize, mapKeys, mapValue } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { Interval } from "../../interval";

/**
 * Pattern for matching CBOR map structures.
 */
export type MapPattern =
  | { readonly variant: "Any" }
  | {
      readonly variant: "Constraints";
      readonly constraints: Array<[Pattern, Pattern]>;
    }
  | { readonly variant: "Length"; readonly length: Interval };

/**
 * Creates a MapPattern that matches any map.
 */
export const mapPatternAny = (): MapPattern => ({ variant: "Any" });

/**
 * Creates a MapPattern that matches maps with key-value constraints.
 */
export const mapPatternWithConstraints = (
  constraints: Array<[Pattern, Pattern]>,
): MapPattern => ({
  variant: "Constraints",
  constraints,
});

/**
 * Creates a MapPattern that matches maps with a specific number of entries.
 */
export const mapPatternWithLength = (length: number): MapPattern => ({
  variant: "Length",
  length: Interval.exactly(length),
});

/**
 * Creates a MapPattern that matches maps with length in a range.
 */
export const mapPatternWithLengthRange = (
  min: number,
  max?: number,
): MapPattern => ({
  variant: "Length",
  length: max !== undefined ? Interval.from(min, max) : Interval.atLeast(min),
});

/**
 * Creates a MapPattern that matches maps with length in an interval.
 */
export const mapPatternWithLengthInterval = (
  interval: Interval,
): MapPattern => ({
  variant: "Length",
  length: interval,
});

// Forward declaration - will be implemented in pattern/index.ts
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this map pattern.
 */
export const mapPatternMatches = (
  pattern: MapPattern,
  haystack: Cbor,
): boolean => {
  if (!isMap(haystack)) {
    return false;
  }

  switch (pattern.variant) {
    case "Any":
      return true;
    case "Constraints": {
      const keys = mapKeys(haystack);
      if (keys === undefined) {
        return false;
      }
      // All constraints must be satisfied
      for (const [keyPattern, valuePattern] of pattern.constraints) {
        let foundMatch = false;
        for (const key of keys) {
          if (patternMatches(keyPattern, key)) {
            const value = mapValue(haystack, key);
            if (value !== undefined && value !== null && patternMatches(valuePattern, value as Cbor)) {
              foundMatch = true;
              break;
            }
          }
        }
        if (!foundMatch) {
          return false;
        }
      }
      return true;
    }
    case "Length": {
      const size = mapSize(haystack);
      return size !== undefined && pattern.length.contains(size);
    }
  }
};

/**
 * Returns paths to matching map values.
 */
export const mapPatternPaths = (
  pattern: MapPattern,
  haystack: Cbor,
): Path[] => {
  if (mapPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a MapPattern as a string.
 */
export const mapPatternDisplay = (
  pattern: MapPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  switch (pattern.variant) {
    case "Any":
      return "map";
    case "Constraints": {
      const parts = pattern.constraints.map(
        ([k, v]) => `${patternDisplay(k)}: ${patternDisplay(v)}`,
      );
      return `{${parts.join(", ")}}`;
    }
    case "Length":
      return `{${pattern.length.toString()}}`;
  }
};

/**
 * Compares two MapPatterns for equality.
 */
export const mapPatternEquals = (
  a: MapPattern,
  b: MapPattern,
  patternEquals: (p1: Pattern, p2: Pattern) => boolean,
): boolean => {
  if (a.variant !== b.variant) {
    return false;
  }
  switch (a.variant) {
    case "Any":
      return true;
    case "Constraints": {
      const bConstraints = (b as typeof a).constraints;
      if (a.constraints.length !== bConstraints.length) {
        return false;
      }
      for (let i = 0; i < a.constraints.length; i++) {
        if (
          !patternEquals(a.constraints[i][0], bConstraints[i][0]) ||
          !patternEquals(a.constraints[i][1], bConstraints[i][1])
        ) {
          return false;
        }
      }
      return true;
    }
    case "Length":
      return a.length.equals((b as typeof a).length);
  }
};
