/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Not pattern for dCBOR pattern matching.
 * Matches if the inner pattern does NOT match.
 *
 * @module pattern/meta/not-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { matchPattern } from "../match-registry";

/**
 * A pattern that matches if the inner pattern does NOT match.
 */
export interface NotPattern {
  readonly variant: "Not";
  readonly pattern: Pattern;
}

/**
 * Creates a NotPattern with the given inner pattern.
 */
export const notPattern = (pattern: Pattern): NotPattern => ({
  variant: "Not",
  pattern,
});

/**
 * Tests if a CBOR value matches this not pattern.
 * Returns true if the inner pattern does NOT match.
 */
export const notPatternMatches = (pattern: NotPattern, haystack: Cbor): boolean => {
  return !matchPattern(pattern.pattern, haystack);
};

/**
 * Returns paths to matching values.
 */
export const notPatternPaths = (pattern: NotPattern, haystack: Cbor): Path[] => {
  if (notPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Check if a pattern is complex for display purposes.
 * Complex patterns need parentheses when inside a NOT pattern.
 *
 * Mirrors Rust `Matcher::is_complex` cascading dispatch
 * (`bc-dcbor-pattern-rust/src/pattern/meta/{and,or,not,sequence,
 * capture,repeat}_pattern.rs`):
 *
 * - **AndPattern / OrPattern / SequencePattern**: complex iff
 *   `patterns.len() > 1` *or* any inner pattern is itself complex.
 * - **NotPattern**: always complex.
 * - **CapturePattern**: delegates to its inner pattern's `is_complex`.
 * - **AnyPattern / RepeatPattern / value patterns / structure
 *   patterns**: always non-complex.
 *
 * Earlier this port hardcoded `["And", "Or", "Not", "Sequence"]` as
 * complex, which classified `and(x)` (single-element And) as complex
 * even though Rust says it's not — observable in `!and(x)` formatting.
 */
const isComplex = (pattern: Pattern): boolean => {
  if (pattern.kind !== "Meta") return false;
  const meta = pattern.pattern; // discriminated union { type, pattern }
  switch (meta.type) {
    case "Not":
      return true;
    case "And":
    case "Or":
    case "Sequence": {
      const inner = meta.pattern.patterns;
      return inner.length > 1 || inner.some((p) => isComplex(p));
    }
    case "Capture":
      return isComplex(meta.pattern.pattern);
    case "Any":
    case "Repeat":
    case "Search":
      return false;
  }
};

/**
 * Formats a NotPattern as a string.
 */
export const notPatternDisplay = (
  pattern: NotPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  if (isComplex(pattern.pattern)) {
    return `!(${patternDisplay(pattern.pattern)})`;
  }
  return `!${patternDisplay(pattern.pattern)}`;
};
