/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Known value pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust known_value_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/known-value-pattern
 */

import type { Envelope } from "@bcts/envelope";
import { type KnownValue } from "@bcts/known-values";
import {
  type KnownValuePattern as DCBORKnownValuePattern,
  knownValuePatternAny,
  knownValuePatternValue,
  knownValuePatternNamed,
  knownValuePatternRegex,
  knownValuePatternMatches,
  knownValuePatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafKnownValuePattern: ((pattern: KnownValuePattern) => Pattern) | undefined;

export function registerKnownValuePatternFactory(
  factory: (pattern: KnownValuePattern) => Pattern,
): void {
  createLeafKnownValuePattern = factory;
}

/**
 * Pattern for matching known values.
 *
 * This is a wrapper around dcbor_pattern::KnownValuePattern that provides
 * envelope-specific integration.
 *
 * Corresponds to the Rust `KnownValuePattern` struct in known_value_pattern.rs
 */
export class KnownValuePattern implements Matcher {
  private readonly _inner: DCBORKnownValuePattern;

  private constructor(inner: DCBORKnownValuePattern) {
    this._inner = inner;
  }

  /**
   * Creates a new KnownValuePattern that matches any known value.
   */
  static any(): KnownValuePattern {
    return new KnownValuePattern(knownValuePatternAny());
  }

  /**
   * Creates a new KnownValuePattern that matches the specific known value.
   */
  static value(value: KnownValue): KnownValuePattern {
    return new KnownValuePattern(knownValuePatternValue(value));
  }

  /**
   * Creates a new KnownValuePattern that matches known values by name.
   */
  static named(name: string): KnownValuePattern {
    return new KnownValuePattern(knownValuePatternNamed(name));
  }

  /**
   * Creates a new KnownValuePattern that matches known values by regex on their name.
   */
  static regex(regex: RegExp): KnownValuePattern {
    return new KnownValuePattern(knownValuePatternRegex(regex));
  }

  /**
   * Creates a new KnownValuePattern from a dcbor-pattern KnownValuePattern.
   */
  static fromDcborPattern(dcborPattern: DCBORKnownValuePattern): KnownValuePattern {
    return new KnownValuePattern(dcborPattern);
  }

  /**
   * Gets the underlying dcbor-pattern KnownValuePattern.
   */
  get inner(): DCBORKnownValuePattern {
    return this._inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // Check if the envelope subject is a known value via case()
    const subject = haystack.subject();
    const envCase = subject.case();

    if (envCase.type === "knownValue") {
      // Get the KnownValue and create CBOR for pattern matching
      const knownValueCbor = envCase.value.taggedCbor();
      if (knownValuePatternMatches(this._inner, knownValueCbor)) {
        return [[[haystack]], new Map<string, Path[]>()];
      }
    }

    // Also try matching as a leaf (for tagged CBOR containing known values)
    const leafCbor = subject.asLeaf();
    if (leafCbor !== undefined) {
      if (knownValuePatternMatches(this._inner, leafCbor)) {
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
    if (createLeafKnownValuePattern === undefined) {
      throw new Error("KnownValuePattern factory not registered");
    }
    compileAsAtomic(createLeafKnownValuePattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return knownValuePatternDisplay(this._inner);
  }

  /**
   * Equality comparison.
   */
  equals(other: KnownValuePattern): boolean {
    // Compare by variant type and values
    if (this._inner.variant !== other._inner.variant) {
      return false;
    }
    switch (this._inner.variant) {
      case "Any":
        return true;
      case "Value":
        return (
          this._inner.value.valueBigInt() ===
          (other._inner as { variant: "Value"; value: KnownValue }).value.valueBigInt()
        );
      case "Named":
        return this._inner.name === (other._inner as { variant: "Named"; name: string }).name;
      case "Regex":
        return (
          this._inner.pattern.source ===
          (other._inner as { variant: "Regex"; pattern: RegExp }).pattern.source
        );
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this._inner.variant) {
      case "Any":
        return 0;
      case "Value":
        return Number(this._inner.value.valueBigInt() & BigInt(0xffffffff));
      case "Named":
        return simpleStringHash(this._inner.name);
      case "Regex":
        return simpleStringHash(this._inner.pattern.source);
    }
  }
}

/**
 * Simple string hash function for hashCode implementations.
 */
function simpleStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}
