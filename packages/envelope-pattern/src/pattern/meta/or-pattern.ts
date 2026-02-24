/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Or pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust or_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/or-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import {
  dispatchPathsWithCaptures,
  dispatchCompile,
  dispatchIsComplex,
  dispatchPatternToString,
} from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";
import type { Matcher } from "../matcher";

// Forward declaration for Pattern factory (used for late binding)
export let createMetaOrPattern: ((pattern: OrPattern) => Pattern) | undefined;

export function registerOrPatternFactory(factory: (pattern: OrPattern) => Pattern): void {
  createMetaOrPattern = factory;
}

/**
 * A pattern that matches if any contained pattern matches.
 *
 * Corresponds to the Rust `OrPattern` struct in or_pattern.rs
 */
export class OrPattern implements Matcher {
  private readonly _patterns: Pattern[];

  private constructor(patterns: Pattern[]) {
    this._patterns = patterns;
  }

  /**
   * Creates a new OrPattern with the given patterns.
   */
  static new(patterns: Pattern[]): OrPattern {
    return new OrPattern(patterns);
  }

  /**
   * Gets the patterns.
   */
  patterns(): Pattern[] {
    return this._patterns;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // Try each pattern and return paths+captures from the first match
    for (const pattern of this._patterns) {
      const [paths, captures] = dispatchPathsWithCaptures(pattern, haystack);
      if (paths.length > 0) {
        return [paths, captures];
      }
    }
    return [[], new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (this._patterns.length === 0) {
      return;
    }

    // For N patterns: Split(p1, Split(p2, ... Split(pN-1, pN)))
    const splits: number[] = [];

    // Generate splits for all but the last pattern
    for (let i = 0; i < this._patterns.length - 1; i++) {
      splits.push(code.length);
      code.push({ type: "Split", a: 0, b: 0 }); // Placeholder
    }

    // Track jump instructions that need patching
    const jumps: number[] = [];

    // Now fill in the actual split targets
    for (let i = 0; i < this._patterns.length; i++) {
      const patternStart = code.length;

      // Compile this pattern
      const pattern = this._patterns[i];
      dispatchCompile(pattern, code, literals, captures);

      // This pattern will jump to the end if it matches
      const jumpPastAll = code.length;
      code.push({ type: "Jump", address: 0 }); // Placeholder
      jumps.push(jumpPastAll);

      // If there's a next pattern, update the split to point here
      if (i < this._patterns.length - 1) {
        const nextPattern = code.length;
        code[splits[i]] = { type: "Split", a: patternStart, b: nextPattern };
      }
    }

    // Now patch all the jumps to point past all the patterns
    const pastAll = code.length;
    for (const jumpIdx of jumps) {
      code[jumpIdx] = { type: "Jump", address: pastAll };
    }
  }

  isComplex(): boolean {
    // The pattern is complex if it contains more than one pattern, or if
    // the one pattern is complex itself.
    return this._patterns.length > 1 || this._patterns.some((p) => dispatchIsComplex(p));
  }

  toString(): string {
    return this._patterns.map((p) => dispatchPatternToString(p)).join(" | ");
  }

  /**
   * Equality comparison.
   */
  equals(other: OrPattern): boolean {
    if (this._patterns.length !== other._patterns.length) {
      return false;
    }
    for (let i = 0; i < this._patterns.length; i++) {
      if (this._patterns[i] !== other._patterns[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return this._patterns.length;
  }
}
