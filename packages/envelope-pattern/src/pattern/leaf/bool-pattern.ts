/**
 * @bcts/envelope-pattern - Boolean pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust bool_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/bool-pattern
 */

import type { Envelope } from "@bcts/envelope";
import {
  type BoolPattern as DCBORBoolPattern,
  boolPatternAny,
  boolPatternValue,
  boolPatternPaths as dcborBoolPatternPaths,
  boolPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafBoolPattern: ((pattern: BoolPattern) => Pattern) | undefined;

export function registerBoolPatternFactory(factory: (pattern: BoolPattern) => Pattern): void {
  createLeafBoolPattern = factory;
}

/**
 * Pattern for matching boolean values.
 *
 * This is a wrapper around dcbor_pattern::BoolPattern that provides
 * envelope-specific integration.
 *
 * Corresponds to the Rust `BoolPattern` struct in bool_pattern.rs
 */
export class BoolPattern implements Matcher {
  readonly #inner: DCBORBoolPattern;

  private constructor(inner: DCBORBoolPattern) {
    this.#inner = inner;
  }

  /**
   * Creates a new BoolPattern that matches any boolean value.
   */
  static any(): BoolPattern {
    return new BoolPattern(boolPatternAny());
  }

  /**
   * Creates a new BoolPattern that matches the specific boolean value.
   */
  static value(value: boolean): BoolPattern {
    return new BoolPattern(boolPatternValue(value));
  }

  /**
   * Creates a new BoolPattern from a dcbor-pattern BoolPattern.
   */
  static fromDcborPattern(dcborPattern: DCBORBoolPattern): BoolPattern {
    return new BoolPattern(dcborPattern);
  }

  /**
   * Gets the underlying dcbor-pattern BoolPattern.
   */
  get inner(): DCBORBoolPattern {
    return this.#inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // For leaf envelopes, extract the CBOR and delegate to dcbor-pattern
    const cbor = haystack.asLeaf();
    if (cbor !== undefined) {
      // Delegate to dcbor-pattern for CBOR matching
      const dcborPaths = dcborBoolPatternPaths(this.#inner, cbor);

      // For simple leaf patterns, if dcbor-pattern found matches, return the envelope
      if (dcborPaths.length > 0) {
        const envelopePaths: Path[] = [[haystack]];
        const envelopeCaptures = new Map<string, Path[]>();
        return [envelopePaths, envelopeCaptures];
      }
    }

    // Not a leaf envelope or no match
    return [[], new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (createLeafBoolPattern === undefined) {
      throw new Error("BoolPattern factory not registered");
    }
    compileAsAtomic(createLeafBoolPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return boolPatternDisplay(this.#inner);
  }

  /**
   * Equality comparison.
   */
  equals(other: BoolPattern): boolean {
    // Compare by variant and value
    if (this.#inner.variant !== other.#inner.variant) {
      return false;
    }
    if (this.#inner.variant === "Value" && other.#inner.variant === "Value") {
      return this.#inner.value === other.#inner.value;
    }
    return true;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    // Simple hash based on variant and value
    let hash = this.#inner.variant === "Any" ? 0 : 1;
    if (this.#inner.variant === "Value") {
      hash = hash * 31 + (this.#inner.value ? 1 : 0);
    }
    return hash;
  }
}
