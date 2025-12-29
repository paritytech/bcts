/**
 * @bcts/envelope-pattern - Map pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust map_pattern.rs
 *
 * @module envelope-pattern/pattern/leaf/map-pattern
 */

import type { Envelope } from "@bcts/envelope";
import { asCborMap } from "@bcts/dcbor";
import { Interval } from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createLeafMapPattern: ((pattern: MapPattern) => Pattern) | undefined;

export function registerMapPatternFactory(factory: (pattern: MapPattern) => Pattern): void {
  createLeafMapPattern = factory;
}

/**
 * Pattern for matching map values.
 *
 * Corresponds to the Rust `MapPattern` enum in map_pattern.rs
 */
export type MapPatternType =
  | { readonly type: "Any" }
  | { readonly type: "Interval"; readonly interval: Interval };

/**
 * Pattern for matching map values in envelope leaf nodes.
 *
 * Corresponds to the Rust `MapPattern` struct in map_pattern.rs
 */
export class MapPattern implements Matcher {
  readonly #pattern: MapPatternType;

  private constructor(pattern: MapPatternType) {
    this.#pattern = pattern;
  }

  /**
   * Creates a new MapPattern that matches any map.
   */
  static any(): MapPattern {
    return new MapPattern({ type: "Any" });
  }

  /**
   * Creates a new MapPattern that matches maps within a size range.
   */
  static interval(min: number, max?: number): MapPattern {
    const interval = max !== undefined
      ? Interval.from(min, max)
      : Interval.atLeast(min);
    return new MapPattern({ type: "Interval", interval });
  }

  /**
   * Gets the pattern type.
   */
  get pattern(): MapPatternType {
    return this.#pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    // Try to extract CBOR from the envelope
    const cbor = haystack.asLeaf();
    if (cbor === undefined) {
      return [[], new Map<string, Path[]>()];
    }

    // Check if it's a map
    const map = asCborMap(cbor);
    if (map === undefined) {
      return [[], new Map<string, Path[]>()];
    }

    switch (this.#pattern.type) {
      case "Any":
        return [[[haystack]], new Map<string, Path[]>()];

      case "Interval": {
        const size = map.size;
        if (this.#pattern.interval.contains(size)) {
          return [[[haystack]], new Map<string, Path[]>()];
        }
        return [[], new Map<string, Path[]>()];
      }
    }
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (createLeafMapPattern === undefined) {
      throw new Error("MapPattern factory not registered");
    }
    compileAsAtomic(createLeafMapPattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this.#pattern.type) {
      case "Any":
        return "{*}";
      case "Interval":
        return `{{${this.#pattern.interval}}}`;
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: MapPattern): boolean {
    if (this.#pattern.type !== other.#pattern.type) {
      return false;
    }
    switch (this.#pattern.type) {
      case "Any":
        return true;
      case "Interval":
        return this.#pattern.interval.equals(
          (other.#pattern as { type: "Interval"; interval: Interval }).interval
        );
    }
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    switch (this.#pattern.type) {
      case "Any":
        return 0;
      case "Interval":
        // Simple hash based on interval min/max
        return this.#pattern.interval.min() * 31 + (this.#pattern.interval.max() ?? 0);
    }
  }
}
