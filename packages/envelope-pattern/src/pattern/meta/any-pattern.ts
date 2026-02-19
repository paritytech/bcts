/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Any pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust any_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/any-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createMetaAnyPattern: ((pattern: AnyPattern) => Pattern) | undefined;

export function registerAnyPatternFactory(factory: (pattern: AnyPattern) => Pattern): void {
  createMetaAnyPattern = factory;
}

/**
 * A pattern that matches any element.
 *
 * Corresponds to the Rust `AnyPattern` struct in any_pattern.rs
 */
export class AnyPattern implements Matcher {
  private constructor() {
    // Empty constructor - AnyPattern is a singleton-like pattern with no state
  }

  /**
   * Creates a new AnyPattern.
   */
  static new(): AnyPattern {
    return new AnyPattern();
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // Always return a path containing the envelope itself.
    return [[[haystack]], new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(_haystack: Envelope): boolean {
    return true;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (createMetaAnyPattern === undefined) {
      throw new Error("AnyPattern factory not registered");
    }
    compileAsAtomic(createMetaAnyPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return "*";
  }

  /**
   * Equality comparison.
   */
  equals(_other: AnyPattern): boolean {
    return true; // All AnyPattern instances are equal
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return 0;
  }
}
