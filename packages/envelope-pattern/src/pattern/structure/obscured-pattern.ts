/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Obscured pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust obscured_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/obscured-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructureObscuredPattern: ((pattern: ObscuredPattern) => Pattern) | undefined;

export function registerObscuredPatternFactory(
  factory: (pattern: ObscuredPattern) => Pattern,
): void {
  createStructureObscuredPattern = factory;
}

/**
 * Pattern type for obscured pattern matching.
 *
 * Corresponds to the Rust `ObscuredPattern` enum in obscured_pattern.rs
 */
export type ObscuredPatternType =
  | { readonly type: "Any" }
  | { readonly type: "Elided" }
  | { readonly type: "Encrypted" }
  | { readonly type: "Compressed" };

/**
 * Pattern for matching obscured elements.
 *
 * Corresponds to the Rust `ObscuredPattern` enum in obscured_pattern.rs
 */
export class ObscuredPattern implements Matcher {
  private readonly _pattern: ObscuredPatternType;

  private constructor(pattern: ObscuredPatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new ObscuredPattern that matches any obscured element.
   */
  static any(): ObscuredPattern {
    return new ObscuredPattern({ type: "Any" });
  }

  /**
   * Creates a new ObscuredPattern that matches any elided element.
   */
  static elided(): ObscuredPattern {
    return new ObscuredPattern({ type: "Elided" });
  }

  /**
   * Creates a new ObscuredPattern that matches any encrypted element.
   */
  static encrypted(): ObscuredPattern {
    return new ObscuredPattern({ type: "Encrypted" });
  }

  /**
   * Creates a new ObscuredPattern that matches any compressed element.
   */
  static compressed(): ObscuredPattern {
    return new ObscuredPattern({ type: "Compressed" });
  }

  /**
   * Gets the pattern type.
   */
  get patternType(): ObscuredPatternType {
    return this._pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    let isHit = false;

    switch (this._pattern.type) {
      case "Any":
        isHit = haystack.isObscured();
        break;
      case "Elided":
        isHit = haystack.isElided();
        break;
      case "Encrypted":
        isHit = haystack.isEncrypted();
        break;
      case "Compressed":
        isHit = haystack.isCompressed();
        break;
    }

    const paths = isHit ? [[haystack]] : [];
    return [paths, new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (createStructureObscuredPattern === undefined) {
      throw new Error("ObscuredPattern factory not registered");
    }
    compileAsAtomic(createStructureObscuredPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "obscured";
      case "Elided":
        return "elided";
      case "Encrypted":
        return "encrypted";
      case "Compressed":
        return "compressed";
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: ObscuredPattern): boolean {
    return this._pattern.type === other._pattern.type;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this._pattern.type) {
      case "Any":
        return 0;
      case "Elided":
        return 1;
      case "Encrypted":
        return 2;
      case "Compressed":
        return 3;
    }
  }
}
