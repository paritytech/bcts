/**
 * @bcts/envelope-pattern - Number pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust number_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/number-pattern
 */

import type { Envelope } from "@bcts/envelope";
import {
  type NumberPattern as DCBORNumberPattern,
  numberPatternAny,
  numberPatternValue,
  numberPatternRange,
  numberPatternGreaterThan,
  numberPatternGreaterThanOrEqual,
  numberPatternLessThan,
  numberPatternLessThanOrEqual,
  numberPatternNaN,
  numberPatternInfinity,
  numberPatternNegInfinity,
  numberPatternPaths as dcborNumberPatternPaths,
  numberPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafNumberPattern: ((pattern: NumberPattern) => Pattern) | undefined;

export function registerNumberPatternFactory(factory: (pattern: NumberPattern) => Pattern): void {
  createLeafNumberPattern = factory;
}

/**
 * Pattern for matching number values.
 *
 * This is a wrapper around dcbor_pattern::NumberPattern that provides
 * envelope-specific integration.
 *
 * Corresponds to the Rust `NumberPattern` struct in number_pattern.rs
 */
export class NumberPattern implements Matcher {
  private readonly _inner: DCBORNumberPattern;

  private constructor(inner: DCBORNumberPattern) {
    this._inner = inner;
  }

  /**
   * Creates a new NumberPattern that matches any number.
   */
  static any(): NumberPattern {
    return new NumberPattern(numberPatternAny());
  }

  /**
   * Creates a new NumberPattern that matches the exact number.
   */
  static exact(value: number): NumberPattern {
    return new NumberPattern(numberPatternValue(value));
  }

  /**
   * Creates a new NumberPattern that matches numbers within the specified range.
   */
  static range(min: number, max: number): NumberPattern {
    return new NumberPattern(numberPatternRange(min, max));
  }

  /**
   * Creates a new NumberPattern that matches numbers greater than the specified value.
   */
  static greaterThan(value: number): NumberPattern {
    return new NumberPattern(numberPatternGreaterThan(value));
  }

  /**
   * Creates a new NumberPattern that matches numbers greater than or equal to the specified value.
   */
  static greaterThanOrEqual(value: number): NumberPattern {
    return new NumberPattern(numberPatternGreaterThanOrEqual(value));
  }

  /**
   * Creates a new NumberPattern that matches numbers less than the specified value.
   */
  static lessThan(value: number): NumberPattern {
    return new NumberPattern(numberPatternLessThan(value));
  }

  /**
   * Creates a new NumberPattern that matches numbers less than or equal to the specified value.
   */
  static lessThanOrEqual(value: number): NumberPattern {
    return new NumberPattern(numberPatternLessThanOrEqual(value));
  }

  /**
   * Creates a new NumberPattern that matches NaN values.
   */
  static nan(): NumberPattern {
    return new NumberPattern(numberPatternNaN());
  }

  /**
   * Creates a new NumberPattern that matches positive infinity.
   */
  static infinity(): NumberPattern {
    return new NumberPattern(numberPatternInfinity());
  }

  /**
   * Creates a new NumberPattern that matches negative infinity.
   */
  static negInfinity(): NumberPattern {
    return new NumberPattern(numberPatternNegInfinity());
  }

  /**
   * Creates a new NumberPattern from a dcbor-pattern NumberPattern.
   */
  static fromDcborPattern(dcborPattern: DCBORNumberPattern): NumberPattern {
    return new NumberPattern(dcborPattern);
  }

  /**
   * Gets the underlying dcbor-pattern NumberPattern.
   */
  get inner(): DCBORNumberPattern {
    return this._inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // For leaf envelopes, extract the CBOR and delegate to dcbor-pattern
    const cbor = haystack.subject().asLeaf();
    if (cbor !== undefined) {
      // Delegate to dcbor-pattern for CBOR matching
      const dcborPaths = dcborNumberPatternPaths(this._inner, cbor);

      // For simple leaf patterns, if dcbor-pattern found matches, return the envelope
      if (dcborPaths.length > 0) {
        const envelopePaths: Path[] = [[haystack]];
        return [envelopePaths, new Map<string, Path[]>()];
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
    if (createLeafNumberPattern === undefined) {
      throw new Error("NumberPattern factory not registered");
    }
    compileAsAtomic(createLeafNumberPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return numberPatternDisplay(this._inner);
  }

  /**
   * Equality comparison.
   */
  equals(other: NumberPattern): boolean {
    // Compare by variant and values
    if (this._inner.variant !== other._inner.variant) {
      return false;
    }
    switch (this._inner.variant) {
      case "Any":
      case "NaN":
      case "Infinity":
      case "NegInfinity":
        return true;
      case "Value":
      case "GreaterThan":
      case "GreaterThanOrEqual":
      case "LessThan":
      case "LessThanOrEqual":
        return (
          (this._inner as { value: number }).value === (other._inner as { value: number }).value
        );
      case "Range":
        return (
          (this._inner as { min: number; max: number }).min ===
            (other._inner as { min: number; max: number }).min &&
          (this._inner as { min: number; max: number }).max ===
            (other._inner as { min: number; max: number }).max
        );
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    let hash = 0;
    switch (this._inner.variant) {
      case "Any":
        hash = 1;
        break;
      case "Value":
        hash = 2 * 31 + (this._inner as { value: number }).value;
        break;
      case "Range":
        hash = 3 * 31 + (this._inner as { min: number }).min + (this._inner as { max: number }).max;
        break;
      case "GreaterThan":
        hash = 4 * 31 + (this._inner as { value: number }).value;
        break;
      case "GreaterThanOrEqual":
        hash = 5 * 31 + (this._inner as { value: number }).value;
        break;
      case "LessThan":
        hash = 6 * 31 + (this._inner as { value: number }).value;
        break;
      case "LessThanOrEqual":
        hash = 7 * 31 + (this._inner as { value: number }).value;
        break;
      case "NaN":
        hash = 8;
        break;
      case "Infinity":
        hash = 9;
        break;
      case "NegInfinity":
        hash = 10;
        break;
    }
    return hash;
  }
}
