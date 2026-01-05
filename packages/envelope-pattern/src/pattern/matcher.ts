/**
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
// Pattern Match Registry
// ============================================================================

/**
 * Registry for pattern matching function to break circular dependencies.
 * This allows meta patterns to match child patterns without importing from index.ts.
 */
let patternMatchFn: ((pattern: Pattern, haystack: Envelope) => boolean) | undefined;

/**
 * Registers the pattern match function.
 * Called from index.ts after all patterns are defined.
 */
export function registerPatternMatchFn(
  fn: (pattern: Pattern, haystack: Envelope) => boolean
): void {
  patternMatchFn = fn;
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
