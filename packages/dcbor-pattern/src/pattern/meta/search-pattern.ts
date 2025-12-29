/**
 * Search pattern for dCBOR pattern matching.
 * Searches the entire CBOR tree for matches.
 *
 * @module pattern/meta/search-pattern
 */

import type { Cbor, CborInput } from "@bcts/dcbor";
import {
  isArray,
  isMap,
  isTagged,
  arrayLength,
  arrayItem,
  mapKeys,
  mapValue,
  tagContent,
  cbor,
} from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { matchPattern } from "../match-registry";

/**
 * A pattern that searches the entire CBOR tree for matches.
 */
export interface SearchPattern {
  readonly variant: "Search";
  readonly pattern: Pattern;
}

/**
 * Creates a SearchPattern with the given inner pattern.
 */
export const searchPattern = (pattern: Pattern): SearchPattern => ({
  variant: "Search",
  pattern,
});

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
  if (matchPattern(pattern, haystack)) {
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
        const rawValue = mapValue(haystack, key);
        if (rawValue !== undefined && rawValue !== null) {
          // Wrap raw JavaScript value in CBOR if needed
          const value = (rawValue as Cbor)?.isCbor
            ? (rawValue as Cbor)
            : cbor(rawValue as CborInput);
          searchRecursive(pattern, value, [...currentPath, haystack], results);
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
export const searchPatternMatches = (pattern: SearchPattern, haystack: Cbor): boolean => {
  const paths = searchPatternPaths(pattern, haystack);
  return paths.length > 0;
};

/**
 * Returns paths to all matching values in the tree.
 */
export const searchPatternPaths = (pattern: SearchPattern, haystack: Cbor): Path[] => {
  const results: Path[] = [];
  searchRecursive(pattern.pattern, haystack, [], results);
  return results;
};

/**
 * Result type for paths with captures from search operations.
 */
export interface SearchWithCaptures {
  readonly paths: Path[];
  readonly captures: Map<string, Path[]>;
}

/**
 * Recursively searches the CBOR tree, collecting paths and captures.
 */
const searchRecursiveWithCaptures = (
  pattern: Pattern,
  haystack: Cbor,
  currentPath: Cbor[],
  results: Path[],
  captures: Map<string, Path[]>,
  collectCapture: (p: Pattern, h: Cbor, path: Cbor[]) => void,
): void => {
  // Check if current node matches
  if (matchPattern(pattern, haystack)) {
    const matchPath = [...currentPath, haystack];
    results.push(matchPath);
    // Collect captures for this match
    collectCapture(pattern, haystack, matchPath);
  }

  // Recursively search children
  if (isArray(haystack)) {
    const len = arrayLength(haystack);
    if (len !== undefined) {
      for (let i = 0; i < len; i++) {
        const item = arrayItem(haystack, i);
        if (item !== undefined) {
          searchRecursiveWithCaptures(
            pattern,
            item,
            [...currentPath, haystack],
            results,
            captures,
            collectCapture,
          );
        }
      }
    }
  } else if (isMap(haystack)) {
    const keys = mapKeys(haystack);
    if (keys !== undefined) {
      for (const key of keys) {
        // Search in keys
        searchRecursiveWithCaptures(
          pattern,
          key,
          [...currentPath, haystack],
          results,
          captures,
          collectCapture,
        );
        // Search in values
        const rawValue = mapValue(haystack, key);
        if (rawValue !== undefined && rawValue !== null) {
          // Wrap raw JavaScript value in CBOR if needed
          const value = (rawValue as Cbor)?.isCbor
            ? (rawValue as Cbor)
            : cbor(rawValue as CborInput);
          searchRecursiveWithCaptures(
            pattern,
            value,
            [...currentPath, haystack],
            results,
            captures,
            collectCapture,
          );
        }
      }
    }
  } else if (isTagged(haystack)) {
    const content = tagContent(haystack);
    if (content !== undefined) {
      searchRecursiveWithCaptures(
        pattern,
        content,
        [...currentPath, haystack],
        results,
        captures,
        collectCapture,
      );
    }
  }
};

/**
 * Extract capture from a pattern at a given match location.
 * Recursively searches for all capture patterns.
 */
const extractCaptures = (
  pattern: Pattern,
  matchPath: Cbor[],
  captures: Map<string, Path[]>,
): void => {
  if (pattern.kind === "Meta") {
    switch (pattern.pattern.type) {
      case "Capture": {
        const captureName = pattern.pattern.pattern.name;
        const existing = captures.get(captureName) ?? [];
        existing.push(matchPath);
        captures.set(captureName, existing);
        // Also extract from inner pattern
        extractCaptures(pattern.pattern.pattern.pattern, matchPath, captures);
        break;
      }
      case "And":
        for (const p of pattern.pattern.pattern.patterns) {
          extractCaptures(p, matchPath, captures);
        }
        break;
      case "Or":
        for (const p of pattern.pattern.pattern.patterns) {
          extractCaptures(p, matchPath, captures);
        }
        break;
      case "Sequence":
        for (const p of pattern.pattern.pattern.patterns) {
          extractCaptures(p, matchPath, captures);
        }
        break;
      case "Not":
        extractCaptures(pattern.pattern.pattern.pattern, matchPath, captures);
        break;
      case "Repeat":
        extractCaptures(pattern.pattern.pattern.pattern, matchPath, captures);
        break;
      case "Search":
        extractCaptures(pattern.pattern.pattern.pattern, matchPath, captures);
        break;
      case "Any":
        // No captures
        break;
    }
  } else if (pattern.kind === "Structure") {
    switch (pattern.pattern.type) {
      case "Array":
        if (pattern.pattern.pattern.variant === "Elements") {
          extractCaptures(pattern.pattern.pattern.pattern, matchPath, captures);
        }
        break;
      case "Map":
        if (pattern.pattern.pattern.variant === "Constraints") {
          for (const [keyPattern, valuePattern] of pattern.pattern.pattern.constraints) {
            extractCaptures(keyPattern, matchPath, captures);
            extractCaptures(valuePattern, matchPath, captures);
          }
        }
        break;
      case "Tagged":
        if (pattern.pattern.pattern.variant !== "Any") {
          extractCaptures(pattern.pattern.pattern.pattern, matchPath, captures);
        }
        break;
    }
  }
};

/**
 * Returns paths with captures for all matching values in the tree.
 */
export const searchPatternPathsWithCaptures = (
  pattern: SearchPattern,
  haystack: Cbor,
): SearchWithCaptures => {
  const results: Path[] = [];
  const captures = new Map<string, Path[]>();

  const collectCapture = (p: Pattern, _h: Cbor, path: Cbor[]): void => {
    extractCaptures(p, path, captures);
  };

  searchRecursiveWithCaptures(pattern.pattern, haystack, [], results, captures, collectCapture);

  return { paths: results, captures };
};

/**
 * Formats a SearchPattern as a string.
 */
export const searchPatternDisplay = (
  pattern: SearchPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  return `search(${patternDisplay(pattern.pattern)})`;
};
