/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/envelope-pattern - Date pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust date_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/date-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { CborDate } from "@bcts/dcbor";
import {
  type DatePattern as DCBORDatePattern,
  datePatternAny,
  datePatternValue,
  datePatternRange,
  datePatternEarliest,
  datePatternLatest,
  datePatternStringValue,
  datePatternRegex,
  datePatternPaths as dcborDatePatternPaths,
  datePatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafDatePattern: ((pattern: DatePattern) => Pattern) | undefined;

export function registerDatePatternFactory(factory: (pattern: DatePattern) => Pattern): void {
  createLeafDatePattern = factory;
}

/**
 * Pattern for matching date values.
 *
 * This is a wrapper around dcbor_pattern::DatePattern that provides
 * envelope-specific integration.
 *
 * Corresponds to the Rust `DatePattern` struct in date_pattern.rs
 */
export class DatePattern implements Matcher {
  private readonly _inner: DCBORDatePattern;

  private constructor(inner: DCBORDatePattern) {
    this._inner = inner;
  }

  /**
   * Creates a new DatePattern that matches any date.
   */
  static any(): DatePattern {
    return new DatePattern(datePatternAny());
  }

  /**
   * Creates a new DatePattern that matches the specific date.
   */
  static value(date: CborDate): DatePattern {
    return new DatePattern(datePatternValue(date));
  }

  /**
   * Creates a new DatePattern that matches dates within a range (inclusive).
   */
  static range(start: CborDate, end: CborDate): DatePattern {
    return new DatePattern(datePatternRange(start, end));
  }

  /**
   * Creates a new DatePattern that matches dates on or after the specified date.
   */
  static earliest(date: CborDate): DatePattern {
    return new DatePattern(datePatternEarliest(date));
  }

  /**
   * Creates a new DatePattern that matches dates on or before the specified date.
   */
  static latest(date: CborDate): DatePattern {
    return new DatePattern(datePatternLatest(date));
  }

  /**
   * Creates a new DatePattern that matches dates by their ISO-8601 string representation.
   */
  static string(isoString: string): DatePattern {
    return new DatePattern(datePatternStringValue(isoString));
  }

  /**
   * Creates a new DatePattern that matches dates whose ISO-8601 string representation
   * matches the given regular expression.
   */
  static regex(pattern: RegExp): DatePattern {
    return new DatePattern(datePatternRegex(pattern));
  }

  /**
   * Creates a new DatePattern from a dcbor-pattern DatePattern.
   */
  static fromDcborPattern(dcborPattern: DCBORDatePattern): DatePattern {
    return new DatePattern(dcborPattern);
  }

  /**
   * Gets the underlying dcbor-pattern DatePattern.
   */
  get inner(): DCBORDatePattern {
    return this._inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // For leaf envelopes, extract the CBOR and delegate to dcbor-pattern
    const cbor = haystack.subject().asLeaf();
    if (cbor !== undefined) {
      // Delegate to dcbor-pattern for CBOR matching
      const dcborPaths = dcborDatePatternPaths(this._inner, cbor);

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
    if (createLeafDatePattern === undefined) {
      throw new Error("DatePattern factory not registered");
    }
    compileAsAtomic(createLeafDatePattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return datePatternDisplay(this._inner);
  }

  /**
   * Equality comparison.
   */
  equals(other: DatePattern): boolean {
    if (this._inner.variant !== other._inner.variant) {
      return false;
    }
    // Simplified equality - compare variant names
    return JSON.stringify(this._inner) === JSON.stringify(other._inner);
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    // Simple hash based on variant
    let hash = 0;
    const str = this._inner.variant;
    for (let i = 0; i < str.length; i++) {
      hash = hash * 31 + str.charCodeAt(i);
    }
    return hash;
  }
}
