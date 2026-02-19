/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Leaf structure pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust leaf_structure_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/leaf-structure-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructureLeafPattern: ((pattern: LeafStructurePattern) => Pattern) | undefined;

export function registerLeafStructurePatternFactory(
  factory: (pattern: LeafStructurePattern) => Pattern,
): void {
  createStructureLeafPattern = factory;
}

/**
 * Pattern for matching leaf envelopes (terminal nodes in the envelope tree).
 *
 * Corresponds to the Rust `LeafStructurePattern` struct in leaf_structure_pattern.rs
 */
export class LeafStructurePattern implements Matcher {
  private constructor() {
    // Empty constructor - LeafStructurePattern is a singleton-like pattern with no state
  }

  /**
   * Creates a new LeafStructurePattern.
   */
  static new(): LeafStructurePattern {
    return new LeafStructurePattern();
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const envCase = haystack.case();
    const isLeafOrKnownValue = envCase.type === "leaf" || envCase.type === "knownValue";
    const paths = isLeafOrKnownValue ? [[haystack]] : [];
    return [paths, new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (createStructureLeafPattern === undefined) {
      throw new Error("LeafStructurePattern factory not registered");
    }
    compileAsAtomic(createStructureLeafPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return "leaf";
  }

  /**
   * Equality comparison.
   */
  equals(_other: LeafStructurePattern): boolean {
    return true; // All LeafStructurePattern instances are equal
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return 0;
  }
}
