/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Group/repeat pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust repeat_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/group-pattern
 */

import type { Envelope } from "@bcts/envelope";
import { Quantifier } from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import { matchPattern, dispatchPathsWithCaptures, dispatchPatternToString } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";
import type { Matcher } from "../matcher";

// Forward declaration for Pattern factory (used for late binding)
export let createMetaGroupPattern: ((pattern: GroupPattern) => Pattern) | undefined;

export function registerGroupPatternFactory(factory: (pattern: GroupPattern) => Pattern): void {
  createMetaGroupPattern = factory;
}

/**
 * A pattern that matches with repetition.
 *
 * Corresponds to the Rust `GroupPattern` struct in repeat_pattern.rs
 */
export class GroupPattern implements Matcher {
  private readonly _pattern: Pattern;
  private readonly _quantifier: Quantifier;

  private constructor(pattern: Pattern, quantifier: Quantifier) {
    this._pattern = pattern;
    this._quantifier = quantifier;
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
    return this._pattern;
  }

  /**
   * Gets the quantifier of this group pattern.
   */
  quantifier(): Quantifier {
    return this._quantifier;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // For simple grouping (exactly 1), delegate to the inner pattern
    if (this._quantifier.min() === 1 && this._quantifier.max() === 1) {
      return dispatchPathsWithCaptures(this._pattern, haystack);
    }
    throw new Error(
      "GroupPattern does not support pathsWithCaptures directly; use compile instead",
    );
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return matchPattern(this._pattern, haystack);
  }

  compile(code: Instr[], literals: Pattern[], _captures: string[]): void {
    const idx = literals.length;
    literals.push(this._pattern);
    code.push({ type: "Repeat", patternIndex: idx, quantifier: this._quantifier });
  }

  isComplex(): boolean {
    return true;
  }

  toString(): string {
    const formattedRange = this._quantifier.toString();
    return `(${dispatchPatternToString(this._pattern)})${formattedRange}`;
  }

  /**
   * Equality comparison.
   */
  equals(other: GroupPattern): boolean {
    return this._pattern === other._pattern && this._quantifier.equals(other._quantifier);
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    // Simple hash based on quantifier min/max
    return this._quantifier.min() * 31 + (this._quantifier.max() ?? 0);
  }
}
