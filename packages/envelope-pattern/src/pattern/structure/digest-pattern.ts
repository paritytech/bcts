/**
 * @bcts/envelope-pattern - Digest pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust digest_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/digest-pattern
 */

import type { Envelope, Digest } from "@bcts/envelope";
import { bytesToHex } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructureDigestPattern: ((pattern: DigestPattern) => Pattern) | undefined;

export function registerDigestPatternFactory(factory: (pattern: DigestPattern) => Pattern): void {
  createStructureDigestPattern = factory;
}

/**
 * Helper to convert bytes to Latin-1 string for regex matching.
 */
function bytesToLatin1(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }
  return result;
}

/**
 * Pattern type for digest pattern matching.
 *
 * Corresponds to the Rust `DigestPattern` enum in digest_pattern.rs
 */
export type DigestPatternType =
  | { readonly type: "Any" }
  | { readonly type: "Digest"; readonly digest: Digest }
  | { readonly type: "Prefix"; readonly prefix: Uint8Array }
  | { readonly type: "BinaryRegex"; readonly regex: RegExp };

/**
 * Pattern for matching envelopes by their digest.
 *
 * Corresponds to the Rust `DigestPattern` enum in digest_pattern.rs
 */
export class DigestPattern implements Matcher {
  private readonly _pattern: DigestPatternType;

  private constructor(pattern: DigestPatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new DigestPattern that matches any digest.
   */
  static any(): DigestPattern {
    return new DigestPattern({ type: "Any" });
  }

  /**
   * Creates a new DigestPattern that matches the exact digest.
   */
  static digest(digest: Digest): DigestPattern {
    return new DigestPattern({ type: "Digest", digest });
  }

  /**
   * Creates a new DigestPattern that matches the prefix of a digest.
   */
  static prefix(prefix: Uint8Array): DigestPattern {
    return new DigestPattern({ type: "Prefix", prefix });
  }

  /**
   * Creates a new DigestPattern that matches the binary regex for a digest.
   */
  static binaryRegex(regex: RegExp): DigestPattern {
    return new DigestPattern({ type: "BinaryRegex", regex });
  }

  /**
   * Gets the pattern type.
   */
  get patternType(): DigestPatternType {
    return this._pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const digest = haystack.digest();
    const digestData = digest.data();
    let isHit = false;

    switch (this._pattern.type) {
      case "Any":
        // Any digest matches - every envelope has a digest
        isHit = true;
        break;
      case "Digest":
        isHit = digest.equals(this._pattern.digest);
        break;
      case "Prefix": {
        const prefix = this._pattern.prefix;
        if (digestData.length >= prefix.length) {
          isHit = true;
          for (let i = 0; i < prefix.length; i++) {
            if (digestData[i] !== prefix[i]) {
              isHit = false;
              break;
            }
          }
        }
        break;
      }
      case "BinaryRegex": {
        const latin1 = bytesToLatin1(digestData);
        isHit = this._pattern.regex.test(latin1);
        break;
      }
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
    if (createStructureDigestPattern === undefined) {
      throw new Error("DigestPattern factory not registered");
    }
    compileAsAtomic(createStructureDigestPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "digest";
      case "Digest":
        return `digest(${this._pattern.digest.hex()})`;
      case "Prefix":
        return `digest(${bytesToHex(this._pattern.prefix)})`;
      case "BinaryRegex":
        return `digest(/${this._pattern.regex.source}/)`;
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: DigestPattern): boolean {
    if (this._pattern.type !== other._pattern.type) {
      return false;
    }
    switch (this._pattern.type) {
      case "Any":
        return true;
      case "Digest":
        return this._pattern.digest.equals(
          (other._pattern as { type: "Digest"; digest: Digest }).digest,
        );
      case "Prefix": {
        const thisPrefix = this._pattern.prefix;
        const otherPrefix = (other._pattern as { type: "Prefix"; prefix: Uint8Array }).prefix;
        if (thisPrefix.length !== otherPrefix.length) return false;
        for (let i = 0; i < thisPrefix.length; i++) {
          if (thisPrefix[i] !== otherPrefix[i]) return false;
        }
        return true;
      }
      case "BinaryRegex":
        return (
          this._pattern.regex.source ===
          (other._pattern as { type: "BinaryRegex"; regex: RegExp }).regex.source
        );
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this._pattern.type) {
      case "Any":
        return 0;
      case "Digest": {
        // Hash based on first few bytes of digest
        const data = this._pattern.digest.data().slice(0, 8);
        let hash = 0;
        for (const byte of data) {
          hash = (hash * 31 + byte) | 0;
        }
        return hash;
      }
      case "Prefix": {
        let hash = 0;
        for (const byte of this._pattern.prefix) {
          hash = (hash * 31 + byte) | 0;
        }
        return hash;
      }
      case "BinaryRegex": {
        let hash = 0;
        for (const char of this._pattern.regex.source) {
          hash = (hash * 31 + char.charCodeAt(0)) | 0;
        }
        return hash;
      }
    }
  }
}
