/**
 * Pattern types for dCBOR pattern matching.
 *
 * This module provides the core Pattern type and its variants for
 * matching dCBOR values.
 *
 * @module pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../format";

// Re-export sub-modules
export * from "./value";
export * from "./structure";
export * from "./meta";
export * from "./vm";
export * from "./matcher";

import {
  type ValuePattern,
  valuePatternPaths,
  valuePatternDisplay,
} from "./value";
import {
  type StructurePattern,
  structurePatternPaths,
  structurePatternDisplay,
} from "./structure";
import {
  type MetaPattern,
  metaPatternPaths,
  metaPatternDisplay,
} from "./meta";
import { compilePattern } from "./matcher";
import { Vm } from "./vm";

/**
 * The main Pattern type - a discriminated union of all pattern variants.
 */
export type Pattern =
  | { readonly kind: "Value"; readonly pattern: ValuePattern }
  | { readonly kind: "Structure"; readonly pattern: StructurePattern }
  | { readonly kind: "Meta"; readonly pattern: MetaPattern };

/**
 * Result of pattern matching with captures.
 */
export interface MatchResult {
  readonly paths: Path[];
  readonly captures: Map<string, Path[]>;
}

// ============================================================================
// Pattern Matching Functions
// ============================================================================

/**
 * Returns paths to matching elements in a CBOR value.
 *
 * @param pattern - The pattern to match
 * @param haystack - The CBOR value to search
 * @returns Array of paths to matching elements
 */
export const patternPaths = (pattern: Pattern, haystack: Cbor): Path[] => {
  switch (pattern.kind) {
    case "Value":
      return valuePatternPaths(pattern.pattern, haystack);
    case "Structure":
      return structurePatternPaths(pattern.pattern, haystack);
    case "Meta":
      return metaPatternPaths(pattern.pattern, haystack);
  }
};

/**
 * Tests if a pattern matches a CBOR value.
 *
 * @param pattern - The pattern to match
 * @param haystack - The CBOR value to test
 * @returns true if the pattern matches
 */
export const patternMatches = (pattern: Pattern, haystack: Cbor): boolean => {
  return patternPaths(pattern, haystack).length > 0;
};

/**
 * Formats a pattern as a string.
 *
 * @param pattern - The pattern to format
 * @returns String representation of the pattern
 */
export const patternDisplay = (pattern: Pattern): string => {
  const displayFn = (p: Pattern): string => patternDisplay(p);
  switch (pattern.kind) {
    case "Value":
      return valuePatternDisplay(pattern.pattern);
    case "Structure":
      return structurePatternDisplay(pattern.pattern, displayFn);
    case "Meta":
      return metaPatternDisplay(pattern.pattern, displayFn);
  }
};

// ============================================================================
// Convenience Functions (aliases for backwards compatibility)
// ============================================================================

/**
 * Matches a pattern against a CBOR value and returns all matching paths.
 *
 * @param pattern - The pattern to match
 * @param haystack - The CBOR value to search
 * @returns Array of paths to matching elements
 */
export const paths = patternPaths;

/**
 * Checks if a pattern matches a CBOR value.
 *
 * @param pattern - The pattern to match
 * @param haystack - The CBOR value to test
 * @returns true if the pattern matches
 */
export const matches = patternMatches;

/**
 * Matches a pattern against a CBOR value and returns paths with captures.
 *
 * @param pattern - The pattern to match
 * @param haystack - The CBOR value to search
 * @returns Match result with paths and captures
 */
export const pathsWithCaptures = (
  pattern: Pattern,
  haystack: Cbor,
): MatchResult => {
  const program = compilePattern(pattern);
  const result = Vm.run(program, haystack);
  return result;
};

/**
 * Alias for pathsWithCaptures for internal VM use.
 */
export const patternPathsWithCaptures = pathsWithCaptures;

// ============================================================================
// Pattern Constructors
// ============================================================================

import { boolPatternAny, boolPatternValue } from "./value/bool-pattern";
import { nullPattern as nullPatternCreate } from "./value/null-pattern";
import {
  numberPatternAny,
  numberPatternValue,
  numberPatternRange,
} from "./value/number-pattern";
import {
  textPatternAny,
  textPatternValue,
  textPatternRegex,
} from "./value/text-pattern";
import { byteStringPatternAny, byteStringPatternValue } from "./value/bytestring-pattern";

import { arrayPatternAny } from "./structure/array-pattern";
import { mapPatternAny } from "./structure/map-pattern";
import { taggedPatternAny } from "./structure/tagged-pattern";

