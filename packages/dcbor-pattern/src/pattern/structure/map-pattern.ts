/**
 * Map pattern for dCBOR pattern matching.
 *
 * @module pattern/structure/map-pattern
 */

import type { Cbor, CborInput } from "@bcts/dcbor";
import { isMap, mapSize, mapKeys, mapValue, cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { Interval } from "../../interval";
import { matchPattern } from "../match-registry";

/**
 * Pattern for matching CBOR map structures.
 */
export type MapPattern =
  | { readonly variant: "Any" }
  | {
      readonly variant: "Constraints";
      readonly constraints: [Pattern, Pattern][];
    }
  | { readonly variant: "Length"; readonly length: Interval };

/**
 * Creates a MapPattern that matches any map.
 */
export const mapPatternAny = (): MapPattern => ({ variant: "Any" });

/**
 * Creates a MapPattern that matches maps with key-value constraints.
 */
export const mapPatternWithConstraints = (constraints: [Pattern, Pattern][]): MapPattern => ({
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
export const mapPatternWithLengthRange = (min: number, max?: number): MapPattern => ({
  variant: "Length",
  length: max !== undefined ? Interval.from(min, max) : Interval.atLeast(min),
});

/**
 * Creates a MapPattern that matches maps with length in an interval.
 */
export const mapPatternWithLengthInterval = (interval: Interval): MapPattern => ({
  variant: "Length",
  length: interval,
});

/**
 * Tests if a CBOR value matches this map pattern.
 */
export const mapPatternMatches = (pattern: MapPattern, haystack: Cbor): boolean => {
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
          if (matchPattern(keyPattern, key)) {
            const rawValue = mapValue(haystack, key);
            if (rawValue !== undefined && rawValue !== null) {
              // Wrap raw JavaScript value in CBOR if needed
              const value = (rawValue as Cbor)?.isCbor
                ? (rawValue as Cbor)
                : cbor(rawValue as CborInput);
              if (matchPattern(valuePattern, value)) {
                foundMatch = true;
                break;
              }
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
export const mapPatternPaths = (pattern: MapPattern, haystack: Cbor): Path[] => {
  if (mapPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Helper to build a map context path (map -> element).
 */
const buildMapContextPath = (mapCbor: Cbor, element: Cbor): Path => {
  return [mapCbor, element];
};

/**
 * Collects captures from a pattern by checking if it's a capture pattern.
 */
const collectCapturesFromPattern = (
  pattern: Pattern,
  matchedValue: Cbor,
  mapContext: Cbor,
  captures: Map<string, Path[]>,
): void => {
  if (pattern.kind === "Meta" && pattern.pattern.type === "Capture") {
    const captureName = pattern.pattern.pattern.name;
    const contextPath = buildMapContextPath(mapContext, matchedValue);
    const existing = captures.get(captureName) ?? [];
    existing.push(contextPath);
    captures.set(captureName, existing);

    // Also collect from inner pattern
    collectCapturesFromPattern(pattern.pattern.pattern.pattern, matchedValue, mapContext, captures);
  }
};

/**
 * Returns paths with captures for map patterns.
 */
export const mapPatternPathsWithCaptures = (
  pattern: MapPattern,
  haystack: Cbor,
): [Path[], Map<string, Path[]>] => {
  if (!isMap(haystack)) {
    return [[], new Map<string, Path[]>()];
  }

  switch (pattern.variant) {
    case "Any":
    case "Length":
      return [mapPatternPaths(pattern, haystack), new Map<string, Path[]>()];

    case "Constraints": {
      const keys = mapKeys(haystack);
      if (keys === undefined) {
        return [[], new Map<string, Path[]>()];
      }

      const captures = new Map<string, Path[]>();

      // For each constraint, find the matching key-value pair and collect captures
      for (const [keyPattern, valuePattern] of pattern.constraints) {
        for (const key of keys) {
          if (matchPattern(keyPattern, key)) {
            const rawValue = mapValue(haystack, key);
            if (rawValue !== undefined && rawValue !== null) {
              // Wrap raw JavaScript value in CBOR if needed
              const value = (rawValue as Cbor)?.isCbor
                ? (rawValue as Cbor)
                : cbor(rawValue as CborInput);
              if (matchPattern(valuePattern, value)) {
                // Collect captures from key pattern
                collectCapturesFromPattern(keyPattern, key, haystack, captures);
                // Collect captures from value pattern
                collectCapturesFromPattern(valuePattern, value, haystack, captures);
                break;
              }
            }
          }
        }
      }

      // If pattern matches, return the map path with captures
      if (mapPatternMatches(pattern, haystack)) {
        return [[[haystack]], captures];
      }
      return [[], new Map<string, Path[]>()];
    }
  }
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
