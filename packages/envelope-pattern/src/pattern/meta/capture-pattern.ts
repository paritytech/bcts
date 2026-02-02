/**
 * @bcts/envelope-pattern - Capture pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust capture_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/capture-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import { dispatchPathsWithCaptures, dispatchCompile, dispatchPatternToString } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";
import type { Matcher } from "../matcher";

// Forward declaration for Pattern factory (used for late binding)
export let createMetaCapturePattern: ((pattern: CapturePattern) => Pattern) | undefined;

export function registerCapturePatternFactory(factory: (pattern: CapturePattern) => Pattern): void {
  createMetaCapturePattern = factory;
}

/**
 * A pattern that captures a match with a name.
 *
 * Corresponds to the Rust `CapturePattern` struct in capture_pattern.rs
 */
export class CapturePattern implements Matcher {
  private readonly _name: string;
  private readonly _pattern: Pattern;

  private constructor(name: string, pattern: Pattern) {
    this._name = name;
    this._pattern = pattern;
  }

  /**
   * Creates a new CapturePattern with the given name and pattern.
   */
  static new(name: string, pattern: Pattern): CapturePattern {
    return new CapturePattern(name, pattern);
  }

  /**
   * Gets the name of the capture.
   */
  name(): string {
    return this._name;
  }

  /**
   * Gets the inner pattern.
   */
  pattern(): Pattern {
    return this._pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const [paths, caps] = dispatchPathsWithCaptures(this._pattern, haystack);

    if (paths.length > 0) {
      const existing = caps.get(this._name) ?? [];
      caps.set(this._name, [...existing, ...paths]);
    }

    return [paths, caps];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    const id = captures.length;
    captures.push(this._name);
    code.push({ type: "CaptureStart", captureIndex: id });
    dispatchCompile(this._pattern, code, literals, captures);
    code.push({ type: "CaptureEnd", captureIndex: id });
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    return `@${this._name}(${dispatchPatternToString(this._pattern)})`;
  }

  /**
   * Equality comparison.
   */
  equals(other: CapturePattern): boolean {
    return this._name === other._name && this._pattern === other._pattern;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    let hash = 0;
    for (const char of this._name) {
      hash = (hash * 31 + char.charCodeAt(0)) | 0;
    }
    return hash;
  }
}
