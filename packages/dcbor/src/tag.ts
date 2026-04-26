/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * CBOR Tag support for semantic tagging of values.
 *
 * Tags provide semantic information about CBOR data items.
 * For example, tag 1 indicates a date/time value.
 *
 * @module tag
 */

import type { CborNumber } from "./cbor";

/**
 * Numeric tag value type alias.
 *
 * Mirrors Rust `pub type TagValue = u64`. Where Rust narrows to u64, TS
 * accepts the broader `CborNumber` (`number | bigint`) since JavaScript
 * has no native u64 — the runtime guards in `encodeVarInt` enforce the
 * 0..=2^64-1 range.
 */
export type TagValue = CborNumber;

/**
 * A CBOR tag with an optional name.
 *
 * Tags consist of a numeric value and an optional human-readable name.
 *
 * Note on equality: Rust derives `PartialEq` on `Tag` keyed on `value`
 * only — two tags with the same value but different names compare equal.
 * Use {@link tagsEqual} to mirror that behaviour from TypeScript; raw
 * `===` on `Tag` objects compares by reference.
 */
export interface Tag {
  /** The numeric tag value */
  readonly value: TagValue;
  /** Optional human-readable name for the tag */
  readonly name?: string;
}

/**
 * Create a new Tag.
 *
 * @param value - The numeric tag value
 * @param name - Optional human-readable name
 * @returns A new Tag object
 *
 * @example
 * ```typescript
 * const dateTag = createTag(1, 'date');
 * const customTag = createTag(12345, 'myCustomTag');
 * ```
 */
export const createTag = (value: TagValue, name?: string): Tag => {
  if (name !== undefined) {
    return { value, name };
  }
  return { value };
};

/**
 * Create a Tag from just its numeric value, no name attached.
 *
 * Mirrors Rust's `Tag::with_value(v: TagValue)`.
 */
export const tagWithValue = (value: TagValue): Tag => ({ value });

/**
 * Create a Tag with a static (string) name.
 *
 * In Rust this distinguishes `Tag::Static(&'static str)` from
 * `Tag::Dynamic(String)`. TypeScript has no compile-time equivalent — both
 * variants collapse to the same `{ value, name }` object — but the
 * function name is preserved for API parity.
 *
 * Mirrors Rust's `Tag::with_static_name(v, name)`.
 */
export const tagWithStaticName = (value: TagValue, name: string): Tag => ({ value, name });

/**
 * Compare two tags for equality. Mirrors Rust's `PartialEq for Tag`, which
 * compares by `value` only and ignores the optional `name`.
 */
export const tagsEqual = (a: Tag, b: Tag): boolean => {
  if (typeof a.value === "bigint" || typeof b.value === "bigint") {
    return BigInt(a.value) === BigInt(b.value);
  }
  return a.value === b.value;
};

/**
 * Get the string representation of a tag.
 * Internal function used for error messages.
 *
 * @param tag - The tag to represent
 * @returns String representation (name if available, otherwise value)
 *
 * @internal
 */
export const tagToString = (tag: Tag): string => tag.name ?? tag.value.toString();
