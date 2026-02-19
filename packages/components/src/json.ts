/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * A CBOR-tagged container for UTF-8 JSON text.
 *
 * Ported from bc-components-rust/src/json.rs
 *
 * The `JSON` type wraps UTF-8 JSON text as a CBOR byte string with tag 262.
 * This allows JSON data to be embedded within CBOR structures while
 * maintaining type information through the tag.
 *
 * This implementation does not validate that the contained data is well-formed
 * JSON. It simply provides a type-safe wrapper around byte data that is
 * intended to contain JSON text.
 *
 * # CBOR Serialization
 *
 * `JSON` implements the CBOR tagged encoding interfaces, which means it can be
 * serialized to and deserialized from CBOR with tag 262 (`TAG_JSON`).
 *
 * @example
 * ```typescript
 * import { JSON } from '@bcts/components';
 *
 * // Create JSON from a string
 * const json = JSON.fromString('{"key": "value"}');
 * console.log(json.asStr()); // {"key": "value"}
 *
 * // Create JSON from bytes
 * const json2 = JSON.fromData(new TextEncoder().encode('[1, 2, 3]'));
 * console.log(json2.len()); // 9
 * ```
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  toByteString,
  expectBytes,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { JSON as TAG_JSON } from "@bcts/tags";
import { bytesToHex, hexToBytes } from "./utils.js";

/**
 * A CBOR-tagged container for UTF-8 JSON text.
 *
 * Wraps UTF-8 JSON text as a CBOR byte string with tag 262.
 * This allows JSON data to be embedded within CBOR structures while
 * maintaining type information through the tag.
 */
export class JSON implements CborTaggedEncodable, CborTaggedDecodable<JSON> {
  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new JSON instance from byte data.
   */
  static fromData(data: Uint8Array): JSON {
    return new JSON(data);
  }

  /**
   * Create a new JSON instance from a string.
   */
  static fromString(s: string): JSON {
    const encoder = new TextEncoder();
    return new JSON(encoder.encode(s));
  }

  /**
   * Create a new JSON instance from a hexadecimal string.
   */
  static fromHex(hex: string): JSON {
    return new JSON(hexToBytes(hex));
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Return the length of the JSON data in bytes.
   */
  len(): number {
    return this._data.length;
  }

  /**
   * Return true if the JSON data is empty.
   */
  isEmpty(): boolean {
    return this._data.length === 0;
  }

  /**
   * Return the data as a byte slice.
   */
  asBytes(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Return the data as a UTF-8 string slice.
   *
   * @throws Error if the data is not valid UTF-8.
   */
  asStr(): string {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(this._data);
  }

  /**
   * Return the data as a hexadecimal string.
   */
  hex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Return a copy of the underlying data.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Compare with another JSON.
   */
  equals(other: JSON): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `JSON(${this.asStr()})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with JSON.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_JSON.value]);
  }

  /**
   * Returns the untagged CBOR encoding (as a byte string).
   */
  untaggedCbor(): Cbor {
    return toByteString(this._data);
  }

  /**
   * Returns the tagged CBOR encoding.
   */
  taggedCbor(): Cbor {
    return createTaggedCbor(this);
  }

  /**
   * Returns the tagged value in CBOR binary representation.
   */
  taggedCborData(): Uint8Array {
    return this.taggedCbor().toData();
  }

  // ============================================================================
  // CBOR Deserialization (CborTaggedDecodable)
  // ============================================================================

  /**
   * Creates a JSON by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): JSON {
    const data = expectBytes(cborValue);
    return JSON.fromData(data);
  }

  /**
   * Creates a JSON by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): JSON {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): JSON {
    const instance = JSON.fromString("");
    return instance.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): JSON {
    const cborValue = decodeCbor(data);
    return JSON.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): JSON {
    const cborValue = decodeCbor(data);
    const instance = JSON.fromString("");
    return instance.fromUntaggedCbor(cborValue);
  }
}
