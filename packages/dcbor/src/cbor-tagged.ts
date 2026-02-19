/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Base trait for types that have associated CBOR tags.
 *
 * CBOR allows values to be "tagged" with semantic information using tag
 * numbers. The dCBOR library provides a set of interfaces for working with tagged
 * values in a type-safe manner.
 *
 * Tags in CBOR provide additional context about how a value should be
 * interpreted. For example, tag 1 is used for dates, indicating the value is a
 * timestamp.
 *
 * This interface system allows TypeScript types to define their associated CBOR tags
 * and provide serialization/deserialization logic specifically for tagged
 * values.
 *
 * @module cbor-tagged
 */

import type { Tag } from "./tag";

/**
 * Interface for types that have associated CBOR tags.
 *
 * In CBOR, tags provide semantic information about how to interpret data
 * items. This interface defines which CBOR tag(s) are associated with a particular
 * TypeScript type.
 *
 * Implementing this interface is a prerequisite for implementing
 * `CborTaggedEncodable` and `CborTaggedDecodable`.
 *
 * ## Multiple Tags for Backward Compatibility
 *
 * The `cborTags()` method returns an array of tags, enabling support for
 * backward compatibility with older tag versions:
 *
 * - **When encoding**: Only the first tag in the array is used for
 *   serialization
 * - **When decoding**: Any of the tags in the array will be accepted
 *
 * This design solves several real-world problems:
 *
 * 1. **IANA Registration Simplification**: If you initially choose a tag in
 *    the Specification Required range (24-32767) and later want to move to the
 *    simpler First Come, First Served range (32768+), you can migrate while
 *    maintaining compatibility with existing data.
 *
 * 2. **Protocol Evolution**: As your protocol evolves, you can introduce new
 *    preferred tags while still supporting data encoded with older tags.
 *
 * 3. **Versioning**: Different tags can represent different versions of your
 *    data format while sharing the same TypeScript type for handling.
 *
 * @example
 * ```typescript
 * // Single tag
 * class Date implements CborTagged {
 *   cborTags(): Tag[] {
 *     return [createTag(1, 'date')];
 *   }
 * }
 *
 * // Multiple tags for backward compatibility
 * class Seed implements CborTagged {
 *   cborTags(): Tag[] {
 *     return [
 *       createTag(40300, 'seed'),  // Primary tag (used for encoding)
 *       createTag(300, 'seed-legacy'), // Legacy tag (accepted for decoding)
 *     ];
 *   }
 * }
 * ```
 */
export interface CborTagged {
  /**
   * Returns the CBOR tags associated with this type.
   *
   * This method should return an array of tags in order of preference:
   *
   * - The first tag in the array is the "preferred" tag and will be used
   *   when encoding values of this type via
   *   `CborTaggedEncodable.taggedCbor()`.
   *
   * - All tags in the array are considered equivalent for decoding. When
   *   `CborTaggedDecodable.fromTaggedCbor()` is called, any tag in this
   *   array will be accepted as valid for this type.
   *
   * This design enables backward compatibility: you can introduce a new tag
   * (placed first in the array) while still supporting older tags for
   * decoding.
   *
   * For standard CBOR tags, you can use predefined tag constants from the
   * `tags` module, or create custom tags with `createTag()`.
   */
  cborTags(): Tag[];
}

// Re-export interfaces and functions from separate modules for convenience
export { type CborTaggedEncodable, createTaggedCbor } from "./cbor-tagged-encodable";
export {
  type CborTaggedDecodable,
  validateTag,
  extractTaggedContent,
} from "./cbor-tagged-decodable";
export { type CborTaggedCodable } from "./cbor-tagged-codable";
