/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Traverse pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust traverse_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/traverse-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory (used for late binding)
export let createMetaTraversePattern: ((pattern: TraversePattern) => Pattern) | undefined;

export function registerTraversePatternFactory(
  factory: (pattern: TraversePattern) => Pattern,
): void {
  createMetaTraversePattern = factory;
}

// Late-binding dispatch functions to avoid circular dependency with Pattern
let _patternPathsWithCaptures:
  | ((pattern: Pattern, haystack: Envelope) => [Path[], Map<string, Path[]>])
  | undefined;
let _patternCompile:
  | ((pattern: Pattern, code: Instr[], literals: Pattern[], captures: string[]) => void)
  | undefined;
let _patternIsComplex: ((pattern: Pattern) => boolean) | undefined;

export function registerTraverseDispatchFunctions(
  pathsWithCaptures: (pattern: Pattern, haystack: Envelope) => [Path[], Map<string, Path[]>],
  compile: (pattern: Pattern, code: Instr[], literals: Pattern[], captures: string[]) => void,
  isComplex: (pattern: Pattern) => boolean,
): void {
  _patternPathsWithCaptures = pathsWithCaptures;
  _patternCompile = compile;
  _patternIsComplex = isComplex;
}

/**
 * A pattern that matches a traversal order of patterns.
 *
 * Corresponds to the Rust `TraversePattern` struct in traverse_pattern.rs
 */
export class TraversePattern implements Matcher {
  private readonly _first: Pattern;
  private readonly _rest: TraversePattern | undefined;

  private constructor(first: Pattern, rest: TraversePattern | undefined) {
    this._first = first;
    this._rest = rest;
  }

  /**
   * Creates a new TraversePattern with the given patterns.
   */
  static new(patterns: Pattern[]): TraversePattern {
    if (patterns.length === 0) {
      throw new Error("TraversePattern requires at least one pattern");
    }

    const firstPat = patterns[0];
    const restPatterns = patterns.slice(1);
    const rest = restPatterns.length === 0 ? undefined : TraversePattern.new(restPatterns);
    return new TraversePattern(firstPat, rest);
  }

  /**
   * Gets all patterns in this traversal.
   */
  patterns(): Pattern[] {
    const result: Pattern[] = [this._first];
    if (this._rest !== undefined) {
      result.push(...this._rest.patterns());
    }
    return result;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    if (_patternPathsWithCaptures === undefined) {
      throw new Error("TraversePattern dispatch functions not registered");
    }
    const headPaths = _patternPathsWithCaptures(this._first, haystack)[0];

    // If there's no further traversal, return head paths
    if (this._rest === undefined) {
      return [headPaths, new Map<string, Path[]>()];
    }

    const result: Path[] = [];
    for (const path of headPaths) {
      const lastEnv = path[path.length - 1];
      if (lastEnv !== undefined) {
        // Recursively match the rest of the traversal
        const tailPaths = this._rest.paths(lastEnv);
        for (const tailPath of tailPaths) {
          const combined = [...path, ...tailPath];
          result.push(combined);
        }
      }
    }

    return [result, new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (_patternCompile === undefined) {
      throw new Error("TraversePattern dispatch functions not registered");
    }
    // Compile the first pattern
    _patternCompile(this._first, code, literals, captures);

    if (this._rest !== undefined) {
      // Save the current path and switch to last envelope
      code.push({ type: "ExtendTraversal" });
      // Compile the rest of the traversal
      this._rest.compile(code, literals, captures);
      // Combine the paths correctly
      code.push({ type: "CombineTraversal" });
    }
  }

  isComplex(): boolean {
    if (_patternIsComplex === undefined) {
      throw new Error("TraversePattern dispatch functions not registered");
    }
    return _patternIsComplex(this._first) || this._rest !== undefined;
  }

  toString(): string {
    return this.patterns()
      .map((p) => (p as unknown as { toString(): string }).toString())
      .join(" -> ");
  }

  /**
   * Equality comparison.
   */
  equals(other: TraversePattern): boolean {
    const thisPatterns = this.patterns();
    const otherPatterns = other.patterns();
    if (thisPatterns.length !== otherPatterns.length) {
      return false;
    }
    for (let i = 0; i < thisPatterns.length; i++) {
      if (thisPatterns[i] !== otherPatterns[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return this.patterns().length;
  }
}
