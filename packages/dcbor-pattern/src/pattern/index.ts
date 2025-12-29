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
import {
  setMatchFn,
  setPathsFn,
  setPathsWithCapturesFn,
  setPathsWithCapturesDirectFn,
} from "./match-registry";

// Re-export sub-modules
export * from "./value";
export * from "./structure";
export * from "./meta";
export * from "./vm";
export * from "./matcher";
export * from "./match-registry";

import { type ValuePattern, valuePatternPaths, valuePatternDisplay } from "./value";
import {
  type StructurePattern,
  structurePatternPaths,
  structurePatternDisplay,
  structurePatternPathsWithCaptures,
} from "./structure";
import { type MetaPattern, metaPatternPaths, metaPatternDisplay } from "./meta";
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
 * Computes paths with captures directly without using the VM.
 * This is used internally by the VM to avoid infinite recursion.
 *
 * Note: This function delegates capture collection to the pattern's
 * own matching mechanism. The VM has its own capture tracking, so
 * this just returns paths with any captures found during matching.
 *
 * @param pattern - The pattern to match
 * @param haystack - The CBOR value to search
 * @returns Match result with paths and captures
 */
export const pathsWithCapturesDirect = (pattern: Pattern, haystack: Cbor): MatchResult => {
  // For structure patterns, use the specialized function that properly handles captures
  if (pattern.kind === "Structure") {
    const [paths, captures] = structurePatternPathsWithCaptures(pattern.pattern, haystack);
    return { paths, captures };
  }

  // For value patterns, no captures possible
  if (pattern.kind === "Value") {
    const paths = patternPaths(pattern, haystack);
    return { paths, captures: new Map() };
  }

  // For meta patterns, collect captures recursively
  const paths = patternPaths(pattern, haystack);
  const captures = new Map<string, Path[]>();

  const collectCaptures = (p: Pattern, h: Cbor): void => {
    if (p.kind === "Meta") {
      switch (p.pattern.type) {
        case "Capture": {
          const capturePattern = p.pattern.pattern;
          const capturedPaths = patternPaths(capturePattern.pattern, h);
          if (capturedPaths.length > 0) {
            const existing = captures.get(capturePattern.name) ?? [];
            captures.set(capturePattern.name, [...existing, ...capturedPaths]);
          }
          collectCaptures(capturePattern.pattern, h);
          break;
        }
        case "And":
          for (const inner of p.pattern.pattern.patterns) {
            collectCaptures(inner, h);
          }
          break;
        case "Or":
          for (const inner of p.pattern.pattern.patterns) {
            if (patternMatches(inner, h)) {
              collectCaptures(inner, h);
              break;
            }
          }
          break;
        case "Not":
          break;
        case "Repeat":
          collectCaptures(p.pattern.pattern.pattern, h);
          break;
        case "Sequence":
          for (const inner of p.pattern.pattern.patterns) {
            collectCaptures(inner, h);
          }
          break;
        case "Search":
          collectCaptures(p.pattern.pattern.pattern, h);
          break;
        case "Any":
          break;
      }
    } else if (p.kind === "Structure") {
      // Delegate to structure-specific function
      const [_, structureCaptures] = structurePatternPathsWithCaptures(p.pattern, h);
      for (const [name, capturePaths] of structureCaptures) {
        const existing = captures.get(name) ?? [];
        captures.set(name, [...existing, ...capturePaths]);
      }
    }
  };

  if (paths.length > 0) {
    collectCaptures(pattern, haystack);
  }

  return { paths, captures };
};

/**
 * Matches a pattern against a CBOR value and returns paths with captures.
 *
 * @param pattern - The pattern to match
 * @param haystack - The CBOR value to search
 * @returns Match result with paths and captures
 */
export const pathsWithCaptures = (pattern: Pattern, haystack: Cbor): MatchResult => {
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
  numberPatternGreaterThan,
  numberPatternGreaterThanOrEqual,
  numberPatternLessThan,
  numberPatternLessThanOrEqual,
  numberPatternNaN,
  numberPatternInfinity,
  numberPatternNegInfinity,
} from "./value/number-pattern";
import { textPatternAny, textPatternValue, textPatternRegex } from "./value/text-pattern";
import {
  byteStringPatternAny,
  byteStringPatternValue,
  byteStringPatternBinaryRegex,
} from "./value/bytestring-pattern";
import {
  datePatternAny,
  datePatternValue,
  datePatternRange,
  datePatternEarliest,
  datePatternLatest,
  datePatternStringValue,
  datePatternRegex,
} from "./value/date-pattern";
import {
  digestPatternAny,
  digestPatternValue,
  digestPatternPrefix,
  digestPatternBinaryRegex,
} from "./value/digest-pattern";
import {
  knownValuePatternAny,
  knownValuePatternValue,
  knownValuePatternNamed,
  knownValuePatternRegex,
} from "./value/known-value-pattern";

