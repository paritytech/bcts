/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Array pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust array_pattern.rs.
 *
 * Like the Rust port, this is a thin wrapper around `dcbor_pattern::ArrayPattern`
 * that delegates all matching to dcbor-pattern. The envelope-pattern's
 * `ArrayPattern` adds nothing beyond extracting the leaf CBOR from the
 * envelope subject before delegating.
 *
 * @module envelope-pattern/pattern/leaf/array-pattern
 */

import type { Envelope } from "@bcts/envelope";
import {
  type ArrayPattern as DCBORArrayPattern,
  type Pattern as DCBORPattern,
  type Interval,
  arrayPatternAny,
  arrayPatternMatches,
  arrayPatternWithElements,
  arrayPatternWithLength,
  arrayPatternWithLengthInterval,
  arrayPatternWithLengthRange,
  arrayPatternDisplay,
  arrayPatternEquals,
  patternDisplay as dcborPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafArrayPattern: ((pattern: ArrayPattern) => Pattern) | undefined;

export function registerArrayPatternFactory(factory: (pattern: ArrayPattern) => Pattern): void {
  createLeafArrayPattern = factory;
}

/**
 * Pattern for matching arrays.
 *
 * Mirrors Rust `ArrayPattern(dcbor_pattern::ArrayPattern)` from
 * `bc-envelope-pattern-rust/src/pattern/leaf/array_pattern.rs`. All
 * matching, display, and equality is delegated to dcbor-pattern.
 */
export class ArrayPattern implements Matcher {
  private readonly _pattern: DCBORArrayPattern;

  private constructor(pattern: DCBORArrayPattern) {
    this._pattern = pattern;
  }

  /**
   * Creates a new ArrayPattern that matches any array.
   */
  static any(): ArrayPattern {
    return new ArrayPattern(arrayPatternAny());
  }

  /**
   * Creates a new ArrayPattern that matches arrays with a specific length.
   */
  static count(count: number): ArrayPattern {
    return new ArrayPattern(arrayPatternWithLength(count));
  }

  /**
   * Creates a new ArrayPattern that matches arrays within a length range.
   */
  static interval(min: number, max?: number): ArrayPattern {
    return new ArrayPattern(arrayPatternWithLengthRange(min, max));
  }

  /**
   * Creates a new ArrayPattern from a length Interval.
   */
  static fromInterval(interval: Interval): ArrayPattern {
    return new ArrayPattern(arrayPatternWithLengthInterval(interval));
  }

  /**
   * Creates a new ArrayPattern from a top-level dcbor-pattern.
   *
   * Mirrors Rust `ArrayPattern::from_dcbor_pattern`, which constructs an
   * `ArrayPattern::Elements`-style dcbor array pattern.
   */
  static fromDcborPattern(pattern: DCBORPattern): ArrayPattern {
    return new ArrayPattern(arrayPatternWithElements(pattern));
  }

  /**
   * Creates a new ArrayPattern from an existing dcbor-pattern ArrayPattern.
   *
   * Mirrors Rust `ArrayPattern::from_dcbor_array_pattern`.
   */
  static fromDcborArrayPattern(arrayPattern: DCBORArrayPattern): ArrayPattern {
    return new ArrayPattern(arrayPattern);
  }

  /**
   * Returns the underlying dcbor-pattern ArrayPattern.
   */
  inner(): DCBORArrayPattern {
    return this._pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const cbor = haystack.subject().asLeaf();
    if (cbor === undefined) {
      return [[], new Map<string, Path[]>()];
    }
    if (arrayPatternMatches(this._pattern, cbor)) {
      return [[[haystack]], new Map<string, Path[]>()];
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
    if (createLeafArrayPattern === undefined) {
      throw new Error("ArrayPattern factory not registered");
    }
    compileAsAtomic(createLeafArrayPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return arrayPatternDisplay(this._pattern, dcborPatternDisplay);
  }

  /**
   * Equality comparison. Delegates to dcbor-pattern's structural equality
   * with a display-string fallback for pattern-equality (mirrors Rust's
   * `Hash` impl that hashes the display, since dcbor `ArrayPattern`
   * itself does not derive `Hash`).
   */
  equals(other: ArrayPattern): boolean {
    return arrayPatternEquals(
      this._pattern,
      other._pattern,
      (a, b) => dcborPatternDisplay(a) === dcborPatternDisplay(b),
    );
  }

  /**
   * Hash code for use in Maps/Sets. Mirrors Rust's
   * "hash the string representation" approach.
   */
  hashCode(): number {
    let hash = 0;
    const str = this.toString();
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }
}
