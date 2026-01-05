/**
 * @bcts/envelope-pattern - And pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust and_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/and-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import { type Matcher, matchPattern } from "../matcher";
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
  readonly #patterns: Pattern[];

  private constructor(patterns: Pattern[]) {
    this.#patterns = patterns;
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
    return this.#patterns;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const allMatch = this.#patterns.every((pattern) => matchPattern(pattern, haystack));

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
    for (const pattern of this.#patterns) {
      const matcher = pattern as unknown as Matcher;
      matcher.compile(code, literals, captures);
    }
  }

  isComplex(): boolean {
    // The pattern is complex if it contains more than one pattern, or if
    // the one pattern is complex itself.
    return (
      this.#patterns.length > 1 || this.#patterns.some((p) => (p as unknown as Matcher).isComplex())
    );
  }

  toString(): string {
    return this.#patterns
      .map((p) => (p as unknown as { toString(): string }).toString())
      .join(" & ");
  }

  /**
   * Equality comparison.
   */
  equals(other: AndPattern): boolean {
    if (this.#patterns.length !== other.#patterns.length) {
      return false;
    }
    for (let i = 0; i < this.#patterns.length; i++) {
      if (this.#patterns[i] !== other.#patterns[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return this.#patterns.length;
  }
}
