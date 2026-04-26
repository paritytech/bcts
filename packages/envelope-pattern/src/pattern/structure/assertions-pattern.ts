/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Assertions pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust assertions_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/assertions-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import { matchPattern, type Matcher } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructureAssertionsPattern: ((pattern: AssertionsPattern) => Pattern) | undefined;
let dispatchPatternToString: ((pattern: Pattern) => string) | undefined;

export function registerAssertionsPatternFactory(
  factory: (pattern: AssertionsPattern) => Pattern,
): void {
  createStructureAssertionsPattern = factory;
}

export function registerAssertionsPatternToStringDispatch(fn: (pattern: Pattern) => string): void {
  dispatchPatternToString = fn;
}

/**
 * Pattern type for assertions pattern matching.
 *
 * Corresponds to the Rust `AssertionsPattern` enum in assertions_pattern.rs:
 * - `Any` matches any assertion.
 * - `WithPredicate` matches assertions whose predicate matches a sub-pattern.
 * - `WithObject` matches assertions whose object matches a sub-pattern.
 */
export type AssertionsPatternType =
  | { readonly type: "Any" }
  | { readonly type: "WithPredicate"; readonly pattern: Pattern }
  | { readonly type: "WithObject"; readonly pattern: Pattern };

/**
 * Pattern for matching assertions in envelopes.
 *
 * Corresponds to the Rust `AssertionsPattern` enum in assertions_pattern.rs
 */
export class AssertionsPattern implements Matcher {
  private readonly _pattern: AssertionsPatternType;

  private constructor(pattern: AssertionsPatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new AssertionsPattern that matches any assertion.
   */
  static any(): AssertionsPattern {
    return new AssertionsPattern({ type: "Any" });
  }

  /**
   * Creates a new AssertionsPattern that matches assertions with predicates
   * that match a specific pattern.
   */
  static withPredicate(pattern: Pattern): AssertionsPattern {
    return new AssertionsPattern({ type: "WithPredicate", pattern });
  }

  /**
   * Creates a new AssertionsPattern that matches assertions with objects
   * that match a specific pattern.
   */
  static withObject(pattern: Pattern): AssertionsPattern {
    return new AssertionsPattern({ type: "WithObject", pattern });
  }

  /**
   * Gets the pattern type.
   */
  get patternType(): AssertionsPatternType {
    return this._pattern;
  }

  /**
   * Gets the predicate pattern if this has one, undefined otherwise.
   */
  predicatePattern(): Pattern | undefined {
    if (this._pattern.type === "WithPredicate") {
      return this._pattern.pattern;
    }
    return undefined;
  }

  /**
   * Gets the object pattern if this has one, undefined otherwise.
   */
  objectPattern(): Pattern | undefined {
    if (this._pattern.type === "WithObject") {
      return this._pattern.pattern;
    }
    return undefined;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const paths: Path[] = [];

    for (const assertion of haystack.assertions()) {
      switch (this._pattern.type) {
        case "Any":
          paths.push([assertion]);
          break;
        case "WithPredicate": {
          const predicate = assertion.asPredicate?.();
          if (predicate !== undefined) {
            if (matchPattern(this._pattern.pattern, predicate)) {
              paths.push([assertion]);
            }
          }
          break;
        }
        case "WithObject": {
          const object = assertion.asObject?.();
          if (object !== undefined) {
            if (matchPattern(this._pattern.pattern, object)) {
              paths.push([assertion]);
            }
          }
          break;
        }
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
    if (createStructureAssertionsPattern === undefined) {
      throw new Error("AssertionsPattern factory not registered");
    }
    const idx = literals.length;
    literals.push(createStructureAssertionsPattern(this));
    code.push({ type: "MatchStructure", literalIndex: idx });
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    const fmt = dispatchPatternToString;
    switch (this._pattern.type) {
      case "Any":
        return "assert";
      case "WithPredicate": {
        const inner = fmt !== undefined ? fmt(this._pattern.pattern) : "?";
        return `assertpred(${inner})`;
      }
      case "WithObject": {
        const inner = fmt !== undefined ? fmt(this._pattern.pattern) : "?";
        return `assertobj(${inner})`;
      }
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: AssertionsPattern): boolean {
    if (this._pattern.type !== other._pattern.type) {
      return false;
    }
    switch (this._pattern.type) {
      case "Any":
        return true;
      case "WithPredicate":
      case "WithObject": {
        const thisPattern = (
          this._pattern as { type: "WithPredicate" | "WithObject"; pattern: Pattern }
        ).pattern;
        const otherPattern = (
          other._pattern as { type: "WithPredicate" | "WithObject"; pattern: Pattern }
        ).pattern;
        return thisPattern === otherPattern;
      }
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this._pattern.type) {
      case "Any":
        return 0;
      case "WithPredicate":
        return 1;
      case "WithObject":
        return 2;
    }
  }
}
