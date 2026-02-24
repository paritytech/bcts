/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Tagged pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust tagged_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/tagged-pattern
 */

import { Envelope } from "@bcts/envelope";
import type { Tag, Cbor } from "@bcts/dcbor";
import {
  type TaggedPattern as DCBORTaggedPattern,
  type Pattern as DCBORPattern,
  taggedPatternAny,
  taggedPatternWithTag,
  taggedPatternWithName,
  taggedPatternWithRegex,
  taggedPatternPathsWithCaptures,
  taggedPatternDisplay,
  patternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafTaggedPattern: ((pattern: TaggedPattern) => Pattern) | undefined;

export function registerTaggedPatternFactory(factory: (pattern: TaggedPattern) => Pattern): void {
  createLeafTaggedPattern = factory;
}

/**
 * Pattern for matching tagged CBOR values.
 *
 * This is a wrapper around dcbor_pattern::TaggedPattern that provides
 * envelope-specific integration.
 *
 * Corresponds to the Rust `TaggedPattern` struct in tagged_pattern.rs
 */
export class TaggedPattern implements Matcher {
  private readonly _inner: DCBORTaggedPattern;

  private constructor(inner: DCBORTaggedPattern) {
    this._inner = inner;
  }

  /**
   * Creates a new TaggedPattern that matches any tagged value.
   */
  static any(): TaggedPattern {
    return new TaggedPattern(taggedPatternAny());
  }

  /**
   * Creates a new TaggedPattern with a specific tag and content pattern.
   */
  static withTag(tag: Tag, pattern: DCBORPattern): TaggedPattern {
    return new TaggedPattern(taggedPatternWithTag(tag, pattern));
  }

  /**
   * Creates a new TaggedPattern with a specific tag name and content pattern.
   */
  static withName(name: string, pattern: DCBORPattern): TaggedPattern {
    return new TaggedPattern(taggedPatternWithName(name, pattern));
  }

  /**
   * Creates a new TaggedPattern with a tag name matching regex and content pattern.
   */
  static withRegex(regex: RegExp, pattern: DCBORPattern): TaggedPattern {
    return new TaggedPattern(taggedPatternWithRegex(regex, pattern));
  }

  /**
   * Creates a new TaggedPattern from a dcbor-pattern TaggedPattern.
   */
  static fromDcborPattern(dcborPattern: DCBORTaggedPattern): TaggedPattern {
    return new TaggedPattern(dcborPattern);
  }

  /**
   * Gets the underlying dcbor-pattern TaggedPattern.
   */
  get inner(): DCBORTaggedPattern {
    return this._inner;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // Try to extract CBOR from the envelope
    const subject = haystack.subject();
    const cbor = subject.asLeaf();

    if (cbor !== undefined) {
      // Delegate to dcbor-pattern for CBOR matching
      const [dcborPaths, dcborCaptures] = taggedPatternPathsWithCaptures(this._inner, cbor);

      if (dcborPaths.length > 0) {
        // Convert dcbor paths to envelope paths
        const envelopePaths: Path[] = dcborPaths.map((dcborPath: Cbor[]) => {
          const envPath: Path = [haystack];
          // Skip the first element (root) and convert rest to envelopes
          for (let i = 1; i < dcborPath.length; i++) {
            const elem = dcborPath[i];
            if (elem !== undefined) {
              envPath.push(Envelope.newLeaf(elem));
            }
          }
          return envPath;
        });

        // Convert dcbor captures to envelope captures
        const envelopeCaptures = new Map<string, Path[]>();
        for (const [name, paths] of dcborCaptures) {
          const envCapturePaths: Path[] = paths.map((dcborPath: Cbor[]) => {
            const envPath: Path = [haystack];
            for (let i = 1; i < dcborPath.length; i++) {
              const elem = dcborPath[i];
              if (elem !== undefined) {
                envPath.push(Envelope.newLeaf(elem));
              }
            }
            return envPath;
          });
          envelopeCaptures.set(name, envCapturePaths);
        }

        return [envelopePaths, envelopeCaptures];
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
    if (createLeafTaggedPattern === undefined) {
      throw new Error("TaggedPattern factory not registered");
    }
    compileAsAtomic(createLeafTaggedPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return taggedPatternDisplay(this._inner, patternDisplay);
  }

  /**
   * Equality comparison.
   */
  equals(other: TaggedPattern): boolean {
    // Compare by variant type and values
    if (this._inner.variant !== other._inner.variant) {
      return false;
    }
    switch (this._inner.variant) {
      case "Any":
        return true;
      case "Tag": {
        const otherTag = other._inner as { variant: "Tag"; tag: Tag; pattern: DCBORPattern };
        return (
          this._inner.tag.value === otherTag.tag.value &&
          patternDisplay(this._inner.pattern) === patternDisplay(otherTag.pattern)
        );
      }
      case "Name": {
        const otherName = other._inner as { variant: "Name"; name: string; pattern: DCBORPattern };
        return (
          this._inner.name === otherName.name &&
          patternDisplay(this._inner.pattern) === patternDisplay(otherName.pattern)
        );
      }
      case "Regex": {
        const otherRegex = other._inner as {
          variant: "Regex";
          regex: RegExp;
          pattern: DCBORPattern;
        };
        return (
          this._inner.regex.source === otherRegex.regex.source &&
          patternDisplay(this._inner.pattern) === patternDisplay(otherRegex.pattern)
        );
      }
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this._inner.variant) {
      case "Any":
        return 0;
      case "Tag":
        return Number(BigInt(this._inner.tag.value) & BigInt(0xffffffff));
      case "Name":
        return simpleStringHash(this._inner.name);
      case "Regex":
        return simpleStringHash(this._inner.regex.source);
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
