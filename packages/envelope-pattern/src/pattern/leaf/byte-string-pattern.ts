/**
 * @bcts/envelope-pattern - Byte string pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust byte_string_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/byte-string-pattern
 */

import type { Envelope } from "@bcts/envelope";
import {
  type ByteStringPattern as DCBORByteStringPattern,
  byteStringPatternAny,
  byteStringPatternValue,
  byteStringPatternBinaryRegex,
  byteStringPatternPaths as dcborByteStringPatternPaths,
  byteStringPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafByteStringPattern: ((pattern: ByteStringPattern) => Pattern) | undefined;

export function registerByteStringPatternFactory(
  factory: (pattern: ByteStringPattern) => Pattern,
): void {
  createLeafByteStringPattern = factory;
}

/**
 * Pattern for matching byte string values.
 *
 * This is a wrapper around dcbor_pattern::ByteStringPattern that provides
 * envelope-specific integration.
 *
 * Corresponds to the Rust `ByteStringPattern` struct in byte_string_pattern.rs
 */
export class ByteStringPattern implements Matcher {
  private readonly _inner: DCBORByteStringPattern;

  private constructor(inner: DCBORByteStringPattern) {
    this._inner = inner;
  }

  /**
   * Creates a new ByteStringPattern that matches any byte string.
   */
  static any(): ByteStringPattern {
    return new ByteStringPattern(byteStringPatternAny());
  }

  /**
   * Creates a new ByteStringPattern that matches the specific byte string.
   */
  static value(value: Uint8Array): ByteStringPattern {
    return new ByteStringPattern(byteStringPatternValue(value));
  }

  /**
   * Creates a new ByteStringPattern that matches byte strings matching the binary regex.
   */
  static regex(pattern: RegExp): ByteStringPattern {
    return new ByteStringPattern(byteStringPatternBinaryRegex(pattern));
  }

  /**
   * Creates a new ByteStringPattern from a dcbor-pattern ByteStringPattern.
   */
  static fromDcborPattern(dcborPattern: DCBORByteStringPattern): ByteStringPattern {
    return new ByteStringPattern(dcborPattern);
  }

  /**
   * Gets the underlying dcbor-pattern ByteStringPattern.
   */
  get inner(): DCBORByteStringPattern {
    return this._inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // For leaf envelopes, extract the CBOR and delegate to dcbor-pattern
    const cbor = haystack.subject().asLeaf();
    if (cbor !== undefined) {
      // Delegate to dcbor-pattern for CBOR matching
      const dcborPaths = dcborByteStringPatternPaths(this._inner, cbor);

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
    if (createLeafByteStringPattern === undefined) {
      throw new Error("ByteStringPattern factory not registered");
    }
    compileAsAtomic(createLeafByteStringPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return byteStringPatternDisplay(this._inner);
  }

  /**
   * Equality comparison.
   */
  equals(other: ByteStringPattern): boolean {
    if (this._inner.variant !== other._inner.variant) {
      return false;
    }
    switch (this._inner.variant) {
      case "Any":
        return true;
      case "Value": {
        const a = (this._inner as { value: Uint8Array }).value;
        const b = (other._inner as { value: Uint8Array }).value;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      }
      case "BinaryRegex":
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
        const val = (this._inner as { value: Uint8Array }).value;
        for (const byte of val) {
          hash = hash * 31 + byte;
        }
        break;
      }
      case "BinaryRegex":
        hash = 3 * 31 + (this._inner as { pattern: RegExp }).pattern.source.length;
        break;
    }
    return hash;
  }
}
