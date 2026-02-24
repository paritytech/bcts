/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Tagged pattern for dCBOR pattern matching.
 *
 * @module pattern/structure/tagged-pattern
 */

import type { Cbor, Tag } from "@bcts/dcbor";
import { isTagged, tagValue, tagContent } from "@bcts/dcbor";
import type { Path } from "../../format";
import type { Pattern } from "../index";
import { matchPattern, getPatternPathsWithCapturesDirect } from "../match-registry";

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
export const taggedPatternWithTag = (tag: Tag, pattern: Pattern): TaggedPattern => ({
  variant: "Tag",
  tag,
  pattern,
});

/**
 * Creates a TaggedPattern that matches tagged values with a tag having the given name.
 */
export const taggedPatternWithName = (name: string, pattern: Pattern): TaggedPattern => ({
  variant: "Name",
  name,
  pattern,
});

/**
 * Creates a TaggedPattern that matches tagged values with a tag name matching the regex.
 */
export const taggedPatternWithRegex = (regex: RegExp, pattern: Pattern): TaggedPattern => ({
  variant: "Regex",
  regex,
  pattern,
});

/**
 * Compare two tag values, handling both number and bigint types.
 */
const tagsEqual = (a: number | bigint | undefined, b: number | bigint): boolean => {
  if (a === undefined) return false;
  // Convert both to Number for comparison (safe for tag values < 2^53)
  return Number(a) === Number(b);
};

/**
 * Tests if a CBOR value matches this tagged pattern.
 */
export const taggedPatternMatches = (pattern: TaggedPattern, haystack: Cbor): boolean => {
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
      return tagsEqual(tag, pattern.tag.value) && matchPattern(pattern.pattern, content);
    case "Name": {
      // Get tag name from global tags store
      // For now, compare the tag value as string
      const tagName = String(tag);
      return tagName === pattern.name && matchPattern(pattern.pattern, content);
    }
    case "Regex": {
      const tagName = String(tag);
      return pattern.regex.test(tagName) && matchPattern(pattern.pattern, content);
    }
  }
};

/**
 * Returns paths to matching tagged values.
 */
export const taggedPatternPaths = (pattern: TaggedPattern, haystack: Cbor): Path[] => {
  if (taggedPatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Returns paths with captures for a tagged pattern.
 * Collects captures from inner patterns for Tag variant.
 */
export const taggedPatternPathsWithCaptures = (
  pattern: TaggedPattern,
  haystack: Cbor,
): [Path[], Map<string, Path[]>] => {
  if (!isTagged(haystack)) {
    return [[], new Map<string, Path[]>()];
  }

  const tag = tagValue(haystack);
  const content = tagContent(haystack);

  if (content === undefined) {
    return [[], new Map<string, Path[]>()];
  }

  switch (pattern.variant) {
    case "Any":
      // Matches any tagged value, no captures
      return [[[haystack]], new Map<string, Path[]>()];

    case "Tag": {
      if (!tagsEqual(tag, pattern.tag.value)) {
        return [[], new Map<string, Path[]>()];
      }
      // Get paths and captures from inner pattern
      const innerResult = getPatternPathsWithCapturesDirect(pattern.pattern, content);
      if (innerResult.paths.length === 0) {
        return [[], innerResult.captures];
      }

      // Build paths that include the tagged value as root
      const taggedPaths: Path[] = innerResult.paths.map((contentPath: Path) => {
        const path: Cbor[] = [haystack];
        // Skip the content's root in the path
        if (contentPath.length > 1) {
          path.push(...contentPath.slice(1));
        }
        return path;
      });

      // Update captures to include tagged value as root
      const updatedCaptures = new Map<string, Path[]>();
      for (const [name, capturePaths] of innerResult.captures) {
        const updated: Path[] = capturePaths.map((_capturePath: Path) => {
          // For tagged patterns, capture path is [tagged_value, content]
          return [haystack, content];
        });
        updatedCaptures.set(name, updated);
      }

      return [taggedPaths, updatedCaptures];
    }

    case "Name":
    case "Regex":
      // For other variants, fall back to basic paths without captures
      return [taggedPatternPaths(pattern, haystack), new Map<string, Path[]>()];
  }
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
