/**
 * @bcts/envelope-pattern - Text pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust text_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/text-pattern
 */

import type { Envelope } from "@bcts/envelope";
import {
  type TextPattern as DCBORTextPattern,
  textPatternAny,
  textPatternValue,
  textPatternRegex,
  textPatternPaths as dcborTextPatternPaths,
  textPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafTextPattern: ((pattern: TextPattern) => Pattern) | undefined;

export function registerTextPatternFactory(factory: (pattern: TextPattern) => Pattern): void {
  createLeafTextPattern = factory;
}

/**
 * Pattern for matching text values.
 *
 * This is a wrapper around dcbor_pattern::TextPattern that provides
 * envelope-specific integration.
 *
 * Corresponds to the Rust `TextPattern` struct in text_pattern.rs
 */
export class TextPattern implements Matcher {
  private readonly _inner: DCBORTextPattern;

  private constructor(inner: DCBORTextPattern) {
    this._inner = inner;
  }

  /**
   * Creates a new TextPattern that matches any text.
   */
  static any(): TextPattern {
    return new TextPattern(textPatternAny());
  }

  /**
   * Creates a new TextPattern that matches the specific text.
   */
  static value(value: string): TextPattern {
    return new TextPattern(textPatternValue(value));
  }

  /**
   * Creates a new TextPattern that matches text matching the regex.
   */
  static regex(pattern: RegExp): TextPattern {
    return new TextPattern(textPatternRegex(pattern));
  }

  /**
   * Creates a new TextPattern from a dcbor-pattern TextPattern.
   */
  static fromDcborPattern(dcborPattern: DCBORTextPattern): TextPattern {
    return new TextPattern(dcborPattern);
  }

  /**
   * Gets the underlying dcbor-pattern TextPattern.
   */
  get inner(): DCBORTextPattern {
    return this._inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // For leaf envelopes, extract the CBOR and delegate to dcbor-pattern
    const cbor = haystack.subject().asLeaf();
    if (cbor !== undefined) {
      // Delegate to dcbor-pattern for CBOR matching
      const dcborPaths = dcborTextPatternPaths(this._inner, cbor);

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
    if (createLeafTextPattern === undefined) {
      throw new Error("TextPattern factory not registered");
    }
    compileAsAtomic(createLeafTextPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return textPatternDisplay(this._inner);
  }

  /**
   * Equality comparison.
   */
  equals(other: TextPattern): boolean {
    if (this._inner.variant !== other._inner.variant) {
      return false;
    }
    switch (this._inner.variant) {
      case "Any":
        return true;
      case "Value":
        return (
          (this._inner as { value: string }).value === (other._inner as { value: string }).value
        );
      case "Regex":
        return (
          (this._inner as { pattern: RegExp }).pattern.source ===
          (other._inner as { pattern: RegExp }).pattern.source
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
      case "Value": {
        const val = (this._inner as { value: string }).value;
        for (let i = 0; i < val.length; i++) {
          hash = hash * 31 + val.charCodeAt(i);
        }
        break;
      }
      case "Regex":
        hash = 3 * 31 + (this._inner as { pattern: RegExp }).pattern.source.length;
        break;
    }
    return hash;
  }
}
