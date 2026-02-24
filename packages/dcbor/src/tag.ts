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
 * A CBOR tag with an optional name.
 *
 * Tags consist of a numeric value and an optional human-readable name.
 */
export interface Tag {
  /** The numeric tag value */
  readonly value: CborNumber;
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
export const createTag = (value: CborNumber, name?: string): Tag => {
  if (name !== undefined) {
    return { value, name };
  }
  return { value };
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
