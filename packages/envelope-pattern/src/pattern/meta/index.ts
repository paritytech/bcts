/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Meta patterns module
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust pattern/meta/mod.rs
 *
 * @module envelope-pattern/pattern/meta
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Re-export all meta pattern types
export { AnyPattern, registerAnyPatternFactory } from "./any-pattern";
export { AndPattern, registerAndPatternFactory } from "./and-pattern";
export { OrPattern, registerOrPatternFactory } from "./or-pattern";
export { NotPattern, registerNotPatternFactory } from "./not-pattern";
export { CapturePattern, registerCapturePatternFactory } from "./capture-pattern";
export { SearchPattern, registerSearchPatternFactory } from "./search-pattern";
export { TraversePattern, registerTraversePatternFactory } from "./traverse-pattern";
export { GroupPattern, registerGroupPatternFactory } from "./group-pattern";

// Import concrete types for use in MetaPattern
import { type AnyPattern } from "./any-pattern";
import { type AndPattern } from "./and-pattern";
import { type OrPattern } from "./or-pattern";
import { type NotPattern } from "./not-pattern";
import { type CapturePattern } from "./capture-pattern";
import { type SearchPattern } from "./search-pattern";
import { type TraversePattern } from "./traverse-pattern";
import { type GroupPattern } from "./group-pattern";

/**
 * Union type for all meta patterns.
 *
 * Corresponds to the Rust `MetaPattern` enum in pattern/meta/mod.rs
 */
export type MetaPattern =
  | { readonly type: "Any"; readonly pattern: AnyPattern }
  | { readonly type: "And"; readonly pattern: AndPattern }
  | { readonly type: "Or"; readonly pattern: OrPattern }
  | { readonly type: "Not"; readonly pattern: NotPattern }
  | { readonly type: "Capture"; readonly pattern: CapturePattern }
  | { readonly type: "Search"; readonly pattern: SearchPattern }
  | { readonly type: "Traverse"; readonly pattern: TraversePattern }
  | { readonly type: "Group"; readonly pattern: GroupPattern };

/**
 * Creates an Any meta pattern.
 */
export function metaAny(pattern: AnyPattern): MetaPattern {
  return { type: "Any", pattern };
}

/**
 * Creates an And meta pattern.
 */
export function metaAnd(pattern: AndPattern): MetaPattern {
  return { type: "And", pattern };
}

/**
 * Creates an Or meta pattern.
 */
export function metaOr(pattern: OrPattern): MetaPattern {
  return { type: "Or", pattern };
}

/**
 * Creates a Not meta pattern.
 */
export function metaNot(pattern: NotPattern): MetaPattern {
  return { type: "Not", pattern };
}

/**
 * Creates a Capture meta pattern.
 */
export function metaCapture(pattern: CapturePattern): MetaPattern {
  return { type: "Capture", pattern };
}

/**
 * Creates a Search meta pattern.
 */
export function metaSearch(pattern: SearchPattern): MetaPattern {
  return { type: "Search", pattern };
}

/**
 * Creates a Traverse meta pattern.
 */
export function metaTraverse(pattern: TraversePattern): MetaPattern {
  return { type: "Traverse", pattern };
}

/**
 * Creates a Group meta pattern.
 */
export function metaGroup(pattern: GroupPattern): MetaPattern {
  return { type: "Group", pattern };
}

/**
 * Gets paths with captures for a meta pattern.
 */
export function metaPatternPathsWithCaptures(
  pattern: MetaPattern,
  haystack: Envelope,
): [Path[], Map<string, Path[]>] {
  switch (pattern.type) {
    case "Any":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "And":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Or":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Not":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Capture":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Search":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Traverse":
      return pattern.pattern.pathsWithCaptures(haystack);
    case "Group":
      return pattern.pattern.pathsWithCaptures(haystack);
  }
}

/**
 * Compiles a meta pattern to bytecode.
 */
export function metaPatternCompile(
  pattern: MetaPattern,
  code: Instr[],
  literals: Pattern[],
  captures: string[],
): void {
  switch (pattern.type) {
    case "Any":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "And":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Or":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Not":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Capture":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Search":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Traverse":
      pattern.pattern.compile(code, literals, captures);
      break;
    case "Group":
      pattern.pattern.compile(code, literals, captures);
      break;
  }
}

/**
 * Checks if a meta pattern is complex.
 */
export function metaPatternIsComplex(pattern: MetaPattern): boolean {
  switch (pattern.type) {
    case "Any":
      return pattern.pattern.isComplex();
    case "And":
      return pattern.pattern.isComplex();
    case "Or":
      return pattern.pattern.isComplex();
    case "Not":
      return pattern.pattern.isComplex();
    case "Capture":
      return pattern.pattern.isComplex();
    case "Search":
      return pattern.pattern.isComplex();
    case "Traverse":
      return pattern.pattern.isComplex();
    case "Group":
      return pattern.pattern.isComplex();
  }
}

/**
 * Converts a meta pattern to string.
 */
export function metaPatternToString(pattern: MetaPattern): string {
  switch (pattern.type) {
    case "Any":
      return pattern.pattern.toString();
    case "And":
      return pattern.pattern.toString();
    case "Or":
      return pattern.pattern.toString();
    case "Not":
      return pattern.pattern.toString();
    case "Capture":
      return pattern.pattern.toString();
    case "Search":
      return pattern.pattern.toString();
    case "Traverse":
      return pattern.pattern.toString();
    case "Group":
      return pattern.pattern.toString();
  }
}

/**
 * Collects capture names from a meta pattern.
 */
export function metaPatternCollectCaptureNames(pattern: MetaPattern, out: string[]): void {
  switch (pattern.type) {
    case "Any":
      // No captures
      break;
    case "And":
      for (const pat of pattern.pattern.patterns()) {
        collectCaptureNamesFromPattern(pat, out);
      }
      break;
    case "Or":
      for (const pat of pattern.pattern.patterns()) {
        collectCaptureNamesFromPattern(pat, out);
      }
      break;
    case "Not":
      collectCaptureNamesFromPattern(pattern.pattern.pattern(), out);
      break;
    case "Capture": {
      const name = pattern.pattern.name();
      if (!out.includes(name)) {
        out.push(name);
      }
      collectCaptureNamesFromPattern(pattern.pattern.pattern(), out);
      break;
    }
    case "Search":
      collectCaptureNamesFromPattern(pattern.pattern.pattern(), out);
      break;
    case "Traverse":
      for (const pat of pattern.pattern.patterns()) {
        collectCaptureNamesFromPattern(pat, out);
      }
      break;
    case "Group":
      collectCaptureNamesFromPattern(pattern.pattern.pattern(), out);
      break;
  }
}

/**
 * Helper to collect capture names from any Pattern.
 */
function collectCaptureNamesFromPattern(pattern: Pattern, out: string[]): void {
  // This will be properly implemented when Pattern type is fully defined
  const p = pattern as unknown as { collectCaptureNames?: (out: string[]) => void };
  if (p.collectCaptureNames !== undefined) {
    p.collectCaptureNames(out);
  }
}
