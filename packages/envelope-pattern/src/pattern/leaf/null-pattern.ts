/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Null pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust null_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/null-pattern
 */

import type { Envelope } from "@bcts/envelope";
import {
  type NullPattern as DCBORNullPattern,
  nullPatternPaths as dcborNullPatternPaths,
  nullPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafNullPattern: ((pattern: NullPattern) => Pattern) | undefined;

export function registerNullPatternFactory(factory: (pattern: NullPattern) => Pattern): void {
  createLeafNullPattern = factory;
}

/**
 * Pattern for matching null values.
 *
 * This is a wrapper around dcbor_pattern::NullPattern that provides
 * envelope-specific functionality.
 *
 * Corresponds to the Rust `NullPattern` struct in null_pattern.rs
 */
export class NullPattern implements Matcher {
  private readonly _inner: DCBORNullPattern;
  private static readonly _instance = new NullPattern();

  private constructor() {
    // Create the NullPattern directly - it's just { variant: "Null" }
    this._inner = { variant: "Null" };
  }

  /**
   * Creates a new NullPattern (returns singleton).
   */
  static new(): NullPattern {
    return NullPattern._instance;
  }

  /**
   * Gets the underlying dcbor-pattern NullPattern.
   */
  get inner(): DCBORNullPattern {
    return this._inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // For leaf envelopes, extract the CBOR and delegate to dcbor-pattern
    const cbor = haystack.subject().asLeaf();
    if (cbor !== undefined) {
      // Delegate to dcbor-pattern for CBOR matching
      const dcborPaths = dcborNullPatternPaths(this._inner, cbor);

      if (dcborPaths.length > 0) {
        return [[[haystack]], new Map<string, Path[]>()];
      }
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
    if (createLeafNullPattern === undefined) {
      throw new Error("NullPattern factory not registered");
    }
    compileAsAtomic(createLeafNullPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return nullPatternDisplay(this._inner);
  }

  /**
   * Equality comparison.
   */
  equals(other: NullPattern): boolean {
    return other instanceof NullPattern;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return 0; // All NullPatterns are equal
  }
}
