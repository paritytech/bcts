/**
 * Meta patterns for dCBOR pattern matching.
 *
 * @module pattern/meta
 */

export * from "./any-pattern";
export * from "./and-pattern";
export * from "./or-pattern";
export * from "./not-pattern";
export * from "./repeat-pattern";
export * from "./capture-pattern";
export * from "./search-pattern";
export * from "./sequence-pattern";

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

import { type AnyPattern, anyPatternPaths, anyPatternDisplay } from "./any-pattern";
import { type AndPattern, andPatternPaths, andPatternDisplay } from "./and-pattern";
import { type OrPattern, orPatternPaths, orPatternDisplay } from "./or-pattern";
import { type NotPattern, notPatternPaths, notPatternDisplay } from "./not-pattern";
import { type RepeatPattern, repeatPatternPaths, repeatPatternDisplay } from "./repeat-pattern";
import { type CapturePattern, capturePatternPaths, capturePatternDisplay } from "./capture-pattern";
import { type SearchPattern, searchPatternPaths, searchPatternDisplay } from "./search-pattern";
import { type SequencePattern, sequencePatternPaths, sequencePatternDisplay } from "./sequence-pattern";

/**
 * Union of all meta pattern types.
 */
export type MetaPattern =
  | { readonly type: "Any"; readonly pattern: AnyPattern }
  | { readonly type: "And"; readonly pattern: AndPattern }
  | { readonly type: "Or"; readonly pattern: OrPattern }
  | { readonly type: "Not"; readonly pattern: NotPattern }
  | { readonly type: "Repeat"; readonly pattern: RepeatPattern }
  | { readonly type: "Capture"; readonly pattern: CapturePattern }
  | { readonly type: "Search"; readonly pattern: SearchPattern }
  | { readonly type: "Sequence"; readonly pattern: SequencePattern };

/**
 * Returns paths to matching values for a MetaPattern.
 */
export const metaPatternPaths = (
  pattern: MetaPattern,
  haystack: Cbor,
): Path[] => {
  switch (pattern.type) {
    case "Any":
      return anyPatternPaths(pattern.pattern, haystack);
    case "And":
      return andPatternPaths(pattern.pattern, haystack);
    case "Or":
      return orPatternPaths(pattern.pattern, haystack);
    case "Not":
      return notPatternPaths(pattern.pattern, haystack);
    case "Repeat":
      return repeatPatternPaths(pattern.pattern, haystack);
    case "Capture":
      return capturePatternPaths(pattern.pattern, haystack);
    case "Search":
      return searchPatternPaths(pattern.pattern, haystack);
    case "Sequence":
      return sequencePatternPaths(pattern.pattern, haystack);
  }
};

/**
 * Tests if a CBOR value matches a MetaPattern.
 */
export const metaPatternMatches = (
  pattern: MetaPattern,
  haystack: Cbor,
): boolean => {
  return metaPatternPaths(pattern, haystack).length > 0;
};

/**
 * Formats a MetaPattern as a string.
 */
export const metaPatternDisplay = (
  pattern: MetaPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  switch (pattern.type) {
    case "Any":
      return anyPatternDisplay(pattern.pattern);
    case "And":
      return andPatternDisplay(pattern.pattern, patternDisplay);
    case "Or":
      return orPatternDisplay(pattern.pattern, patternDisplay);
    case "Not":
      return notPatternDisplay(pattern.pattern, patternDisplay);
    case "Repeat":
      return repeatPatternDisplay(pattern.pattern, patternDisplay);
    case "Capture":
      return capturePatternDisplay(pattern.pattern, patternDisplay);
    case "Search":
      return searchPatternDisplay(pattern.pattern, patternDisplay);
    case "Sequence":
      return sequencePatternDisplay(pattern.pattern, patternDisplay);
  }
};

// Convenience constructors for MetaPattern

/**
 * Creates an Any MetaPattern.
 */
export const metaAny = (pattern: AnyPattern): MetaPattern => ({
  type: "Any",
  pattern,
});

/**
 * Creates an And MetaPattern.
 */
export const metaAnd = (pattern: AndPattern): MetaPattern => ({
  type: "And",
  pattern,
});

/**
 * Creates an Or MetaPattern.
 */
export const metaOr = (pattern: OrPattern): MetaPattern => ({
  type: "Or",
  pattern,
});

/**
 * Creates a Not MetaPattern.
 */
export const metaNot = (pattern: NotPattern): MetaPattern => ({
  type: "Not",
  pattern,
});

/**
 * Creates a Repeat MetaPattern.
 */
export const metaRepeat = (pattern: RepeatPattern): MetaPattern => ({
  type: "Repeat",
  pattern,
});

/**
 * Creates a Capture MetaPattern.
 */
export const metaCapture = (pattern: CapturePattern): MetaPattern => ({
  type: "Capture",
  pattern,
});

/**
 * Creates a Search MetaPattern.
 */
export const metaSearch = (pattern: SearchPattern): MetaPattern => ({
  type: "Search",
  pattern,
});

/**
 * Creates a Sequence MetaPattern.
 */
export const metaSequence = (pattern: SequencePattern): MetaPattern => ({
  type: "Sequence",
  pattern,
});