import { arrayPatternAny } from "./structure/array-pattern";
import { mapPatternAny } from "./structure/map-pattern";
import {
  taggedPatternAny,
  taggedPatternWithTag,
  taggedPatternWithName,
  taggedPatternWithRegex,
} from "./structure/tagged-pattern";

import { anyPattern as anyPatternCreate } from "./meta/any-pattern";
import { andPattern as andPatternCreate } from "./meta/and-pattern";
import { orPattern as orPatternCreate } from "./meta/or-pattern";
import { notPattern as notPatternCreate } from "./meta/not-pattern";
import { capturePattern as capturePatternCreate } from "./meta/capture-pattern";
import { searchPattern as searchPatternCreate } from "./meta/search-pattern";
import { sequencePattern as sequencePatternCreate } from "./meta/sequence-pattern";
import { repeatPattern as repeatPatternCreate } from "./meta/repeat-pattern";
import { Quantifier } from "../quantifier";
import type { Tag } from "@bcts/dcbor";
import type { CborDate } from "@bcts/dcbor";
import type { Digest } from "@bcts/components";
import type { KnownValue } from "@bcts/known-values";

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
 * Creates a pattern that matches byte strings using a binary regex.
 *
 * The regex matches against raw bytes converted to a Latin-1 string.
 * Use escape sequences like `\x00` to match specific byte values.
 *
 * @example
 * ```typescript
 * // Match bytes starting with 0x00
 * byteStringRegex(/^\x00/)
 *
 * // Match ASCII "Hello"
 * byteStringRegex(/Hello/)
 * ```
 */
export const byteStringRegex = (pattern: RegExp): Pattern => ({
  kind: "Value",
  pattern: { type: "ByteString", pattern: byteStringPatternBinaryRegex(pattern) },
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

// ============================================================================
// Number Pattern Constructors (additional)
// ============================================================================

/**
 * Creates a pattern that matches numbers greater than a value.
 */
export const numberGreaterThan = (value: number): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternGreaterThan(value) },
});

/**
 * Creates a pattern that matches numbers greater than or equal to a value.
 */
export const numberGreaterThanOrEqual = (value: number): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternGreaterThanOrEqual(value) },
});

/**
 * Creates a pattern that matches numbers less than a value.
 */
export const numberLessThan = (value: number): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternLessThan(value) },
});

/**
 * Creates a pattern that matches numbers less than or equal to a value.
 */
export const numberLessThanOrEqual = (value: number): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternLessThanOrEqual(value) },
});

/**
 * Creates a pattern that matches NaN.
 */
export const numberNaN = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternNaN() },
});

/**
 * Creates a pattern that matches positive infinity.
 */
export const numberInfinity = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternInfinity() },
});

/**
 * Creates a pattern that matches negative infinity.
 */
export const numberNegInfinity = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Number", pattern: numberPatternNegInfinity() },
});

// ============================================================================
// Date Pattern Constructors
// ============================================================================

/**
 * Creates a pattern that matches any date.
 */
export const anyDate = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Date", pattern: datePatternAny() },
});

/**
 * Creates a pattern that matches a specific date.
 */
export const date = (value: CborDate): Pattern => ({
  kind: "Value",
  pattern: { type: "Date", pattern: datePatternValue(value) },
});

/**
 * Creates a pattern that matches dates within a range (inclusive).
 */
export const dateRange = (min: CborDate, max: CborDate): Pattern => ({
  kind: "Value",
  pattern: { type: "Date", pattern: datePatternRange(min, max) },
});

/**
 * Creates a pattern that matches dates on or after the specified date.
 */
export const dateEarliest = (value: CborDate): Pattern => ({
  kind: "Value",
  pattern: { type: "Date", pattern: datePatternEarliest(value) },
});

/**
 * Creates a pattern that matches dates on or before the specified date.
 */
export const dateLatest = (value: CborDate): Pattern => ({
  kind: "Value",
  pattern: { type: "Date", pattern: datePatternLatest(value) },
});

/**
 * Creates a pattern that matches dates by their ISO-8601 string representation.
 */
