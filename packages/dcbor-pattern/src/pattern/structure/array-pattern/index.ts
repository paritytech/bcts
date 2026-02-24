/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Array pattern for dCBOR pattern matching.
 *
 * @module pattern/structure/array-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { isArray, arrayLength, arrayItem, cbor } from "@bcts/dcbor";
import type { Path } from "../../../format";
import type { Pattern } from "../../index";
import type { SequencePattern } from "../../meta/sequence-pattern";
import type { RepeatPattern } from "../../meta/repeat-pattern";
import { Interval } from "../../../interval";
import { matchPattern } from "../../match-registry";
import {
  hasRepeatPatternsInSlice,
  extractCaptureWithRepeat,
  isRepeatPattern,
  buildSimpleArrayContextPath,
} from "./helpers";
import { SequenceAssigner } from "./assigner";

// Re-export helper modules
export * from "./helpers";
export * from "./backtrack";
export * from "./assigner";

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
export const arrayPatternWithLengthRange = (min: number, max?: number): ArrayPattern => ({
  variant: "Length",
  length: max !== undefined ? Interval.from(min, max) : Interval.atLeast(min),
});

/**
 * Creates an ArrayPattern that matches arrays with length in an interval.
 */
export const arrayPatternWithLengthInterval = (interval: Interval): ArrayPattern => ({
  variant: "Length",
  length: interval,
});

/**
 * Gets array elements as Cbor array.
 */
const getArrayElements = (haystack: Cbor): Cbor[] | undefined => {
  if (!isArray(haystack)) {
    return undefined;
  }
  const len = arrayLength(haystack);
  if (len === undefined) {
    return undefined;
  }
  const elements: Cbor[] = [];
  for (let i = 0; i < len; i++) {
    const item = arrayItem(haystack, i);
    if (item === undefined) {
      return undefined;
    }
    elements.push(item);
  }
  return elements;
};

/**
 * Match a single repeat pattern against array elements.
 */
const matchRepeatPatternAgainstArray = (repeatPattern: RepeatPattern, arr: Cbor[]): boolean => {
  const quantifier = repeatPattern.quantifier;
  const minCount = quantifier.min();
  const maxCount = quantifier.max() ?? arr.length;

  // Check if the array length is within the valid range for this repeat
  if (arr.length < minCount || arr.length > maxCount) {
    return false;
  }

  // Check if all elements match the repeated pattern
  return arr.every((element) => matchPattern(repeatPattern.pattern, element));
};

/**
 * Match a sequence of patterns against array elements using backtracking.
 */
const matchSequencePatternsAgainstArray = (seqPattern: SequencePattern, arr: Cbor[]): boolean => {
  const patterns = seqPattern.patterns;
  const assigner = new SequenceAssigner(patterns, arr, matchPattern);
  return assigner.canMatch();
};

/**
 * Check if a sequence pattern can match against array elements.
 */
const canMatchSequenceAgainstArray = (pattern: Pattern, arr: Cbor[]): boolean => {
  if (pattern.kind === "Meta") {
    if (pattern.pattern.type === "Sequence") {
      return matchSequencePatternsAgainstArray(pattern.pattern.pattern, arr);
    }
    if (pattern.pattern.type === "Repeat") {
      return matchRepeatPatternAgainstArray(pattern.pattern.pattern, arr);
    }
  }
  // For non-sequence patterns, fall back to simple matching
  const arrayCbor = cbor(arr);
  return matchPattern(pattern, arrayCbor);
};

/**
 * Match a complex sequence against array elements.
 */
const matchComplexSequence = (haystack: Cbor, pattern: Pattern): Path[] => {
  const arr = getArrayElements(haystack);
  if (arr === undefined) {
    return [];
  }

  const canMatch = canMatchSequenceAgainstArray(pattern, arr);
  if (canMatch) {
    return [[haystack]];
  }
  return [];
};

/**
 * Find which array elements are assigned to which sequence patterns.
 */
const findSequenceElementAssignments = (
  seqPattern: SequencePattern,
  arr: Cbor[],
): [number, number][] | undefined => {
  const patterns = seqPattern.patterns;
  const assigner = new SequenceAssigner(patterns, arr, matchPattern);
  return assigner.findAssignments();
};

/**
 * Handle sequence patterns with captures by manually matching elements
 * and collecting captures with proper array context.
 */
