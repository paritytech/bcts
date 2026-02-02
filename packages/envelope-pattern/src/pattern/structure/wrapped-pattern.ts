/**
 * @bcts/envelope-pattern - Wrapped pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust wrapped_pattern.rs
 *
 * @module envelope-pattern/pattern/structure/wrapped-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import type { Matcher } from "../matcher";
import type { Instr, Axis } from "../vm";
import type { Pattern } from "../index";

// Forward declaration for Pattern factory
let createStructureWrappedPattern: ((pattern: WrappedPattern) => Pattern) | undefined;

// Forward declaration for pattern dispatch (avoids circular imports)
let dispatchPatternPathsWithCaptures:
  | ((pattern: Pattern, haystack: Envelope) => [Path[], Map<string, Path[]>])
  | undefined;
let dispatchPatternCompile:
  | ((pattern: Pattern, code: Instr[], literals: Pattern[], captures: string[]) => void)
  | undefined;
let dispatchPatternToString: ((pattern: Pattern) => string) | undefined;

export function registerWrappedPatternFactory(factory: (pattern: WrappedPattern) => Pattern): void {
  createStructureWrappedPattern = factory;
}

export function registerWrappedPatternDispatch(dispatch: {
  pathsWithCaptures: (pattern: Pattern, haystack: Envelope) => [Path[], Map<string, Path[]>];
  compile: (pattern: Pattern, code: Instr[], literals: Pattern[], captures: string[]) => void;
  toString: (pattern: Pattern) => string;
}): void {
  dispatchPatternPathsWithCaptures = dispatch.pathsWithCaptures;
  dispatchPatternCompile = dispatch.compile;
  dispatchPatternToString = dispatch.toString;
}

/**
 * Pattern type for wrapped pattern matching.
 *
 * Corresponds to the Rust `WrappedPattern` enum in wrapped_pattern.rs
 */
export type WrappedPatternType =
  | { readonly type: "Any" }
  | { readonly type: "Unwrap"; readonly pattern: Pattern };

/**
 * Represents patterns for matching wrapped envelopes.
 *
 * Corresponds to the Rust `WrappedPattern` enum in wrapped_pattern.rs
 */
export class WrappedPattern implements Matcher {
  private readonly _pattern: WrappedPatternType;

  private constructor(pattern: WrappedPatternType) {
    this._pattern = pattern;
  }

  /**
   * Creates a new WrappedPattern that matches any wrapped envelope without descending.
   */
  static new(): WrappedPattern {
    return new WrappedPattern({ type: "Any" });
  }

  /**
   * Creates a new WrappedPattern that matches a wrapped envelope and also matches
   * on its unwrapped content.
   */
  static unwrapMatching(pattern: Pattern): WrappedPattern {
    return new WrappedPattern({ type: "Unwrap", pattern });
  }

  /**
   * Creates a new WrappedPattern that matches any wrapped envelope and descends into it.
   * Note: This requires Pattern.any() to be available, so it's set up during registration.
   */
  static unwrap(): WrappedPattern {
    // This will be filled in when Pattern.any() is available
    // For now, create a placeholder that will be replaced
    return new WrappedPattern({ type: "Any" }); // Will be overwritten
  }

  /**
   * Gets the pattern type.
   */
  get patternType(): WrappedPatternType {
    return this._pattern;
  }

  /**
   * Gets the inner pattern if this is an Unwrap type, undefined otherwise.
   */
  innerPattern(): Pattern | undefined {
    return this._pattern.type === "Unwrap" ? this._pattern.pattern : undefined;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const subject = haystack.subject();

    if (!subject.isWrapped()) {
      return [[], new Map<string, Path[]>()];
    }

    let paths: Path[];

    switch (this._pattern.type) {
      case "Any":
        // Just match the wrapped envelope itself, don't descend
        paths = [[haystack]];
        break;
      case "Unwrap": {
        // Match the content of the wrapped envelope
        const unwrapped = subject.tryUnwrap?.();
        if (unwrapped !== undefined && dispatchPatternPathsWithCaptures !== undefined) {
          const [innerPaths] = dispatchPatternPathsWithCaptures(this._pattern.pattern, unwrapped);
          paths = innerPaths.map((path) => {
            // Add the current envelope to the path
            return [haystack, ...path];
          });
        } else {
          paths = [];
        }
        break;
      }
    }

    return [paths, new Map<string, Path[]>()];
  }

  paths(haystack: Envelope): Path[] {
    return this.pathsWithCaptures(haystack)[0];
  }

  matches(haystack: Envelope): boolean {
    return this.paths(haystack).length > 0;
  }

  compile(code: Instr[], literals: Pattern[], captures: string[]): void {
    if (createStructureWrappedPattern === undefined) {
      throw new Error("WrappedPattern factory not registered");
    }

    switch (this._pattern.type) {
      case "Any": {
        // Just match the wrapped envelope itself, don't descend
        const idx = literals.length;
        literals.push(createStructureWrappedPattern(this));
        code.push({ type: "MatchStructure", literalIndex: idx });
        break;
      }
      case "Unwrap": {
        // First match that it's wrapped
        const idx = literals.length;
        literals.push(createStructureWrappedPattern(WrappedPattern.new()));
        code.push({ type: "MatchStructure", literalIndex: idx });

        // Then move into inner envelope
        const axis: Axis = "Wrapped";
        code.push({ type: "PushAxis", axis });

        // Then match the pattern
        if (dispatchPatternCompile !== undefined) {
          dispatchPatternCompile(this._pattern.pattern, code, literals, captures);
        }
        break;
      }
    }
  }

  isComplex(): boolean {
    return false;
  }

  toString(): string {
    switch (this._pattern.type) {
      case "Any":
        return "wrapped";
      case "Unwrap": {
        const patternStr = dispatchPatternToString !== undefined
          ? dispatchPatternToString(this._pattern.pattern)
          : "*";
        if (patternStr === "*") {
          return "unwrap";
        }
        return `unwrap(${patternStr})`;
      }
    }
  }

  /**
   * Equality comparison.
   */
  equals(other: WrappedPattern): boolean {
    if (this._pattern.type !== other._pattern.type) {
      return false;
    }
    if (this._pattern.type === "Any") {
      return true;
    }
    const thisPattern = (this._pattern as { type: "Unwrap"; pattern: Pattern }).pattern;
    const otherPattern = (other._pattern as { type: "Unwrap"; pattern: Pattern }).pattern;
    return thisPattern === otherPattern;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return this._pattern.type === "Any" ? 0 : 1;
  }
}