export const dateIso8601 = (value: string): Pattern => ({
  kind: "Value",
  pattern: { type: "Date", pattern: datePatternStringValue(value) },
});

/**
 * Creates a pattern that matches dates by regex on their ISO-8601 string.
 */
export const dateRegex = (pattern: RegExp): Pattern => ({
  kind: "Value",
  pattern: { type: "Date", pattern: datePatternRegex(pattern) },
});

// ============================================================================
// Digest Pattern Constructors
// ============================================================================

/**
 * Creates a pattern that matches any digest.
 */
export const anyDigest = (): Pattern => ({
  kind: "Value",
  pattern: { type: "Digest", pattern: digestPatternAny() },
});

/**
 * Creates a pattern that matches a specific digest.
 */
export const digest = (value: Digest): Pattern => ({
  kind: "Value",
  pattern: { type: "Digest", pattern: digestPatternValue(value) },
});

/**
 * Creates a pattern that matches digests with a prefix.
 */
export const digestPrefix = (prefix: Uint8Array): Pattern => ({
  kind: "Value",
  pattern: { type: "Digest", pattern: digestPatternPrefix(prefix) },
});

/**
 * Creates a pattern that matches digests by binary regex.
 */
export const digestBinaryRegex = (pattern: RegExp): Pattern => ({
  kind: "Value",
  pattern: { type: "Digest", pattern: digestPatternBinaryRegex(pattern) },
});

// ============================================================================
// KnownValue Pattern Constructors
// ============================================================================

/**
 * Creates a pattern that matches any known value.
 */
export const anyKnownValue = (): Pattern => ({
  kind: "Value",
  pattern: { type: "KnownValue", pattern: knownValuePatternAny() },
});

/**
 * Creates a pattern that matches a specific known value.
 */
export const knownValue = (value: KnownValue): Pattern => ({
  kind: "Value",
  pattern: { type: "KnownValue", pattern: knownValuePatternValue(value) },
});

/**
 * Creates a pattern that matches a known value by name.
 */
export const knownValueNamed = (name: string): Pattern => ({
  kind: "Value",
  pattern: { type: "KnownValue", pattern: knownValuePatternNamed(name) },
});

/**
 * Creates a pattern that matches known values by regex on their name.
 */
export const knownValueRegex = (pattern: RegExp): Pattern => ({
  kind: "Value",
  pattern: { type: "KnownValue", pattern: knownValuePatternRegex(pattern) },
});

// ============================================================================
// Tagged Pattern Constructors
// ============================================================================

/**
 * Creates a pattern that matches tagged values with a specific tag.
 */
export const tagged = (tag: Tag, pattern: Pattern): Pattern => ({
  kind: "Structure",
  pattern: { type: "Tagged", pattern: taggedPatternWithTag(tag, pattern) },
});

/**
 * Creates a pattern that matches tagged values by tag name.
 */
export const taggedName = (name: string, pattern: Pattern): Pattern => ({
  kind: "Structure",
  pattern: { type: "Tagged", pattern: taggedPatternWithName(name, pattern) },
});

/**
 * Creates a pattern that matches tagged values by tag name regex.
 */
export const taggedRegex = (regex: RegExp, pattern: Pattern): Pattern => ({
  kind: "Structure",
  pattern: { type: "Tagged", pattern: taggedPatternWithRegex(regex, pattern) },
});

// ============================================================================
// Meta Pattern Constructors (additional)
// ============================================================================

/**
 * Creates a repeat pattern with the given pattern and quantifier.
 */
export const repeat = (pattern: Pattern, quantifier: Quantifier): Pattern => ({
  kind: "Meta",
  pattern: { type: "Repeat", pattern: repeatPatternCreate(pattern, quantifier) },
});

/**
 * Creates a grouped pattern (equivalent to repeat with exactly 1).
 * This is useful for precedence grouping in pattern expressions.
 */
export const group = (pattern: Pattern): Pattern => ({
  kind: "Meta",
  pattern: { type: "Repeat", pattern: repeatPatternCreate(pattern, Quantifier.exactly(1)) },
});

// ============================================================================
// Initialize Match Registry
// ============================================================================

// Register all pattern functions with the match registry
// This breaks the circular dependency between pattern files
setMatchFn(patternMatches);
setPathsFn(patternPaths);
setPathsWithCapturesFn(pathsWithCaptures);
setPathsWithCapturesDirectFn(pathsWithCapturesDirect);
