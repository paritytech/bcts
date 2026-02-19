/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Tagged CBOR encoding support.
 *
 * This module provides the `CborTaggedEncodable` interface, which enables types to
 * be encoded as tagged CBOR values.
 *
 * CBOR tags provide semantic information about the encoded data. For example,
 * tag 1 is used for dates, indicating that the value should be interpreted
 * as a timestamp. The dCBOR library ensures these tags are encoded
 * deterministically.
 *
 * This interface enables seamless encoding of TypeScript types to properly tagged CBOR
 * values.
 *
 * @module cbor-tagged-encodable
 */

import { type Cbor, MajorType, attachMethods } from "./cbor";
import type { CborTagged } from "./cbor-tagged";
import { CborError } from "./error";

/**
 * Interface for types that can be encoded to CBOR with a specific tag.
 *
 * This interface extends `CborTagged` to provide methods for encoding a value
 * with its associated tag. Types that implement this interface define how they
 * should be represented in CBOR format, both with and without their tag.
 *
 * @example
 * ```typescript
 * // Define a Date type
 * class Date implements CborTaggedEncodable {
 *   constructor(private timestamp: number) {}
 *
 *   cborTags(): Tag[] {
 *     return [createTag(1, 'date')]; // Standard date tag
 *   }
 *
 *   untaggedCbor(): Cbor {
 *     // Date content is represented as a number
 *     return cbor(this.timestamp);
 *   }
 *
 *   taggedCbor(): Cbor {
 *     const tags = this.cborTags();
 *     return {
 *       isCbor: true,
 *       type: MajorType.Tagged,
 *       tag: tags[0].value,
 *       value: this.untaggedCbor()
 *     };
 *   }
 *
 *   taggedCborData(): Uint8Array {
 *     return cborData(this.taggedCbor());
 *   }
 * }
 *
 * // Create a date and encode it
 * const date = new Date(1609459200);
 *
 * // Get the untagged CBOR (just the timestamp)
 * const untagged = date.untaggedCbor();
 *
 * // Get the tagged CBOR (with tag 1)
 * const tagged = date.taggedCbor();
 *
 * // Get binary representation
 * const data = date.taggedCborData();
 * ```
 */
export interface CborTaggedEncodable extends CborTagged {
  /**
   * Returns the untagged CBOR encoding of this instance.
   *
   * This method defines how the value itself (without its tag) should
   * be represented in CBOR format.
   *
   * @returns Untagged CBOR representation
   */
  untaggedCbor(): Cbor;

  /**
   * Returns the tagged CBOR encoding of this instance.
   *
   * This method wraps the result of `untaggedCbor()` with the first tag
   * from `cborTags()`, which is considered the "preferred" tag for the
   * type.
   *
   * Even if a type supports multiple tags for backward-compatible decoding
   * via `cborTags()`, only the first (preferred) tag is used for encoding.
   * This ensures consistency in newly created data while maintaining the
   * ability to read older formats.
   *
   * In most cases, you don't need to override this method.
   *
   * @returns Tagged CBOR representation
   */
  taggedCbor(): Cbor;

  /**
   * Returns the tagged value in CBOR binary representation.
   *
   * This is a convenience method that converts the result of `taggedCbor()`
   * to binary format.
   *
   * @returns Binary CBOR representation
   */
  taggedCborData?(): Uint8Array;
}

/**
 * Helper function to create tagged CBOR from an encodable object.
 *
 * Uses the first tag from cborTags().
 *
 * @param encodable - Object implementing CborTaggedEncodable
 * @returns Tagged CBOR value
 */
export const createTaggedCbor = (encodable: CborTaggedEncodable): Cbor => {
  const tags = encodable.cborTags();
  if (tags.length === 0) {
    throw new CborError({ type: "Custom", message: "No tags defined for this type" });
  }

  const tag = tags[0];
  if (tag === undefined) {
    throw new CborError({ type: "Custom", message: "Tag is undefined" });
  }
  const untagged = encodable.untaggedCbor();

  return attachMethods({
    isCbor: true,
    type: MajorType.Tagged,
    tag: tag.value,
    value: untagged,
  });
};
