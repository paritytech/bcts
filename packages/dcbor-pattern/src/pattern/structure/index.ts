/**
 * Structure patterns for dCBOR pattern matching.
 *
 * @module pattern/structure
 */

export * from "./array-pattern";
export * from "./map-pattern";
export * from "./tagged-pattern";

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

import {
  type ArrayPattern,
  arrayPatternPaths,
  arrayPatternDisplay,
} from "./array-pattern";
import {
  type MapPattern,
  mapPatternPaths,
  mapPatternDisplay,
} from "./map-pattern";
import {
  type TaggedPattern,
  taggedPatternPaths,
  taggedPatternDisplay,
} from "./tagged-pattern";

/**
 * Union of all structure pattern types.
 */
export type StructurePattern =
  | { readonly type: "Array"; readonly pattern: ArrayPattern }
  | { readonly type: "Map"; readonly pattern: MapPattern }
  | { readonly type: "Tagged"; readonly pattern: TaggedPattern };

/**
 * Returns paths to matching structures for a StructurePattern.
 */
export const structurePatternPaths = (
  pattern: StructurePattern,
  haystack: Cbor,
): Path[] => {
  switch (pattern.type) {
    case "Array":
      return arrayPatternPaths(pattern.pattern, haystack);
    case "Map":
      return mapPatternPaths(pattern.pattern, haystack);
    case "Tagged":
      return taggedPatternPaths(pattern.pattern, haystack);
  }
};

/**
 * Tests if a CBOR value matches a StructurePattern.
 */
export const structurePatternMatches = (
  pattern: StructurePattern,
  haystack: Cbor,
): boolean => {
  return structurePatternPaths(pattern, haystack).length > 0;
};

/**
 * Formats a StructurePattern as a string.
 */
export const structurePatternDisplay = (
  pattern: StructurePattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  switch (pattern.type) {
    case "Array":
      return arrayPatternDisplay(pattern.pattern, patternDisplay);
    case "Map":
      return mapPatternDisplay(pattern.pattern, patternDisplay);
    case "Tagged":
      return taggedPatternDisplay(pattern.pattern, patternDisplay);
  }
};

// Convenience constructors for StructurePattern

/**
 * Creates an Array StructurePattern.
 */
export const structureArray = (pattern: ArrayPattern): StructurePattern => ({
  type: "Array",
  pattern,
});

/**
 * Creates a Map StructurePattern.
 */
export const structureMap = (pattern: MapPattern): StructurePattern => ({
  type: "Map",
  pattern,
});

/**
 * Creates a Tagged StructurePattern.
 */
export const structureTagged = (pattern: TaggedPattern): StructurePattern => ({
  type: "Tagged",
  pattern,
});
