/**
 * @bcts/envelope-pattern - Not pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust not_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/not-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import { type Matcher, matchPattern } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory (used for late binding)
export let createMetaNotPattern: ((pattern: NotPattern) => Pattern) | undefined;

export function registerNotPatternFactory(factory: (pattern: NotPattern) => Pattern): void {
  createMetaNotPattern = factory;
}

/**
 * A pattern that negates another pattern; matches when the inner pattern does not match.
 *
 * Corresponds to the Rust `NotPattern` struct in not_pattern.rs
 */
export class NotPattern implements Matcher {
  readonly #pattern: Pattern;

  private constructor(pattern: Pattern) {
    this.#pattern = pattern;
  }

  /**
   * Creates a new NotPattern with the given pattern.
   */
  static new(pattern: Pattern): NotPattern {
    return new NotPattern(pattern);
  }

  /**
   * Gets the inner pattern.
   */
  pattern(): Pattern {
    return this.#pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // If the inner pattern doesn't match, then we return the current envelope as a match
    const paths = !matchPattern(this.#pattern, haystack) ? [[haystack]] : [];
    return [paths, new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], _captures: string[]): void {
    // NOT = check that pattern doesn't match
    const idx = literals.length;
    literals.push(this.#pattern);
    code.push({ type: "NotMatch", patternIndex: idx });
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return `!${(this.#pattern as unknown as { toString(): string }).toString()}`;
  }

  /**
   * Equality comparison.
   */
  equals(other: NotPattern): boolean {
    return this.#pattern === other.#pattern;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return 1;
  }
}
