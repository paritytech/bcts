/**
 * @bcts/envelope-pattern - Group/repeat pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust repeat_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/group-pattern
 */

import type { Envelope } from "@bcts/envelope";
import { Quantifier } from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createMetaGroupPattern: ((pattern: GroupPattern) => Pattern) | undefined;

export function registerGroupPatternFactory(factory: (pattern: GroupPattern) => Pattern): void {
  createMetaGroupPattern = factory;
}

/**
 * A pattern that matches with repetition.
 *
 * Corresponds to the Rust `GroupPattern` struct in repeat_pattern.rs
 */
export class GroupPattern implements Matcher {
  readonly #pattern: Pattern;
  readonly #quantifier: Quantifier;

  private constructor(pattern: Pattern, quantifier: Quantifier) {
    this.#pattern = pattern;
    this.#quantifier = quantifier;
  }

  /**
   * Creates a new GroupPattern with the specified sub-pattern and quantifier.
   */
  static repeat(pattern: Pattern, quantifier: Quantifier): GroupPattern {
    return new GroupPattern(pattern, quantifier);
  }

  /**
   * Creates a new GroupPattern with a quantifier that matches exactly once.
   */
  static new(pattern: Pattern): GroupPattern {
    return new GroupPattern(pattern, Quantifier.exactly(1));
  }

  /**
   * Gets the sub-pattern of this group pattern.
   */
  pattern(): Pattern {
    return this.#pattern;
  }

  /**
   * Gets the quantifier of this group pattern.
   */
  quantifier(): Quantifier {
    return this.#quantifier;
  }

  pathsWithCaptures(_haystack: Envelope): [Path[], Map<string, Path[]>] {
    throw new Error(
      "GroupPattern does not support pathsWithCaptures directly; use compile instead"
    );
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    // GroupPattern needs VM execution
    const matcher = this.#pattern as unknown as Matcher;
    return matcher.matches(haystack);
  }

  compile(code: Instr[], literals: Pattern[], _captures: string[]): void {
    const idx = literals.length;
    literals.push(this.#pattern);
    code.push({ type: "Repeat", patternIndex: idx, quantifier: this.#quantifier });
  }

  isComplex(): boolean {
    return true;
  }

  toString(): string {
    const formattedRange = String(this.#quantifier);
    return `(${this.#pattern})${formattedRange}`;
  }

  /**
   * Equality comparison.
   */
  equals(other: GroupPattern): boolean {
    return this.#pattern === other.#pattern && this.#quantifier.equals(other.#quantifier);
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    // Simple hash based on quantifier min/max
    return this.#quantifier.min() * 31 + (this.#quantifier.max() ?? 0);
  }
}
