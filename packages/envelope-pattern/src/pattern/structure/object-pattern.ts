/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Object pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust object_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/object-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import { matchPattern, type Matcher } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructureObjectPattern: ((pattern: ObjectPattern) => Pattern) | undefined;

export function registerObjectPatternFactory(factory: (pattern: ObjectPattern) => Pattern): void {
  createStructureObjectPattern = factory;
}

/**
 * Pattern type for object pattern matching.
 *
 * Corresponds to the Rust `ObjectPattern` enum in object_pattern.rs
 */
export type ObjectPatternType =
  | { readonly type: "Any" }
  | { readonly type: "Pattern"; readonly pattern: Pattern };

/**
 * Pattern for matching objects in envelopes.
 *
 * Corresponds to the Rust `ObjectPattern` enum in object_pattern.rs
 */
export class ObjectPattern implements Matcher {
  private readonly _pattern: ObjectPatternType;

  private constructor(pattern: ObjectPatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new ObjectPattern that matches any object.
   */
  static any(): ObjectPattern {
    return new ObjectPattern({ type: "Any" });
  }

  /**
   * Creates a new ObjectPattern that matches objects matching the given pattern.
   */
  static pattern(pattern: Pattern): ObjectPattern {
    return new ObjectPattern({ type: "Pattern", pattern });
  }

  /**
   * Gets the pattern type.
   */
  get patternType(): ObjectPatternType {
    return this._pattern;
  }

  /**
   * Gets the inner pattern if this is a Pattern type, undefined otherwise.
   */
  innerPattern(): Pattern | undefined {
    return this._pattern.type === "Pattern" ? this._pattern.pattern : undefined;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const object = haystack.asObject?.();

    if (object === undefined) {
      return [[], new Map<string, Path[]>()];
    }

    let paths: Path[];

    switch (this._pattern.type) {
      case "Any":
        paths = [[object]];
        break;
      case "Pattern": {
        if (matchPattern(this._pattern.pattern, object)) {
          paths = [[object]];
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
    if (createStructureObjectPattern === undefined) {
      throw new Error("ObjectPattern factory not registered");
    }
    const idx = literals.length;
    literals.push(createStructureObjectPattern(this));
    code.push({ type: "MatchStructure", literalIndex: idx });
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "obj";
      case "Pattern":
        return `obj(${(this._pattern.pattern as unknown as { toString(): string }).toString()})`;
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: ObjectPattern): boolean {
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
