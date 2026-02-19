/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Tagged CBOR decoding support.
 *
 * This module provides the `CborTaggedDecodable` interface, which enables types to
 * be decoded from tagged CBOR values.
 *
 * Tagged CBOR values include semantic information about how to interpret the
 * data. This interface allows TypeScript types to verify that incoming CBOR data has the
 * expected tag(s) and to decode the data appropriately.
 *
 * @module cbor-tagged-decodable
 */

import { type Cbor, MajorType } from "./cbor";
import type { CborTagged } from "./cbor-tagged";
import type { Tag } from "./tag";
import { CborError } from "./error";

/**
 * Interface for types that can be decoded from CBOR with a specific tag.
 *
 * This interface extends `CborTagged` to provide methods for
 * decoding tagged CBOR data into TypeScript types. It handles verification that
 * the CBOR data has the expected tag(s) and provides utilities for both
 * tagged and untagged decoding.
 *
 * @example
 * ```typescript
 * // Define a Date type
 * class Date implements CborTaggedDecodable<Date> {
 *   constructor(public timestamp: number) {}
 *
 *   cborTags(): Tag[] {
 *     return [createTag(1, 'date')]; // Standard date tag
 *   }
 *
 *   fromUntaggedCbor(cbor: Cbor): Date {
 *     // Convert the untagged CBOR to a number
 *     if (cbor.type !== MajorType.Unsigned) {
 *       throw new Error('Wrong type');
 *     }
 *     const timestamp = typeof cbor.value === 'bigint' ? Number(cbor.value) : cbor.value;
 *     return new Date(timestamp);
 *   }
 *
 *   fromTaggedCbor(cbor: Cbor): Date {
 *     if (cbor.type !== MajorType.Tagged) {
 *       throw new Error('Wrong type');
 *     }
 *
 *     const tags = this.cborTags();
 *     const tagValues = tags.map(t => t.value);
 *     if (!tagValues.includes(cbor.tag as number)) {
 *       throw new Error(`Wrong tag: expected ${tagValues[0]}, got ${cbor.tag}`);
 *     }
 *
 *     return this.fromUntaggedCbor(cbor.value);
 *   }
 *
 *   static fromTaggedCborData(data: Uint8Array): Date {
 *     const cbor = decodeCbor(data);
 *     return new Date(0).fromTaggedCbor(cbor);
 *   }
 *
 *   static fromUntaggedCborData(data: Uint8Array): Date {
 *     const cbor = decodeCbor(data);
 *     return new Date(0).fromUntaggedCbor(cbor);
 *   }
 * }
 *
 * // Create tagged CBOR data
 * const taggedCbor = {
 *   isCbor: true,
 *   type: MajorType.Tagged,
 *   tag: 1,
 *   value: cbor(1609459200)
 * };
 *
 * // Decode using the interface
 * const date = new Date(0).fromTaggedCbor(taggedCbor);
 * assert(date.timestamp === 1609459200);
 * ```
 */
export interface CborTaggedDecodable<T> extends CborTagged {
  /**
   * Creates an instance of this type by decoding it from untagged CBOR.
   *
   * This method defines how to interpret the CBOR content (without
   * considering the tag) and convert it to the implementing type.
   *
   * @param cbor - Untagged CBOR value
   * @returns Decoded instance
   * @throws Error if the CBOR value cannot be decoded
   */
  fromUntaggedCbor(cbor: Cbor): T;

  /**
   * Creates an instance of this type by decoding it from tagged CBOR.
   *
   * This method first verifies that the CBOR value has one of the expected
   * tags (as defined by `cborTags()`), then delegates to
   * `fromUntaggedCbor()` to decode the content.
   *
   * For backward compatibility, this method accepts any tag from the
   * `cborTags()` array, not just the first one. This allows new
   * versions of types to still accept data tagged with older/alternative
   * tag values.
   *
   * In most cases, you don't need to override this method.
   *
   * @param cbor - Tagged CBOR value
   * @returns Decoded instance
   * @throws Error if the CBOR value has the wrong tag or cannot be decoded
   */
  fromTaggedCbor(cbor: Cbor): T;

  /**
   * Creates an instance of this type by decoding it from binary encoded
   * tagged CBOR.
   *
   * This is a convenience method that first parses the binary data into a
   * CBOR value, then uses `fromTaggedCbor()` to decode it.
   *
   * @param data - Binary CBOR data
   * @returns Decoded instance
   * @throws Error if the data cannot be parsed or decoded
   */
  fromTaggedCborData?(data: Uint8Array): T;

  /**
   * Creates an instance of this type by decoding it from binary encoded
   * untagged CBOR.
   *
   * This is a convenience method that first parses the binary data into a
   * CBOR value, then uses `fromUntaggedCbor()` to decode it.
   *
   * @param data - Binary CBOR data
   * @returns Decoded instance
   * @throws Error if the data cannot be parsed or decoded
   */
  fromUntaggedCborData?(data: Uint8Array): T;
}

/**
 * Helper function to validate that a CBOR value has one of the expected tags.
 *
 * @param cbor - CBOR value to validate
 * @param expectedTags - Array of valid tags
 * @returns The matching tag
 * @throws Error if the value is not tagged or has an unexpected tag
 */
export const validateTag = (cbor: Cbor, expectedTags: Tag[]): Tag => {
  if (cbor.type !== MajorType.Tagged) {
    throw new CborError({ type: "WrongType" });
  }

  const expectedValues = expectedTags.map((t) => t.value);
  const tagValue = cbor.tag;

  const matchingTag = expectedTags.find((t) => t.value === tagValue);
  if (matchingTag === undefined) {
    const expectedStr = expectedValues.join(" or ");
    throw new CborError({
      type: "Custom",
      message: `Wrong tag: expected ${expectedStr}, got ${tagValue}`,
    });
  }

  return matchingTag;
};

/**
 * Helper function to extract the content from a tagged CBOR value.
 *
 * @param cbor - Tagged CBOR value
 * @returns The untagged content
 * @throws Error if the value is not tagged
 */
export const extractTaggedContent = (cbor: Cbor): Cbor => {
  if (cbor.type !== MajorType.Tagged) {
    throw new CborError({ type: "WrongType" });
  }
  return cbor.value;
};
