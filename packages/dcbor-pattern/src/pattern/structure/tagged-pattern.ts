/**
 * Tagged pattern for dCBOR pattern matching.
 *
 * @module pattern/structure/tagged-pattern
 */

import type { Cbor, Tag } from "@bcts/dcbor";
import { isTagged, tagValue, tagContent } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";

/**
 * Pattern for matching CBOR tagged value structures.
 */
export type TaggedPattern =
  | { readonly variant: "Any" }
  | {
      readonly variant: "Tag";
      readonly tag: Tag;
      readonly pattern: Pattern;
    }
  | {
      readonly variant: "Name";
      readonly name: string;
      readonly pattern: Pattern;
    }
  | {
      readonly variant: "Regex";
      readonly regex: RegExp;
      readonly pattern: Pattern;
    };

/**
 * Creates a TaggedPattern that matches any tagged value.
 */
export const taggedPatternAny = (): TaggedPattern => ({ variant: "Any" });

/**
 * Creates a TaggedPattern that matches tagged values with specific tag and content.
 */
export const taggedPatternWithTag = (
  tag: Tag,
  pattern: Pattern,
): TaggedPattern => ({
  variant: "Tag",
  tag,
  pattern,
});

/**
 * Creates a TaggedPattern that matches tagged values with a tag having the given name.
 */
export const taggedPatternWithName = (
  name: string,
  pattern: Pattern,
): TaggedPattern => ({
  variant: "Name",
  name,
  pattern,
});

/**
 * Creates a TaggedPattern that matches tagged values with a tag name matching the regex.
 */
export const taggedPatternWithRegex = (
  regex: RegExp,
  pattern: Pattern,
): TaggedPattern => ({
  variant: "Regex",
  regex,
  pattern,
});

// Forward declaration - will be implemented in pattern/index.ts
declare function patternMatches(pattern: Pattern, haystack: Cbor): boolean;

/**
 * Tests if a CBOR value matches this tagged pattern.
 */
export const taggedPatternMatches = (
  pattern: TaggedPattern,
  haystack: Cbor,
): boolean => {
  if (!isTagged(haystack)) {
    return false;
  }

  const tag = tagValue(haystack);
  const content = tagContent(haystack);

  if (content === undefined) {
    return false;
  }

  switch (pattern.variant) {
    case "Any":
      return true;
    case "Tag":
      return tag === pattern.tag.value && patternMatches(pattern.pattern, content);
    case "Name": {
      // Get tag name from global tags store
      // For now, compare the tag value as string
      const tagName = String(tag);
      return tagName === pattern.name && patternMatches(pattern.pattern, content);
    }
    case "Regex": {
      const tagName = String(tag);
      return pattern.regex.test(tagName) && patternMatches(pattern.pattern, content);
    }
  }
};

/**
 * Returns paths to matching tagged values.
 */
export const taggedPatternPaths = (
  pattern: TaggedPattern,
  haystack: Cbor,
): Path[] => {
  if (taggedPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a TaggedPattern as a string.
 */
export const taggedPatternDisplay = (
  pattern: TaggedPattern,
  patternDisplay: (p: Pattern) => string,
): string => {
  switch (pattern.variant) {
    case "Any":
      return "tagged";
    case "Tag":
      return `tagged(${pattern.tag.value}, ${patternDisplay(pattern.pattern)})`;
    case "Name":
      return `tagged(${pattern.name}, ${patternDisplay(pattern.pattern)})`;
    case "Regex":
      return `tagged(/${pattern.regex.source}/, ${patternDisplay(pattern.pattern)})`;
  }
};

/**
 * Compares two TaggedPatterns for equality.
 */
export const taggedPatternEquals = (
  a: TaggedPattern,
  b: TaggedPattern,
  patternEquals: (p1: Pattern, p2: Pattern) => boolean,
): boolean => {
  if (a.variant !== b.variant) {
    return false;
  }
  switch (a.variant) {
    case "Any":
      return true;
    case "Tag":
      return (
        a.tag.value === (b as typeof a).tag.value &&
        patternEquals(a.pattern, (b as typeof a).pattern)
      );
    case "Name":
      return (
        a.name === (b as typeof a).name &&
        patternEquals(a.pattern, (b as typeof a).pattern)
      );
    case "Regex":
      return (
        a.regex.source === (b as typeof a).regex.source &&
        patternEquals(a.pattern, (b as typeof a).pattern)
      );
  }
};
