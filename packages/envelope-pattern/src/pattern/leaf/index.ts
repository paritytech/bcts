/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Leaf patterns module
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust pattern/leaf/mod.rs
 *
 * @module envelope-pattern/pattern/leaf
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Re-export all leaf pattern types
export { BoolPattern, registerBoolPatternFactory } from "./bool-pattern";
export { NullPattern, registerNullPatternFactory } from "./null-pattern";
export { NumberPattern, registerNumberPatternFactory } from "./number-pattern";
export { TextPattern, registerTextPatternFactory } from "./text-pattern";
export { ByteStringPattern, registerByteStringPatternFactory } from "./byte-string-pattern";
export { DatePattern, registerDatePatternFactory } from "./date-pattern";
export { ArrayPattern, type ArrayPatternType, registerArrayPatternFactory } from "./array-pattern";
export { MapPattern, type MapPatternType, registerMapPatternFactory } from "./map-pattern";
export { KnownValuePattern, registerKnownValuePatternFactory } from "./known-value-pattern";
export { TaggedPattern, registerTaggedPatternFactory } from "./tagged-pattern";
export { CBORPattern, type CBORPatternType, registerCBORPatternFactory } from "./cbor-pattern";

// Import concrete types for use in LeafPattern
import { type BoolPattern } from "./bool-pattern";
import { type NullPattern } from "./null-pattern";
import { type NumberPattern } from "./number-pattern";
import { type TextPattern } from "./text-pattern";
import { type ByteStringPattern } from "./byte-string-pattern";
import { type DatePattern } from "./date-pattern";
import { type ArrayPattern } from "./array-pattern";
import { type MapPattern } from "./map-pattern";
import { type KnownValuePattern } from "./known-value-pattern";
import { type TaggedPattern } from "./tagged-pattern";
import { type CBORPattern } from "./cbor-pattern";

/**
 * Union type for all leaf patterns.
 *
 * Corresponds to the Rust `LeafPattern` enum in pattern/leaf/mod.rs
 */
export type LeafPattern =
  | { readonly type: "Cbor"; readonly pattern: CBORPattern }
  | { readonly type: "Number"; readonly pattern: NumberPattern }
  | { readonly type: "Text"; readonly pattern: TextPattern }
  | { readonly type: "ByteString"; readonly pattern: ByteStringPattern }
  | { readonly type: "Tag"; readonly pattern: TaggedPattern }
  | { readonly type: "Array"; readonly pattern: ArrayPattern }
  | { readonly type: "Map"; readonly pattern: MapPattern }
  | { readonly type: "Bool"; readonly pattern: BoolPattern }
  | { readonly type: "Null"; readonly pattern: NullPattern }
  | { readonly type: "Date"; readonly pattern: DatePattern }
  | { readonly type: "KnownValue"; readonly pattern: KnownValuePattern };

/**
 * Creates a CBOR leaf pattern.
 */
export function leafCbor(pattern: CBORPattern): LeafPattern {
  return { type: "Cbor", pattern };
}

/**
 * Creates a Number leaf pattern.
 */
export function leafNumber(pattern: NumberPattern): LeafPattern {
  return { type: "Number", pattern };
}

/**
 * Creates a Text leaf pattern.
 */
export function leafText(pattern: TextPattern): LeafPattern {
  return { type: "Text", pattern };
}

/**
 * Creates a ByteString leaf pattern.
 */
export function leafByteString(pattern: ByteStringPattern): LeafPattern {
  return { type: "ByteString", pattern };
}

/**
 * Creates a Tag leaf pattern.
 */
export function leafTag(pattern: TaggedPattern): LeafPattern {
  return { type: "Tag", pattern };
}

/**
 * Creates an Array leaf pattern.
 */
export function leafArray(pattern: ArrayPattern): LeafPattern {
  return { type: "Array", pattern };
}

/**
 * Creates a Map leaf pattern.
 */
export function leafMap(pattern: MapPattern): LeafPattern {
  return { type: "Map", pattern };
}

/**
 * Creates a Bool leaf pattern.
 */
export function leafBool(pattern: BoolPattern): LeafPattern {
  return { type: "Bool", pattern };
}

/**
 * Creates a Null leaf pattern.
 */
export function leafNull(pattern: NullPattern): LeafPattern {
  return { type: "Null", pattern };
}

/**
 * Creates a Date leaf pattern.
 */
export function leafDate(pattern: DatePattern): LeafPattern {
  return { type: "Date", pattern };
}

/**
 * Creates a KnownValue leaf pattern.
 */
export function leafKnownValue(pattern: KnownValuePattern): LeafPattern {
  return { type: "KnownValue", pattern };
}

/**
 * Gets paths with captures for a leaf pattern.
 */
export function leafPatternPathsWithCaptures(
  pattern: LeafPattern,
  haystack: Envelope,
): [Path[], Map<string, Path[]>] {
  switch (pattern.type) {
    case "Cbor":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Number":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Text":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "ByteString":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Tag":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Array":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Map":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Bool":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Null":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Date":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "KnownValue":
      return pattern.pattern.pathsWithCaptures(haystack);
  }
}

/**
 * Gets paths for a leaf pattern.
 */
export function leafPatternPaths(pattern: LeafPattern, haystack: Envelope): Path[] {
  return leafPatternPathsWithCaptures(pattern, haystack)[0];
}

/**
 * Compiles a leaf pattern to bytecode.
 */
export function leafPatternCompile(
  pattern: LeafPattern,
  code: Instr[],
  literals: Pattern[],
  captures: string[],
): void {
  switch (pattern.type) {
    case "Cbor":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Number":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Text":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "ByteString":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Tag":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Array":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Map":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Bool":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Null":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Date":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "KnownValue":
      pattern.pattern.compile(code, literals, captures);
      break;
  }
}

/**
 * Checks if a leaf pattern is complex.
 */
export function leafPatternIsComplex(pattern: LeafPattern): boolean {
  switch (pattern.type) {
    case "Cbor":
      return pattern.pattern.isComplex();
    case "Number":
      return pattern.pattern.isComplex();
    case "Text":
      return pattern.pattern.isComplex();
    case "ByteString":
      return pattern.pattern.isComplex();
    case "Tag":
      return pattern.pattern.isComplex();
    case "Array":
      return pattern.pattern.isComplex();
    case "Map":
      return pattern.pattern.isComplex();
    case "Bool":
      return pattern.pattern.isComplex();
    case "Null":
      return pattern.pattern.isComplex();
    case "Date":
      return pattern.pattern.isComplex();
    case "KnownValue":
      return pattern.pattern.isComplex();
  }
}

/**
 * Converts a leaf pattern to string.
 */
export function leafPatternToString(pattern: LeafPattern): string {
  switch (pattern.type) {
    case "Cbor":
      return pattern.pattern.toString();
    case "Number":
      return pattern.pattern.toString();
    case "Text":
      return pattern.pattern.toString();
    case "ByteString":
      return pattern.pattern.toString();
    case "Tag":
      return pattern.pattern.toString();
    case "Array":
      return pattern.pattern.toString();
    case "Map":
      return pattern.pattern.toString();
    case "Bool":
      return pattern.pattern.toString();
    case "Null":
      return pattern.pattern.toString();
    case "Date":
      return pattern.pattern.toString();
    case "KnownValue":
      return pattern.pattern.toString();
  }
}