import { anyPattern as anyPatternCreate } from "./meta/any-pattern";
import { andPattern as andPatternCreate } from "./meta/and-pattern";
import { orPattern as orPatternCreate } from "./meta/or-pattern";
import { notPattern as notPatternCreate } from "./meta/not-pattern";
import { capturePattern as capturePatternCreate } from "./meta/capture-pattern";
import { searchPattern as searchPatternCreate } from "./meta/search-pattern";
import { sequencePattern as sequencePatternCreate } from "./meta/sequence-pattern";

/**
 * Creates a pattern that matches any value.
 */
export const any = (): Pattern => ({
  kind: "Meta",
  pattern: { type: "Any", pattern: anyPatternCreate() },
});

/**
 * Creates a pattern that matches any boolean.
 */
export const anyBool = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Bool", pattern: boolPatternAny() },
});

/**
 * Creates a pattern that matches a specific boolean value.
 */
export const bool = (value: boolean): Pattern => ({
  kind: "Value",
  pattern: { type: "Bool", pattern: boolPatternValue(value) },
});

/**
 * Creates a pattern that matches null.
 */
export const nullPattern = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Null", pattern: nullPatternCreate() },
});

/**
 * Creates a pattern that matches any number.
 */
export const anyNumber = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternAny() },
});

/**
 * Creates a pattern that matches a specific number.
 */
export const number = (value: number): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternValue(value) },
});

/**
 * Creates a pattern that matches numbers in a range.
 */
export const numberRange = (min: number, max: number): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternRange(min, max) },
});

/**
 * Creates a pattern that matches any text.
 */
export const anyText = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Text", pattern: textPatternAny() },
});

/**
 * Creates a pattern that matches specific text.
 */
export const text = (value: string): Pattern => ({
  kind: "Value",
  pattern: { type: "Text", pattern: textPatternValue(value) },
});

/**
 * Creates a pattern that matches text using a regex.
 */
export const textRegex = (pattern: RegExp): Pattern => ({
  kind: "Value",
  pattern: { type: "Text", pattern: textPatternRegex(pattern) },
});

/**
 * Creates a pattern that matches any byte string.
 */
export const anyByteString = (): Pattern => ({
  kind: "Value",
  pattern: { type: "ByteString", pattern: byteStringPatternAny() },
});

/**
 * Creates a pattern that matches a specific byte string.
 */
export const byteString = (value: Uint8Array): Pattern => ({
  kind: "Value",
  pattern: { type: "ByteString", pattern: byteStringPatternValue(value) },
});

/**
 * Creates a pattern that matches any array.
 */
export const anyArray = (): Pattern => ({
  kind: "Structure",
  pattern: { type: "Array", pattern: arrayPatternAny() },
});

/**
 * Creates a pattern that matches any map.
 */
export const anyMap = (): Pattern => ({
  kind: "Structure",
  pattern: { type: "Map", pattern: mapPatternAny() },
});

/**
 * Creates a pattern that matches any tagged value.
 */
export const anyTagged = (): Pattern => ({
  kind: "Structure",
  pattern: { type: "Tagged", pattern: taggedPatternAny() },
});

/**
 * Creates an AND pattern that matches if all patterns match.
 */
export const and = (...patterns: Pattern[]): Pattern => ({
  kind: "Meta",
  pattern: { type: "And", pattern: andPatternCreate(patterns) },
});

/**
 * Creates an OR pattern that matches if any pattern matches.
 */
export const or = (...patterns: Pattern[]): Pattern => ({
  kind: "Meta",
  pattern: { type: "Or", pattern: orPatternCreate(patterns) },
});

/**
 * Creates a NOT pattern that matches if the pattern does not match.
 */
export const not = (pattern: Pattern): Pattern => ({
  kind: "Meta",
  pattern: { type: "Not", pattern: notPatternCreate(pattern) },
});

/**
 * Creates a capture pattern with a name.
 */
export const capture = (name: string, pattern: Pattern): Pattern => ({
  kind: "Meta",
  pattern: { type: "Capture", pattern: capturePatternCreate(name, pattern) },
});

/**
 * Creates a search pattern for recursive matching.
 */
export const search = (pattern: Pattern): Pattern => ({
  kind: "Meta",
  pattern: { type: "Search", pattern: searchPatternCreate(pattern) },
});

/**
 * Creates a sequence pattern for ordered matching.
 */
export const sequence = (...patterns: Pattern[]): Pattern => ({
  kind: "Meta",
  pattern: { type: "Sequence", pattern: sequencePatternCreate(patterns) },
});
