/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Text pattern for dCBOR pattern matching.
 *
 * @module pattern/value/text-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { asText } from "@bcts/dcbor";
import type { Path } from "../../format";

/**
 * Pattern for matching text values in dCBOR.
 */
export type TextPattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: string }
  | { readonly variant: "Regex"; readonly pattern: RegExp };

/**
 * Creates a TextPattern that matches any text.
 */
export const textPatternAny = (): TextPattern => ({ variant: "Any" });

/**
 * Creates a TextPattern that matches a specific text value.
 */
export const textPatternValue = (value: string): TextPattern => ({
  variant: "Value",
  value,
});

/**
 * Creates a TextPattern that matches text by regex.
 */
export const textPatternRegex = (pattern: RegExp): TextPattern => ({
  variant: "Regex",
  pattern,
});

/**
 * Tests if a CBOR value matches this text pattern.
 */
export const textPatternMatches = (pattern: TextPattern, haystack: Cbor): boolean => {
  const value = asText(haystack);
  if (value === undefined) {
    return false;
  }
  switch (pattern.variant) {
    case "Any":
      return true;
    case "Value":
      return value === pattern.value;
    case "Regex":
      return pattern.pattern.test(value);
  }
};

/**
 * Returns paths to matching text values.
 */
export const textPatternPaths = (pattern: TextPattern, haystack: Cbor): Path[] => {
  if (textPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a TextPattern as a string.
 */
export const textPatternDisplay = (pattern: TextPattern): string => {
  switch (pattern.variant) {
    case "Any":
      return "text";
    case "Value": {
      const escaped = pattern.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    case "Regex":
      return `/${pattern.pattern.source}/`;
  }
};
