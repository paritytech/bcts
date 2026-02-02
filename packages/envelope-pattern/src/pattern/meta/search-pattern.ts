/**
 * @bcts/envelope-pattern - Search pattern matching
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust search_pattern.rs
 *
 * @module envelope-pattern/pattern/meta/search-pattern
 */

import type { Envelope } from "@bcts/envelope";
import type { Path } from "../../format";
import { dispatchPaths, dispatchPatternToString } from "../matcher";
import type { Instr } from "../vm";
import type { Pattern } from "../index";
import type { Matcher } from "../matcher";

// Forward declaration for Pattern factory (used for late binding)
export let createMetaSearchPattern: ((pattern: SearchPattern) => Pattern) | undefined;

export function registerSearchPatternFactory(factory: (pattern: SearchPattern) => Pattern): void {
  createMetaSearchPattern = factory;
}

/**
 * A pattern that searches the entire envelope tree for matches.
 *
 * Corresponds to the Rust `SearchPattern` struct in search_pattern.rs
 */
export class SearchPattern implements Matcher {
  private readonly _pattern: Pattern;

  private constructor(pattern: Pattern) {
    this._pattern = pattern;
  }

  /**
   * Creates a new SearchPattern with the given pattern.
   */
  static new(pattern: Pattern): SearchPattern {
    return new SearchPattern(pattern);
  }

  /**
   * Gets the inner pattern.
   */
  pattern(): Pattern {
    return this._pattern;
  }

  pathsWithCaptures(haystack: Envelope): [Path[], Map<string, Path[]>] {
    const resultPaths: Path[] = [];

    // Walk the envelope tree
    this._walkEnvelope(haystack, [], (currentEnvelope, pathToCurrent) => {
      // Create the path to this node
      const newPath: Envelope[] = [...pathToCurrent, currentEnvelope];

      // Test the pattern against this node
      const patternPaths = dispatchPaths(this._pattern, currentEnvelope);

      // If the pattern matches, emit the full paths
      for (const patternPath of patternPaths) {
        const fullPath = [...newPath];
        // If the pattern path has elements beyond just the current envelope,
        // extend with those additional elements.
        if (patternPath.length > 1) {
          fullPath.push(...patternPath.slice(1));
        } else if (patternPath.length === 1) {
          const firstEnv = patternPath[0];
          if (firstEnv !== undefined && !firstEnv.digest().equals(currentEnvelope.digest())) {
            // Pattern found a different element, add it to the path
            fullPath.push(...patternPath);
          }
        }
        resultPaths.push(fullPath);
      }
    });

    // Deduplicate paths by digest
    const seen = new Set<string>();
    const uniquePaths: Path[] = [];
    for (const path of resultPaths) {
      const digestPath = path.map((e) => e.digest().hex()).join(",");
      if (!seen.has(digestPath)) {
        seen.add(digestPath);
        uniquePaths.push(path);
      }
    }

    return [uniquePaths, new Map<string, Path[]>()];
  }

  /**
   * Walk the envelope tree recursively.
   */
  private _walkEnvelope(
    envelope: Envelope,
    pathToCurrent: Envelope[],
    visitor: (envelope: Envelope, path: Envelope[]) => void,
  ): void {
    // Visit this node
    visitor(envelope, pathToCurrent);

    // Get the subject
    const subject = envelope.subject();
    const newPath = [...pathToCurrent, envelope];

    // Walk subject if it's different from this envelope
    if (!subject.digest().equals(envelope.digest())) {
      this._walkEnvelope(subject, newPath, visitor);
    }

    // Walk assertions
    for (const assertion of envelope.assertions()) {
      this._walkEnvelope(assertion, newPath, visitor);

      // Walk predicate and object if available
      const predicate = assertion.asPredicate?.();
      if (predicate !== undefined) {
        const assertionPath = [...newPath, assertion];
        this._walkEnvelope(predicate, assertionPath, visitor);
      }

      const object = assertion.asObject?.();
      if (object !== undefined) {
        const assertionPath = [...newPath, assertion];
        this._walkEnvelope(object, assertionPath, visitor);
      }
    }

    // Walk wrapped content if present
    if (subject.isWrapped()) {
      const unwrapped = subject.tryUnwrap?.();
      if (unwrapped !== undefined) {
        this._walkEnvelope(unwrapped, newPath, visitor);
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
    const idx = literals.length;
    literals.push(this._pattern);

    // Collect capture names from inner pattern
    const innerNames: string[] = [];
    collectCaptureNames(this._pattern, innerNames);

    const captureMap: [string, number][] = [];
    for (const name of innerNames) {
      let pos = captures.indexOf(name);
      if (pos === -1) {
        pos = captures.length;
        captures.push(name);
      }
      captureMap.push([name, pos]);
    }

    code.push({ type: "Search", patternIndex: idx, captureMap });
  }

  isComplex(): boolean {
    return true;
  }

  toString(): string {
    return `search(${dispatchPatternToString(this._pattern)})`;
  }

  /**
   * Equality comparison.
   */
  equals(other: SearchPattern): boolean {
    return this._pattern === other._pattern;
  }

  /**
   * Hash code for use in Maps/Sets.
   */
  hashCode(): number {
    return 1;
  }
}

/**
 * Collect capture names from a pattern.
 */
function collectCaptureNames(pattern: Pattern, out: string[]): void {
  // This will be properly implemented when Pattern type is fully defined
  // For now, we check if it has a collectCaptureNames method
  const p = pattern as unknown as { collectCaptureNames?: (out: string[]) => void };
  if (p.collectCaptureNames !== undefined) {
    p.collectCaptureNames(out);
  }
}
