/**
 * Search pattern for dCBOR pattern matching.
 * Searches the entire CBOR tree for matches.
 *
 * @module pattern/meta/search-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { isArray, isMap, isTagged, arrayLength, arrayItem, mapKeys, mapValue, tagContent } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

/**
 * A pattern that searches the entire CBOR tree for matches.
 */
export type SearchPattern = {
  readonly variant: "Search";
  readonly pattern: Pattern;
};

/**
 * Creates a SearchPattern with the given inner pattern.
 */
export const searchPattern = (pattern: Pattern): SearchPattern => ({
  variant: "Search",
  pattern,
});

// Forward declaration
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;
declare function patternPaths(pattern: Pattern, haystack: Cbor): Path[];

/**
 * Recursively searches the CBOR tree and collects all matching paths.
 */
const searchRecursive = (
  pattern: Pattern,
  haystack: Cbor,
  currentPath: Cbor[],
  results: Path[],
): void => {
  // Check if current node matches
  if (patternMatches(pattern, haystack)) {
    results.push([...currentPath, haystack]);
  }

  // Recursively search children
  if (isArray(haystack)) {
    const len = arrayLength(haystack);
    if (len !== undefined) {
      for (let i = 0; i < len; i++) {
        const item = arrayItem(haystack, i);
        if (item !== undefined) {
          searchRecursive(pattern, item, [...currentPath, haystack], results);
        }
      }
    }
  } else if (isMap(haystack)) {
    const keys = mapKeys(haystack);
    if (keys !== undefined) {
      for (const key of keys) {
        // Search in keys
        searchRecursive(pattern, key, [...currentPath, haystack], results);
        // Search in values
        const value = mapValue(haystack, key);
        if (value !== undefined && value !== null) {
          searchRecursive(pattern, value as Cbor, [...currentPath, haystack], results);
        }
      }
    }
  } else if (isTagged(haystack)) {
    const content = tagContent(haystack);
    if (content !== undefined) {
      searchRecursive(pattern, content, [...currentPath, haystack], results);
    }
  }
};

/**
 * Tests if a CBOR value matches this search pattern.
 * Returns true if any node in the tree matches.
 */
export const searchPatternMatches = (
  pattern: SearchPattern,
  haystack: Cbor,
): boolean => {
  const paths = searchPatternPaths(pattern, haystack);
  return paths.length > 0;
};

/**
 * Returns paths to all matching values in the tree.
 */
export const searchPatternPaths = (
  pattern: SearchPattern,
  haystack: Cbor,
): Path[] => {
  const results: Path[] = [];
  searchRecursive(pattern.pattern, haystack, [], results);
  return results;
};

/**
 * Formats a SearchPattern as a string.
 */
export const searchPatternDisplay = (
  pattern: SearchPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  return `..${patternDisplay(pattern.pattern)}`;
};