const handleSequenceCaptures = (
  seqPattern: SequencePattern,
  arrayCbor: Cbor,
  arr: Cbor[],
): [Path[], Map<string, Path[]>] => {
  const assignments = findSequenceElementAssignments(seqPattern, arr);
  if (assignments === undefined) {
    return [[], new Map<string, Path[]>()];
  }

  const allCaptures = new Map<string, Path[]>();

  // Process each pattern and its assigned elements
  for (let patternIdx = 0; patternIdx < seqPattern.patterns.length; patternIdx++) {
    const pattern = seqPattern.patterns[patternIdx];

    // Check if this is a capture pattern containing a repeat pattern
    if (pattern.kind === "Meta" && pattern.pattern.type === "Capture") {
      const capturePattern = pattern.pattern.pattern;

      // Check if the capture contains a repeat pattern
      if (extractCaptureWithRepeat(pattern) !== undefined) {
        // This is a capture pattern with a repeat (like @rest((*)*)
        // We need to capture the sub-array of matched elements
        const capturedElements: Cbor[] = assignments
          .filter(([pIdx, _]) => pIdx === patternIdx)
          .map(([_, eIdx]) => arr[eIdx]);

        // Create a sub-array from the captured elements
        const subArray = cbor(capturedElements);

        // For capture patterns, we directly capture the sub-array with the capture name
        const captureName = capturePattern.name;
        const arrayContextPath = buildSimpleArrayContextPath(arrayCbor, subArray);

        const existing = allCaptures.get(captureName) ?? [];
        existing.push(arrayContextPath);
        allCaptures.set(captureName, existing);
        continue;
      }
    }

    // Check if this is a direct repeat pattern that might capture multiple elements
    if (isRepeatPattern(pattern) && pattern.kind === "Meta" && pattern.pattern.type === "Repeat") {
      const repeatPattern = pattern.pattern.pattern;

      // For repeat patterns, check if they have captures
      // by looking at the inner pattern
      const innerPattern = repeatPattern.pattern;
      if (innerPattern.kind === "Meta" && innerPattern.pattern.type === "Capture") {
        // This is a repeat pattern with captures
        const capturedElements: Cbor[] = assignments
          .filter(([pIdx, _]) => pIdx === patternIdx)
          .map(([_, eIdx]) => arr[eIdx]);

        // Create a sub-array from the captured elements
        const subArray = cbor(capturedElements);

        // Get the capture name from the inner capture pattern
        const captureName = innerPattern.pattern.pattern.name;
        const arrayContextPath = buildSimpleArrayContextPath(arrayCbor, subArray);

        const existing = allCaptures.get(captureName) ?? [];
        existing.push(arrayContextPath);
        allCaptures.set(captureName, existing);
        continue;
      }
    }

    // For non-repeat patterns or repeat patterns without captures,
    // process each assigned element individually
    const elementIndices = assignments
      .filter(([pIdx, _]) => pIdx === patternIdx)
      .map(([_, eIdx]) => eIdx);

    for (const elementIdx of elementIndices) {
      const element = arr[elementIdx];

      // Check if this pattern has any captures
      if (pattern.kind === "Meta" && pattern.pattern.type === "Capture") {
        const captureName = pattern.pattern.pattern.name;
        const arrayContextPath = buildSimpleArrayContextPath(arrayCbor, element);

        const existing = allCaptures.get(captureName) ?? [];
        existing.push(arrayContextPath);
        allCaptures.set(captureName, existing);
      }
    }
  }

  // Return the array path and all captures
  return [[[arrayCbor]], allCaptures];
};

/**
 * Tests if a CBOR value matches this array pattern.
 */
