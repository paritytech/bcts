/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Matcher interface
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust matcher.rs
 *
 * @module envelope-pattern/pattern/matcher
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../format";
import type { Pattern } from "./index";
import type { Instr } from "./vm";

/**
 * Matcher interface for pattern matching against envelopes.
 *
 * Corresponds to the Rust `Matcher` trait in matcher.rs
 */
export interface Matcher {
  /**
   * Return all matching paths along with any named captures.
   */
  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>];

  /**
   * Return only the matching paths, discarding any captures.
   */
  paths(haystack: Envelope): Path[];

  /**
   * Returns true if the pattern matches the haystack.
   */
  matches(haystack: Envelope): boolean;

  /**
   * Compile this pattern to bytecode.
   */
  compile(code: Instr[], literals: Pattern[], captures: string[]): void;

  /**
   * Returns true if the Display of the matcher is complex,
   * i.e. contains nested patterns or other complex structures
   * that require its text rendering to be surrounded by grouping
   * parentheses.
   */
  isComplex(): boolean;
}

/**
 * Default implementations for Matcher methods.
 */
export const MatcherDefaults = {
  /**
   * Default implementation of paths() - calls pathsWithCaptures and discards captures.
   */
  paths(matcher: Matcher, haystack: Envelope): Path[] {
    return matcher.pathsWithCaptures(haystack)[0];
  },

  /**
   * Default implementation of matches() - checks if paths() returns any results.
   */
  matches(matcher: Matcher, haystack: Envelope): boolean {
    return matcher.paths(haystack).length > 0;
  },

  /**
   * Default implementation of isComplex() - returns false.
   */
  isComplex(): boolean {
    return false;
  },
};

/**
 * Helper to compile a pattern as an atomic predicate match.
 * Pushes the pattern into literals and emits a single MatchPredicate instruction.
 */
export function compileAsAtomic(
  pat: Pattern,
  code: Instr[],
  literals: Pattern[],
  _captures: string[],
): void {
  const idx = literals.length;
  literals.push(pat);
  code.push({ type: "MatchPredicate", literalIndex: idx });
}

// ============================================================================
// Pattern Dispatch Registry
// ============================================================================

/**
 * Registry for pattern dispatch functions to break circular dependencies.
 * This allows meta patterns to dispatch to child patterns without importing from index.ts.
 */
let patternMatchFn: ((pattern: Pattern, haystack: Envelope) => boolean) | undefined;
let patternPathsWithCapturesFn:
  | ((pattern: Pattern, haystack: Envelope) => [Path[], Map<string, Path[]>])
  | undefined;
let patternPathsFn: ((pattern: Pattern, haystack: Envelope) => Path[]) | undefined;
let patternCompileFn:
  | ((pattern: Pattern, code: Instr[], literals: Pattern[], captures: string[]) => void)
  | undefined;
let patternIsComplexFn: ((pattern: Pattern) => boolean) | undefined;
let patternToStringFn: ((pattern: Pattern) => string) | undefined;

/**
 * Registers the pattern match function.
 * Called from index.ts after all patterns are defined.
 */
export function registerPatternMatchFn(
  fn: (pattern: Pattern, haystack: Envelope) => boolean,
): void {
  patternMatchFn = fn;
}

/**
 * Registers all pattern dispatch functions.
 * Called from index.ts after all patterns are defined.
 */
export function registerPatternDispatchFns(fns: {
  pathsWithCaptures: (pattern: Pattern, haystack: Envelope) => [Path[], Map<string, Path[]>];
  paths: (pattern: Pattern, haystack: Envelope) => Path[];
  compile: (pattern: Pattern, code: Instr[], literals: Pattern[], captures: string[]) => void;
  isComplex: (pattern: Pattern) => boolean;
  toString: (pattern: Pattern) => string;
}): void {
  patternPathsWithCapturesFn = fns.pathsWithCaptures;
  patternPathsFn = fns.paths;
  patternCompileFn = fns.compile;
  patternIsComplexFn = fns.isComplex;
  patternToStringFn = fns.toString;
}

/**
 * Match a pattern against an envelope using the registered match function.
 * Used by meta patterns to match child patterns.
 */
export function matchPattern(pattern: Pattern, haystack: Envelope): boolean {
  if (patternMatchFn === undefined) {
    throw new Error("Pattern match function not registered");
  }
  return patternMatchFn(pattern, haystack);
}

/**
 * Dispatch pathsWithCaptures on a Pattern.
 */
export function dispatchPathsWithCaptures(
  pattern: Pattern,
  haystack: Envelope,
): [Path[], Map<string, Path[]>] {
  if (patternPathsWithCapturesFn === undefined) {
    throw new Error("Pattern dispatch functions not registered");
  }
  return patternPathsWithCapturesFn(pattern, haystack);
}

/**
 * Dispatch paths on a Pattern.
 */
export function dispatchPaths(pattern: Pattern, haystack: Envelope): Path[] {
  if (patternPathsFn === undefined) {
    throw new Error("Pattern dispatch functions not registered");
  }
  return patternPathsFn(pattern, haystack);
}

/**
 * Dispatch compile on a Pattern.
 */
export function dispatchCompile(
  pattern: Pattern,
  code: Instr[],
  literals: Pattern[],
  captures: string[],
): void {
  if (patternCompileFn === undefined) {
    throw new Error("Pattern dispatch functions not registered");
  }
  patternCompileFn(pattern, code, literals, captures);
}

/**
 * Dispatch isComplex on a Pattern.
 */
export function dispatchIsComplex(pattern: Pattern): boolean {
  if (patternIsComplexFn === undefined) {
    throw new Error("Pattern dispatch functions not registered");
  }
  return patternIsComplexFn(pattern);
}

/**
 * Dispatch toString on a Pattern.
 */
export function dispatchPatternToString(pattern: Pattern): string {
  if (patternToStringFn === undefined) {
    throw new Error("Pattern dispatch functions not registered");
  }
  return patternToStringFn(pattern);
}
