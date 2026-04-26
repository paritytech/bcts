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
import { matchPattern, getPatternPathsWithCaptures } from "../../match-registry";
import { collectPatternCaptureNames } from "../../matcher";
import {
  hasRepeatPatternsInSlice,
  extractCaptureWithRepeat,
  isRepeatPattern,
  buildSimpleArrayContextPath,
  formatArrayElementPattern,
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

      // **DP1 — mirror Rust
      // `bc-dcbor-pattern-rust/src/pattern/structure/array_pattern/mod.rs::
      // ArrayPattern::paths_with_captures` (lines 520-650).**
      //
      // Rust dispatches:
      //   1. If inner has no captures → fast path (paths + empty map).
      //   2. If inner is `Sequence` with captures → `handle_sequence_captures`.
      //   3. If inner is `Capture` or any other non-Sequence with captures
      //      → wrap the ArrayPattern as `Pattern::Structure` and compile +
      //      run via the VM. The compile path emits
      //      `MatchStructure(Array::Any) + PushAxis(ArrayElement) +
      //      <inner.compile> + Pop`, which gives proper backtracking and
      //      capture collection (e.g. `[@a((number)*)]`,
      //      `[@a(num) | @b(text)]`).
      //
      // The previous TS implementation used `arr.filter(matchPattern(...))`
      // for the Capture case and dropped captures entirely for the
      // non-Sequence/non-Capture fall-through, which produced different
      // results from Rust for backtracking and Or/And-with-capture
      // patterns. This routes through the VM exactly like Rust.

      const innerCaptureNames: string[] = [];
      collectPatternCaptureNames(elemPattern, innerCaptureNames);

      if (innerCaptureNames.length === 0) {
        // Fast path — no captures in the element pattern. Mirrors Rust
        // `paths_with_captures` lines ~530-540.
        return [arrayPatternPaths(pattern, haystack), new Map<string, Path[]>()];
      }

      // Verify the array pattern matches at all before doing the more
      // expensive capture work. Mirrors Rust `paths_with_captures`
      // line ~550 (`if self.paths(cbor).is_empty() { return empty; }`).
      const matchPaths = arrayPatternPaths(pattern, haystack);
      if (matchPaths.length === 0) {
        return [[], new Map<string, Path[]>()];
      }

      // Sequence inner — positional element-wise matching. Mirrors Rust
      // `paths_with_captures` lines 557-567.
      if (elemPattern.kind === "Meta" && elemPattern.pattern.type === "Sequence") {
        const seqPattern = elemPattern.pattern.pattern;
        return handleSequenceCaptures(seqPattern, haystack, arr);
      }

      // Capture or other non-Sequence with captures — route through the
      // VM. Mirrors Rust `paths_with_captures` lines 568-637 (both
      // the `MetaPattern::Capture` arm and the `_ => ...` arm wrap the
      // ArrayPattern as `Pattern::Structure(Array)` and compile + run).
      const wrappedPattern: Pattern = {
        kind: "Structure",
        pattern: { type: "Array", pattern },
      };
      const result = getPatternPathsWithCaptures(wrappedPattern, haystack);
      return [result.paths, result.captures];
    }
  }
};

/**
 * Formats an ArrayPattern as a string.
 */
export const arrayPatternDisplay = (
  pattern: ArrayPattern,
  // The dispatch helper reaches into the pattern via
  // `formatArrayElementPattern`, which already calls back into the
  // top-level `patternDisplay` itself; the dispatch parameter is
  // therefore unused but kept for signature parity with sibling
  // formatters in the discriminated-union dispatch table.
  _patternDisplay: (p: Pattern) => string,
): string => {
  switch (pattern.variant) {
    case "Any":
      return "array";
    case "Elements": {
      // Use the recursive `formatArrayElementPattern` helper so any
      // `Sequence` patterns *nested* inside the element pattern (e.g.
      // `[(a > b)*]` would otherwise emit `[(a > b)*]` with the
      // `>`-separator inside the `()`) are also re-rendered with
      // `,`-separators. Mirrors Rust
      // `format_array_element_pattern` from
      // `bc-dcbor-pattern-rust/src/pattern/structure/array_pattern/helpers.rs:54-67`.
      return `[${formatArrayElementPattern(pattern.pattern)}]`;
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