export const arrayPatternMatches = (pattern: ArrayPattern, haystack: Cbor): boolean => {
  if (!isArray(haystack)) {
    return false;
  }

  switch (pattern.variant) {
    case "Any":
      return true;
    case "Elements": {
      const arr = getArrayElements(haystack);
      if (arr === undefined) {
        return false;
      }

      const elemPattern = pattern.pattern;

      // Check pattern type for appropriate matching
      if (elemPattern.kind === "Meta") {
        if (elemPattern.pattern.type === "Sequence") {
          // Use sequence matching with backtracking
          return matchSequencePatternsAgainstArray(elemPattern.pattern.pattern, arr);
        }
        if (elemPattern.pattern.type === "Repeat") {
          // Use repeat matching
          return matchRepeatPatternAgainstArray(elemPattern.pattern.pattern, arr);
        }
        if (elemPattern.pattern.type === "Capture") {
          // For capture patterns, check if any element matches
          return arr.some((element) => matchPattern(elemPattern, element));
        }
      }

      // For value/structure patterns, require exactly one element that matches
      if (
        elemPattern.kind === "Value" ||
        elemPattern.kind === "Structure" ||
        (elemPattern.kind === "Meta" && elemPattern.pattern.type === "Any")
      ) {
        if (arr.length !== 1) {
          return false;
        }
        return matchPattern(elemPattern, arr[0]);
      }

      // For other meta patterns (or, and, etc.), check if any element matches
      return arr.some((element) => matchPattern(elemPattern, element));
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
export const arrayPatternPaths = (pattern: ArrayPattern, haystack: Cbor): Path[] => {
  if (!isArray(haystack)) {
    return [];
  }

  const arr = getArrayElements(haystack);
  if (arr === undefined) {
    return [];
  }

  switch (pattern.variant) {
    case "Any":
      return [[haystack]];

    case "Elements": {
      const elemPattern = pattern.pattern;

      // Check pattern type for appropriate matching
      if (elemPattern.kind === "Meta") {
        if (elemPattern.pattern.type === "Sequence") {
          const seqPattern = elemPattern.pattern.pattern;
          const hasRepeats = hasRepeatPatternsInSlice(seqPattern.patterns);

          if (hasRepeats) {
            // Use complex sequence matching
            return matchComplexSequence(haystack, elemPattern);
          }

          // Simple sequence: match each pattern against consecutive elements
          if (seqPattern.patterns.length === arr.length) {
            for (let i = 0; i < seqPattern.patterns.length; i++) {
              if (!matchPattern(seqPattern.patterns[i], arr[i])) {
                return [];
              }
            }
            return [[haystack]];
          }
          return [];
        }

        if (elemPattern.pattern.type === "Repeat") {
          return matchComplexSequence(haystack, elemPattern);
        }

        if (elemPattern.pattern.type === "Capture") {
          // For capture patterns, check if any element matches
          const hasMatch = arr.some((element) => matchPattern(elemPattern, element));
          return hasMatch ? [[haystack]] : [];
        }
      }

      // For value/structure patterns, require exactly one element that matches
      if (
        elemPattern.kind === "Value" ||
        elemPattern.kind === "Structure" ||
        (elemPattern.kind === "Meta" && elemPattern.pattern.type === "Any")
      ) {
        if (arr.length !== 1) {
          return [];
        }
        return matchPattern(elemPattern, arr[0]) ? [[haystack]] : [];
      }

      // For other meta patterns, check if any element matches
      const hasMatch = arr.some((element) => matchPattern(elemPattern, element));
      return hasMatch ? [[haystack]] : [];
    }

    case "Length":
      return pattern.length.contains(arr.length) ? [[haystack]] : [];
  }
};

/**
 * Returns paths with captures for array patterns.
 */
export const arrayPatternPathsWithCaptures = (
  pattern: ArrayPattern,
  haystack: Cbor,
): [Path[], Map<string, Path[]>] => {
  if (!isArray(haystack)) {
    return [[], new Map<string, Path[]>()];
  }

  const arr = getArrayElements(haystack);
  if (arr === undefined) {
    return [[], new Map<string, Path[]>()];
  }

  switch (pattern.variant) {
    case "Any":
    case "Length":
      return [arrayPatternPaths(pattern, haystack), new Map<string, Path[]>()];

    case "Elements": {
      const elemPattern = pattern.pattern;

      // Check for sequence patterns with captures
      if (elemPattern.kind === "Meta" && elemPattern.pattern.type === "Sequence") {
        const seqPattern = elemPattern.pattern.pattern;

        // First check if this pattern matches
        if (!arrayPatternMatches(pattern, haystack)) {
          return [[], new Map<string, Path[]>()];
        }

        return handleSequenceCaptures(seqPattern, haystack, arr);
      }

      // For capture patterns
      if (elemPattern.kind === "Meta" && elemPattern.pattern.type === "Capture") {
        const capturePattern = elemPattern.pattern.pattern;
        const matchingElements = arr.filter((element) => matchPattern(elemPattern, element));

        if (matchingElements.length === 0) {
          return [[], new Map<string, Path[]>()];
        }

        const captures = new Map<string, Path[]>();
        const paths: Path[] = [];

        for (const element of matchingElements) {
          paths.push(buildSimpleArrayContextPath(haystack, element));
        }

        captures.set(capturePattern.name, paths);
        return [[[haystack]], captures];
      }

      // Default: no captures
      return [arrayPatternPaths(pattern, haystack), new Map<string, Path[]>()];
    }
  }
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
    case "Elements": {
      const elemPattern = pattern.pattern;
      // For sequence patterns within arrays, format elements with commas
      if (elemPattern.kind === "Meta" && elemPattern.pattern.type === "Sequence") {
        const parts = elemPattern.pattern.pattern.patterns.map(patternDisplay);
        return `[${parts.join(", ")}]`;
      }
      return `[${patternDisplay(pattern.pattern)}]`;
    }
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
