/**
 * @bcts/envelope-pattern - And pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust and_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/and-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import {
  matchPattern,
  dispatchCompile,
  dispatchIsComplex,
  dispatchPatternToString,
} from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory (used for late binding)
export let createMetaAndPattern: ((pattern: AndPattern) => Pattern) | undefined;

export function registerAndPatternFactory(factory: (pattern: AndPattern) => Pattern): void {
  createMetaAndPattern = factory;
}

/**
 * A pattern that matches if all contained patterns match.
 *
 * Corresponds to the Rust `AndPattern` struct in and_pattern.rs
 */
export class AndPattern implements Matcher {
  private readonly _patterns: Pattern[];

  private constructor(patterns: Pattern[]) {
    this._patterns = patterns;
  }

  /**
   * Creates a new AndPattern with the given patterns.
   */
  static new(patterns: Pattern[]): AndPattern {
    return new AndPattern(patterns);
  }

  /**
   * Gets the patterns.
   */
  patterns(): Pattern[] {
    return this._patterns;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const allMatch = this._patterns.every((pattern) => matchPattern(pattern, haystack));

    const paths = allMatch ? [[haystack]] : [];
    return [paths, new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    // Each pattern must match at this position
    for (const pattern of this._patterns) {
      dispatchCompile(pattern, code, literals, captures);
    }
  }

  isComplex(): boolean {
    // The pattern is complex if it contains more than one pattern, or if
    // the one pattern is complex itself.
    return this._patterns.length > 1 || this._patterns.some((p) => dispatchIsComplex(p));
  }

  toString(): string {
    return this._patterns.map((p) => dispatchPatternToString(p)).join(" & ");
  }

  /**
   * Equality comparison.
   */
  equals(other: AndPattern): boolean {
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
