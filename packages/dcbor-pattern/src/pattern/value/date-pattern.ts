/**
 * Date pattern for dCBOR pattern matching.
 *
 * @module pattern/value/date-pattern
 */

import type { Cbor } from "@bcts/dcbor";
import { CborDate, tagValue, isTagged } from "@bcts/dcbor";
import type { Path } from "../../format";

/**
 * Pattern for matching date values in dCBOR.
 * Dates in CBOR are represented as tagged values with tag 1.
 */
export type DatePattern =
  | { readonly variant: "Any" }
  | { readonly variant: "Value"; readonly value: CborDate }
  | {
      readonly variant: "Range";
      readonly min: CborDate;
      readonly max: CborDate;
    }
  | { readonly variant: "Earliest"; readonly value: CborDate }
  | { readonly variant: "Latest"; readonly value: CborDate }
  | { readonly variant: "StringValue"; readonly value: string }
  | { readonly variant: "Regex"; readonly pattern: RegExp };

/** CBOR tag for date (RFC 8943) */
const DATE_TAG = 1n;

/**
 * Creates a DatePattern that matches any date.
 */
export const datePatternAny = (): DatePattern => ({ variant: "Any" });

/**
 * Creates a DatePattern that matches a specific date.
 */
export const datePatternValue = (value: CborDate): DatePattern => ({
  variant: "Value",
  value,
});

/**
 * Creates a DatePattern that matches dates within a range (inclusive).
 */
export const datePatternRange = (
  min: CborDate,
  max: CborDate,
): DatePattern => ({
  variant: "Range",
  min,
  max,
});

/**
 * Creates a DatePattern that matches dates on or after the specified date.
 */
export const datePatternEarliest = (value: CborDate): DatePattern => ({
  variant: "Earliest",
  value,
});

/**
 * Creates a DatePattern that matches dates on or before the specified date.
 */
export const datePatternLatest = (value: CborDate): DatePattern => ({
  variant: "Latest",
  value,
});

/**
 * Creates a DatePattern that matches dates by their ISO-8601 string representation.
 */
export const datePatternStringValue = (value: string): DatePattern => ({
  variant: "StringValue",
  value,
});

/**
 * Creates a DatePattern that matches dates by regex on their ISO-8601 string.
 */
export const datePatternRegex = (pattern: RegExp): DatePattern => ({
  variant: "Regex",
  pattern,
});

/**
 * Extracts a CborDate from a tagged CBOR value if it's a date (tag 1).
 */
const extractDate = (haystack: Cbor): CborDate | undefined => {
  if (!isTagged(haystack)) {
    return undefined;
  }
  const tag = tagValue(haystack);
  if (tag !== DATE_TAG) {
    return undefined;
  }
  try {
    return CborDate.fromTaggedCbor(haystack);
  } catch {
    return undefined;
  }
};

/**
 * Tests if a CBOR value matches this date pattern.
 */
export const datePatternMatches = (
  pattern: DatePattern,
  haystack: Cbor,
): boolean => {
  const date = extractDate(haystack);
  if (date === undefined) {
    return false;
  }

  switch (pattern.variant) {
    case "Any":
      return true;
    case "Value":
      return date.timestamp() === pattern.value.timestamp();
    case "Range":
      return (
        date.timestamp() >= pattern.min.timestamp() &&
        date.timestamp() <= pattern.max.timestamp()
      );
    case "Earliest":
      return date.timestamp() >= pattern.value.timestamp();
    case "Latest":
      return date.timestamp() <= pattern.value.timestamp();
    case "StringValue":
      return date.toString() === pattern.value;
    case "Regex":
      return pattern.pattern.test(date.toString());
  }
};

/**
 * Returns paths to matching date values.
 */
export const datePatternPaths = (
  pattern: DatePattern,
  haystack: Cbor,
): Path[] => {
  if (datePatternMatches(pattern, haystack)) {
    return [[haystack]];
  }
  return [];
};

/**
 * Formats a DatePattern as a string.
 */
export const datePatternDisplay = (pattern: DatePattern): string => {
  switch (pattern.variant) {
    case "Any":
      return "date";
    case "Value":
      return `date'${pattern.value.toString()}'`;
    case "Range":
      return `date'${pattern.min.toString()}...${pattern.max.toString()}'`;
    case "Earliest":
      return `date'${pattern.value.toString()}...'`;
    case "Latest":
      return `date'...${pattern.value.toString()}'`;
    case "StringValue":
      return `date'${pattern.value}'`;
    case "Regex":
      return `date'/${pattern.pattern.source}/'`;
  }
};

/**
 * Compares two DatePatterns for equality.
 */
export const datePatternEquals = (a: DatePattern, b: DatePattern): boolean => {
  if (a.variant !== b.variant) {
    return false;
  }
  switch (a.variant) {
    case "Any":
      return true;
    case "Value":
    case "Earliest":
    case "Latest":
      return a.value.timestamp() === (b as typeof a).value.timestamp();
    case "Range":
      return (
        a.min.timestamp() === (b as typeof a).min.timestamp() &&
        a.max.timestamp() === (b as typeof a).max.timestamp()
      );
    case "StringValue":
      return a.value === (b as typeof a).value;
    case "Regex":
      return a.pattern.source === (b as typeof a).pattern.source;
  }
};
