/**
 * Standard CBOR tag definitions from the IANA registry.
 *
 * @module tags
 * @see https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml
 */

import { type Tag, createTag } from "./tag";

// ============================================================================
// Standard Date/Time Tags
// ============================================================================

/**
 * Tag 0: Standard date/time string (RFC 3339)
 */
export const TAG_DATE_TIME_STRING = 0;

/**
 * Tag 1: Epoch-based date/time (seconds since 1970-01-01T00:00:00Z)
 */
export const TAG_EPOCH_DATE_TIME = 1;

/**
 * Tag 100: Epoch-based date (days since 1970-01-01)
 */
export const TAG_EPOCH_DATE = 100;

// ============================================================================
// Numeric Tags
// ============================================================================

/**
 * Tag 2: Positive bignum (unsigned arbitrary-precision integer)
 */
export const TAG_POSITIVE_BIGNUM = 2;

/**
 * Tag 3: Negative bignum (signed arbitrary-precision integer)
 */
export const TAG_NEGATIVE_BIGNUM = 3;

/**
 * Tag 4: Decimal fraction [exponent, mantissa]
 */
export const TAG_DECIMAL_FRACTION = 4;

/**
 * Tag 5: Bigfloat [exponent, mantissa]
 */
export const TAG_BIGFLOAT = 5;

// ============================================================================
// Encoding Hints
// ============================================================================

/**
 * Tag 21: Expected conversion to base64url encoding
 */
export const TAG_BASE64URL = 21;

/**
 * Tag 22: Expected conversion to base64 encoding
 */
export const TAG_BASE64 = 22;

/**
 * Tag 23: Expected conversion to base16 encoding
 */
export const TAG_BASE16 = 23;

/**
 * Tag 24: Encoded CBOR data item
 */
export const TAG_ENCODED_CBOR = 24;

// ============================================================================
// URI and Network Tags
// ============================================================================

/**
 * Tag 32: URI (text string)
 */
export const TAG_URI = 32;

/**
 * Tag 33: base64url-encoded text
 */
export const TAG_BASE64URL_TEXT = 33;

/**
 * Tag 34: base64-encoded text
 */
export const TAG_BASE64_TEXT = 34;

/**
 * Tag 35: Regular expression (PCRE/ECMA262)
 */
export const TAG_REGEXP = 35;

/**
 * Tag 36: MIME message
 */
export const TAG_MIME_MESSAGE = 36;

/**
 * Tag 37: Binary UUID
 */
export const TAG_UUID = 37;

// ============================================================================
// Cryptography Tags
// ============================================================================

/**
 * Tag 256: string reference (namespace)
 */
export const TAG_STRING_REF_NAMESPACE = 256;

/**
 * Tag 257: binary UUID reference
 */
export const TAG_BINARY_UUID = 257;

/**
 * Tag 258: Set of values (array with no duplicates)
 */
export const TAG_SET = 258;

// ============================================================================
// NOTE: Blockchain Commons envelope and extension tags (TAG_ENVELOPE, TAG_LEAF,
// TAG_KNOWN_VALUE, TAG_COMPRESSED, etc.) are defined in the @bcts/tags
// package, NOT in dcbor. This matches the Rust architecture where bc-dcbor-rust
// only defines TAG_DATE, and bc-tags-rust defines all envelope-related tags.
// ============================================================================

// ============================================================================
// Self-describing CBOR
// ============================================================================

/**
 * Tag 55799: Self-describe CBOR (magic number 0xd9d9f7)
 */
export const TAG_SELF_DESCRIBE_CBOR = 55799;

// ============================================================================
// Global Tags Store Registration
// Matches Rust's register_tags() functionality
// ============================================================================

import type { TagsStore } from "./tags-store";
import { getGlobalTagsStore } from "./tags-store";
import { CborDate } from "./date";
import type { Cbor } from "./cbor";
import { diagnostic } from "./diag";

// Tag constants matching Rust
export const TAG_DATE = 1;
export const TAG_NAME_DATE = "date";

/**
 * Register standard tags in a specific tags store.
 * Matches Rust's register_tags_in() function.
 *
 * @param tagsStore - The tags store to register tags into
 */
export const registerTagsIn = (tagsStore: TagsStore): void => {
  const tags = [createTag(TAG_DATE, TAG_NAME_DATE)];
  tagsStore.insertAll(tags);

  // Set summarizer for date tag
  tagsStore.setSummarizer(TAG_DATE, (untaggedCbor: Cbor, _flat: boolean): string => {
    try {
      return CborDate.fromUntaggedCbor(untaggedCbor).toString();
    } catch {
      return diagnostic(untaggedCbor);
    }
  });
};

/**
 * Register standard tags in the global tags store.
 * Matches Rust's register_tags() function.
 *
 * This function is idempotent - calling it multiple times is safe.
 */
export const registerTags = (): void => {
  const globalStore = getGlobalTagsStore();
  registerTagsIn(globalStore);
};

/**
 * Converts an array of tag values to their corresponding Tag objects.
 * Matches Rust's tags_for_values() function.
 *
 * This function looks up each tag value in the global tag registry and returns
 * an array of complete Tag objects. For any tag values that aren't
 * registered in the global registry, it creates a basic Tag with just the
 * value (no name).
 *
 * @param values - Array of numeric tag values to convert
 * @returns Array of Tag objects corresponding to the input values
 *
 * @example
 * ```typescript
 * // Register some tags first
 * registerTags();
 *
 * // Convert tag values to Tag objects
 * const tags = tagsForValues([1, 42, 999]);
 *
 * // The first tag (value 1) should be registered as "date"
 * console.log(tags[0].value); // 1
 * console.log(tags[0].name); // "date"
 *
 * // Unregistered tags will have a value but no name
 * console.log(tags[1].value); // 42
 * console.log(tags[2].value); // 999
 * ```
 */
export const tagsForValues = (values: (number | bigint)[]): Tag[] => {
  const globalStore = getGlobalTagsStore();
  return values.map((value) => {
    const tag = globalStore.tagForValue(value);
    if (tag !== undefined) {
      return tag;
    }
    // Create basic tag with just the value
    return createTag(value);
  });
};
