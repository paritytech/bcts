/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Predicate pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust predicate_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/predicate-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import { matchPattern, type Matcher } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructurePredicatePattern: ((pattern: PredicatePattern) => Pattern) | undefined;

export function registerPredicatePatternFactory(
  factory: (pattern: PredicatePattern) => Pattern,
): void {
  createStructurePredicatePattern = factory;
}

/**
 * Pattern type for predicate pattern matching.
 *
 * Corresponds to the Rust `PredicatePattern` enum in predicate_pattern.rs
 */
export type PredicatePatternType =
  | { readonly type: "Any" }
  | { readonly type: "Pattern"; readonly pattern: Pattern };

/**
 * Pattern for matching predicates in envelopes.
 *
 * Corresponds to the Rust `PredicatePattern` enum in predicate_pattern.rs
 */
export class PredicatePattern implements Matcher {
  private readonly _pattern: PredicatePatternType;

  private constructor(pattern: PredicatePatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new PredicatePattern that matches any predicate.
   */
  static any(): PredicatePattern {
    return new PredicatePattern({ type: "Any" });
  }

  /**
   * Creates a new PredicatePattern that matches predicates matching the given pattern.
   */
  static pattern(pattern: Pattern): PredicatePattern {
    return new PredicatePattern({ type: "Pattern", pattern });
  }

  /**
   * Gets the pattern type.
   */
  get patternType(): PredicatePatternType {
    return this._pattern;
  }

  /**
   * Gets the inner pattern if this is a Pattern type, undefined otherwise.
   */
  innerPattern(): Pattern | undefined {
    return this._pattern.type === "Pattern" ? this._pattern.pattern : undefined;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const predicate = haystack.asPredicate?.();

    if (predicate === undefined) {
      return [[], new Map<string, Path[]>()];
    }

    let paths: Path[];

    switch (this._pattern.type) {
      case "Any":
        paths = [[predicate]];
        break;
      case "Pattern": {
        if (matchPattern(this._pattern.pattern, predicate)) {
          paths = [[predicate]];
        } else {
          paths = [];
        }
        break;
      }
    }

    return [paths, new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], _captures: string[]): void {
    if (createStructurePredicatePattern === undefined) {
      throw new Error("PredicatePattern factory not registered");
    }
    const idx = literals.length;
    literals.push(createStructurePredicatePattern(this));
    code.push({ type: "MatchStructure", literalIndex: idx });
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "pred";
      case "Pattern":
        return `pred(${(this._pattern.pattern as unknown as { toString(): string }).toString()})`;
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: PredicatePattern): boolean {
    if (this._pattern.type !== other._pattern.type) {
      return false;
    }
    if (this._pattern.type === "Any") {
      return true;
    }
    const thisPattern = (this._pattern as { type: "Pattern"; pattern: Pattern }).pattern;
    const otherPattern = (other._pattern as { type: "Pattern"; pattern: Pattern }).pattern;
    return thisPattern === otherPattern;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return this._pattern.type === "Any" ? 0 : 1;
  }
}
