/**
 * Helper functions for array pattern matching.
 *
 * @module pattern/structure/array-pattern/helpers
 */

import type { Cbor } from "@bcts/dcbor";
import type { Pattern } from "../../index";
import type { RepeatPattern } from "../../meta/repeat-pattern";
import type { Quantifier } from "../../../quantifier";

/**
 * Check if a pattern is a repeat pattern.
 */
export const isRepeatPattern = (pattern: Pattern): boolean => {
  return pattern.kind === "Meta" && pattern.pattern.type === "Repeat";
};

/**
 * Check if a pattern is a capture pattern containing a repeat pattern.
 * Returns the inner repeat pattern if found.
 */
export const extractCaptureWithRepeat = (pattern: Pattern): RepeatPattern | undefined => {
  if (pattern.kind === "Meta" && pattern.pattern.type === "Capture") {
    const capturePattern = pattern.pattern.pattern;
    const innerPattern = capturePattern.pattern;
    if (innerPattern.kind === "Meta" && innerPattern.pattern.type === "Repeat") {
      return innerPattern.pattern.pattern;
    }
  }
  return undefined;
};

/**
 * Extract any repeat pattern from a pattern, whether direct or within a capture.
 */
export const extractRepeatPattern = (pattern: Pattern): RepeatPattern | undefined => {
  if (pattern.kind === "Meta") {
    if (pattern.pattern.type === "Repeat") {
      return pattern.pattern.pattern;
    }
    if (pattern.pattern.type === "Capture") {
      const capturePattern = pattern.pattern.pattern;
      const innerPattern = capturePattern.pattern;
      if (innerPattern.kind === "Meta" && innerPattern.pattern.type === "Repeat") {
        return innerPattern.pattern.pattern;
      }
    }
  }
  return undefined;
};

/**
 * Check if a slice of patterns contains any repeat patterns (direct or in captures).
 */
export const hasRepeatPatternsInSlice = (patterns: Pattern[]): boolean => {
  return patterns.some((p) => extractRepeatPattern(p) !== undefined);
};

/**
 * Calculate the bounds for repeat pattern matching based on quantifier and
 * available elements.
 */
export const calculateRepeatBounds = (
  quantifier: Quantifier,
  elementIdx: number,
  arrLen: number,
): [number, number] => {
  const minCount = quantifier.min();
  const remainingElements = Math.max(0, arrLen - elementIdx);
  const maxCount = Math.min(quantifier.max() ?? remainingElements, remainingElements);
  return [minCount, maxCount];
};

/**
 * Check if a repeat pattern can match a specific number of elements starting
 * at elementIdx.
 */
export const canRepeatMatch = (
  repeatPattern: RepeatPattern,
  arr: Cbor[],
  elementIdx: number,
  repCount: number,
  matchFn: (pattern: Pattern, value: Cbor) => boolean,
): boolean => {
  if (repCount === 0) {
    return true; // Zero repetitions always match
  }
  for (let i = 0; i < repCount; i++) {
    const element = arr[elementIdx + i];
    if (!matchFn(repeatPattern.pattern, element)) {
      return false;
    }
  }
  return true;
};

/**
 * Build a simple array context path: [arrayCbor, element]
 */
export const buildSimpleArrayContextPath = (arrayCbor: Cbor, element: Cbor): Cbor[] => {
  return [arrayCbor, element];
};

/**
 * Build an extended array context path: [arrayCbor, element] + capturedPath
 * (skip first element)
 */
export const buildExtendedArrayContextPath = (
  arrayCbor: Cbor,
  element: Cbor,
  capturedPath: Cbor[],
): Cbor[] => {
  const arrayPath: Cbor[] = [arrayCbor, element];
  if (capturedPath.length > 1) {
    arrayPath.push(...capturedPath.slice(1));
  }
  return arrayPath;
};

/**
 * Transform nested captures to include array context, extending allCaptures.
 */
export const transformCapturesWithArrayContext = (
  arrayCbor: Cbor,
  element: Cbor,
  nestedCaptures: Map<string, Cbor[][]>,
  allCaptures: Map<string, Cbor[][]>,
): void => {
  for (const [captureName, capturedPaths] of nestedCaptures) {
    const arrayContextPaths: Cbor[][] = [];
    for (const capturedPath of capturedPaths) {
      const arrayPath = buildExtendedArrayContextPath(arrayCbor, element, capturedPath);
      arrayContextPaths.push(arrayPath);
    }
    const existing = allCaptures.get(captureName) ?? [];
    existing.push(...arrayContextPaths);
    allCaptures.set(captureName, existing);
  }
};
