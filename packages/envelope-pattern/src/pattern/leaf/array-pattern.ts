/**
 * @bcts/envelope-pattern - Array pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust array_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/array-pattern
 */

import { Envelope } from "@bcts/envelope";
import { asCborArray, type Cbor } from "@bcts/dcbor";
import {
  type Pattern as DCBORPattern,
  Interval,
  patternPathsWithCaptures as dcborPatternPathsWithCaptures,
  patternDisplay as dcborPatternDisplay,
} from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafArrayPattern: ((pattern: ArrayPattern) => Pattern) | undefined;

export function registerArrayPatternFactory(factory: (pattern: ArrayPattern) => Pattern): void {
  createLeafArrayPattern = factory;
}

/**
 * Pattern for matching array values.
 *
 * Corresponds to the Rust `ArrayPattern` enum in array_pattern.rs
 */
export type ArrayPatternType =
  | { readonly type: "Any" }
  | { readonly type: "Interval"; readonly interval: Interval }
  | { readonly type: "DCBORPattern"; readonly pattern: DCBORPattern }
  | { readonly type: "WithPatterns"; readonly patterns: Pattern[] };

/**
 * Pattern for matching array values in envelope leaf nodes.
 *
 * Corresponds to the Rust `ArrayPattern` struct in array_pattern.rs
 */
export class ArrayPattern implements Matcher {
  private readonly _pattern: ArrayPatternType;

  private constructor(pattern: ArrayPatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new ArrayPattern that matches any array.
   */
  static any(): ArrayPattern {
    return new ArrayPattern({ type: "Any" });
  }

  /**
   * Creates a new ArrayPattern that matches arrays with a specific length.
   */
  static count(count: number): ArrayPattern {
    return new ArrayPattern({
      type: "Interval",
      interval: Interval.exactly(count),
    });
  }

  /**
   * Creates a new ArrayPattern that matches arrays within a length range.
   */
  static interval(min: number, max?: number): ArrayPattern {
    const interval = max !== undefined ? Interval.from(min, max) : Interval.atLeast(min);
    return new ArrayPattern({ type: "Interval", interval });
  }

  /**
   * Creates a new ArrayPattern from a dcbor-pattern.
   */
  static fromDcborPattern(dcborPattern: DCBORPattern): ArrayPattern {
    return new ArrayPattern({ type: "DCBORPattern", pattern: dcborPattern });
  }

  /**
   * Creates a new ArrayPattern with envelope patterns for element matching.
   */
  static withPatterns(patterns: Pattern[]): ArrayPattern {
    return new ArrayPattern({ type: "WithPatterns", patterns });
  }

  /**
   * Gets the pattern type.
   */
  get pattern(): ArrayPatternType {
    return this._pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // Try to extract CBOR from the envelope
    const cbor = haystack.asLeaf();
    if (cbor === undefined) {
      return [[], new Map<string, Path[]>()];
    }

    // Check if it's an array
    const array = asCborArray(cbor);
    if (array === undefined) {
      return [[], new Map<string, Path[]>()];
    }

    switch (this._pattern.type) {
      case "Any":
        return [[[haystack]], new Map<string, Path[]>()];

      case "Interval": {
        const length = array.length;
        if (this._pattern.interval.contains(length)) {
          return [[[haystack]], new Map<string, Path[]>()];
        }
        return [[], new Map<string, Path[]>()];
      }

      case "DCBORPattern": {
        // Delegate to dcbor-pattern for matching
        const { paths: dcborPaths, captures: dcborCaptures } = dcborPatternPathsWithCaptures(
          this._pattern.pattern,
          cbor,
        );

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
          for (const [name, capturePaths] of dcborCaptures) {
            const envCapturePaths: Path[] = capturePaths.map((dcborPath: Cbor[]) => {
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

        return [[], new Map<string, Path[]>()];
      }

      case "WithPatterns":
        // For envelope patterns, match if array length equals patterns count
        // Full element-by-element matching would require additional implementation
        if (array.length === this._pattern.patterns.length) {
          return [[[haystack]], new Map<string, Path[]>()];
        }
        return [[], new Map<string, Path[]>()];
    }
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (createLeafArrayPattern === undefined) {
      throw new Error("ArrayPattern factory not registered");
    }
    compileAsAtomic(createLeafArrayPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "[*]";
      case "Interval":
        return `[{${this._pattern.interval.toString()}}]`;
      case "DCBORPattern":
        return dcborPatternDisplay(this._pattern.pattern);
      case "WithPatterns":
        return `[${this._pattern.patterns.map(String).join(", ")}]`;
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: ArrayPattern): boolean {
    if (this._pattern.type !== other._pattern.type) {
      return false;
    }
    switch (this._pattern.type) {
      case "Any":
        return true;
      case "Interval":
        return this._pattern.interval.equals(
          (other._pattern as { type: "Interval"; interval: Interval }).interval,
        );
      case "DCBORPattern":
        // Compare using display representation
        return (
          dcborPatternDisplay(this._pattern.pattern) ===
          dcborPatternDisplay(
            (other._pattern as { type: "DCBORPattern"; pattern: DCBORPattern }).pattern,
          )
        );
      case "WithPatterns": {
        const otherPatterns = (other._pattern as { type: "WithPatterns"; patterns: Pattern[] })
          .patterns;
        if (this._pattern.patterns.length !== otherPatterns.length) return false;
        for (let i = 0; i < this._pattern.patterns.length; i++) {
          if (this._pattern.patterns[i] !== otherPatterns[i]) return false;
        }
        return true;
      }
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this._pattern.type) {
      case "Any":
        return 0;
      case "Interval":
        // Simple hash based on min/max
        return this._pattern.interval.min() * 31 + (this._pattern.interval.max() ?? 0);
      case "DCBORPattern":
        // Simple hash based on display string
        return simpleStringHash(dcborPatternDisplay(this._pattern.pattern));
      case "WithPatterns":
        return this._pattern.patterns.length;
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
