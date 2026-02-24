/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Node pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust node_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/node-pattern
 */

import type { Envelope } from "@bcts/envelope";
import { Interval } from "@bcts/dcbor-pattern";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import { compileAsAtomic } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructureNodePattern: ((pattern: NodePattern) => Pattern) | undefined;

export function registerNodePatternFactory(factory: (pattern: NodePattern) => Pattern): void {
  createStructureNodePattern = factory;
}

/**
 * Pattern type for node pattern matching.
 *
 * Corresponds to the Rust `NodePattern` enum in node_pattern.rs
 */
export type NodePatternType =
  | { readonly type: "Any" }
  | { readonly type: "AssertionsInterval"; readonly interval: Interval }
  | { readonly type: "WithSubject"; readonly subjectPattern: Pattern };

/**
 * Pattern for matching node envelopes.
 *
 * Corresponds to the Rust `NodePattern` enum in node_pattern.rs
 */
export class NodePattern implements Matcher {
  private readonly _pattern: NodePatternType;

  private constructor(pattern: NodePatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new NodePattern that matches any node.
   */
  static any(): NodePattern {
    return new NodePattern({ type: "Any" });
  }

  /**
   * Creates a new NodePattern that matches a node with the specified count of assertions.
   */
  static interval(min: number, max?: number): NodePattern {
    const interval = max !== undefined ? Interval.from(min, max) : Interval.atLeast(min);
    return new NodePattern({ type: "AssertionsInterval", interval });
  }

  /**
   * Creates a new NodePattern from an Interval.
   */
  static fromInterval(interval: Interval): NodePattern {
    return new NodePattern({ type: "AssertionsInterval", interval });
  }

  /**
   * Creates a new NodePattern with a subject pattern constraint.
   */
  static withSubject(subjectPattern: Pattern): NodePattern {
    return new NodePattern({ type: "WithSubject", subjectPattern });
  }

  /**
   * Gets the pattern type.
   */
  get patternType(): NodePatternType {
    return this._pattern;
  }

  /**
   * Gets the subject pattern if this is a WithSubject type, undefined otherwise.
   */
  subjectPattern(): Pattern | undefined {
    return this._pattern.type === "WithSubject" ? this._pattern.subjectPattern : undefined;
  }

  /**
   * Gets the assertion patterns (empty array if none).
   */
  assertionPatterns(): Pattern[] {
    // NodePattern doesn't support assertion patterns directly; return empty array
    return [];
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    if (!haystack.isNode()) {
      return [[], new Map<string, Path[]>()];
    }

    let isHit = false;

    switch (this._pattern.type) {
      case "Any":
        isHit = true;
        break;
      case "AssertionsInterval":
        isHit = this._pattern.interval.contains(haystack.assertions().length);
        break;
      case "WithSubject":
        // For WithSubject, we match if the node exists (subject pattern matching done at higher level)
        isHit = true;
        break;
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
    if (createStructureNodePattern === undefined) {
      throw new Error("NodePattern factory not registered");
    }
    compileAsAtomic(createStructureNodePattern(this), code, literals, captures);
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "node";
      case "AssertionsInterval":
        return `node(${this._pattern.interval.toString()})`;
      case "WithSubject":
        return `node(${(this._pattern.subjectPattern as unknown as { toString(): string }).toString()})`;
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: NodePattern): boolean {
    if (this._pattern.type !== other._pattern.type) {
      return false;
    }
    switch (this._pattern.type) {
      case "Any":
        return true;
      case "AssertionsInterval":
        return this._pattern.interval.equals(
          (other._pattern as { type: "AssertionsInterval"; interval: Interval }).interval,
        );
      case "WithSubject":
        // Simple reference equality for pattern (could be improved with deep equality)
        return (
          this._pattern.subjectPattern ===
          (other._pattern as { type: "WithSubject"; subjectPattern: Pattern }).subjectPattern
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
      case "AssertionsInterval":
        // Simple hash based on interval min/max
        return this._pattern.interval.min() * 31 + (this._pattern.interval.max() ?? 0);
      case "WithSubject":
        return 1;
    }
  }
}
