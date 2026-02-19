/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Byte string utilities for dCBOR.
 *
 * Represents a CBOR byte string (major type 2).
 *
 * `ByteString` is a wrapper around a byte array, optimized for use in CBOR
 * encoding and decoding operations. It provides a richer API for working with
 * byte data in the context of CBOR compared to using raw `Uint8Array` values.
 *
 * In dCBOR, byte strings follow the general deterministic encoding rules:
 * - They must use definite-length encoding
 * - Their length must be encoded in the shortest possible form
 *
 * @module byte-string
 */

import { type Cbor, MajorType, cbor as toCbor } from "./cbor";
import { CborError } from "./error";

/**
 * Represents a CBOR byte string (major type 2).
 *
 * Use Cases:
 * - Binary data such as images, audio, or other non-text content
 * - Cryptographic values like hashes, signatures, and public keys
 * - Embedded CBOR (wrapped with tag 24)
 * - Other serialized data formats embedded in CBOR
 *
 * @example
 * ```typescript
 * // Creating a byte string from various sources
 * const bytes1 = new ByteString(new Uint8Array([1, 2, 3, 4]));
 * const bytes2 = ByteString.from([5, 6, 7, 8]);
 * const bytes3 = ByteString.from(new Uint8Array([9, 10, 11, 12]));
 *
 * // Converting to and from CBOR
 * const cborValue = bytes1.toCbor();
 *
 * // ByteString provides Uint8Array-like operations
 * const bytes = new ByteString(new Uint8Array([1, 2]));
 * bytes.extend(new Uint8Array([3, 4]));
 * assert(bytes.len() === 4);
 * assert.deepEqual(bytes.data(), new Uint8Array([1, 2, 3, 4]));
 * ```
 */
export class ByteString {
  private _data: Uint8Array;

  /**
   * Creates a new `ByteString` from a Uint8Array or array of bytes.
   *
   * @param data - The byte data
   *
   * @example
   * ```typescript
   * // From a Uint8Array
   * const bytes1 = new ByteString(new Uint8Array([1, 2, 3, 4]));
   *
   * // From a number array
   * const bytes2 = new ByteString(new Uint8Array([5, 6, 7, 8]));
   * ```
   */
  constructor(data: Uint8Array | number[]) {
    if (Array.isArray(data)) {
      this._data = new Uint8Array(data);
    } else {
      this._data = new Uint8Array(data);
    }
  }

  /**
   * Creates a new `ByteString` from various input types.
   *
   * @param data - Uint8Array, number array, or string
   * @returns New ByteString instance
   *
   * @example
   * ```typescript
   * const bytes1 = ByteString.from([1, 2, 3, 4]);
   * const bytes2 = ByteString.from(new Uint8Array([5, 6, 7, 8]));
   * const bytes3 = ByteString.from("hello");
   * ```
   */
  static from(data: Uint8Array | number[] | string): ByteString {
    if (typeof data === "string") {
      return new ByteString(new TextEncoder().encode(data));
    }
    return new ByteString(data);
  }

  /**
   * Returns a reference to the underlying byte data.
   *
   * @returns The raw bytes
   *
   * @example
   * ```typescript
   * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
   * assert.deepEqual(bytes.data(), new Uint8Array([1, 2, 3, 4]));
   *
   * // You can use standard slice operations on the result
   * assert.deepEqual(bytes.data().slice(1, 3), new Uint8Array([2, 3]));
   * ```
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Returns the length of the byte string in bytes.
   *
   * @returns Number of bytes
   *
   * @example
   * ```typescript
   * const empty = new ByteString(new Uint8Array([]));
   * assert(empty.len() === 0);
   *
   * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
   * assert(bytes.len() === 4);
   * ```
   */
  len(): number {
    return this._data.length;
  }

  /**
   * Returns `true` if the byte string contains no bytes.
   *
   * @returns true if empty
   *
   * @example
   * ```typescript
   * const empty = new ByteString(new Uint8Array([]));
   * assert(empty.isEmpty());
   *
   * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
   * assert(!bytes.isEmpty());
   * ```
   */
  isEmpty(): boolean {
    return this._data.length === 0;
  }

  /**
   * Extends the byte string with additional bytes.
   *
   * @param other - Bytes to append
   *
   * @example
   * ```typescript
   * const bytes = new ByteString(new Uint8Array([1, 2]));
   * bytes.extend(new Uint8Array([3, 4]));
   * assert.deepEqual(bytes.data(), new Uint8Array([1, 2, 3, 4]));
   *
   * // You can extend with different types
   * bytes.extend([5, 6]);
   * assert.deepEqual(bytes.data(), new Uint8Array([1, 2, 3, 4, 5, 6]));
   * ```
   */
  extend(other: Uint8Array | number[]): void {
    const otherArray = Array.isArray(other) ? new Uint8Array(other) : other;
    const newData = new Uint8Array(this._data.length + otherArray.length);
    newData.set(this._data, 0);
    newData.set(otherArray, this._data.length);
    this._data = newData;
  }

  /**
   * Creates a new Uint8Array containing a copy of the byte string's data.
   *
   * @returns Copy of the data
   *
   * @example
   * ```typescript
   * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
   * const arr = bytes.toUint8Array();
   * assert.deepEqual(arr, new Uint8Array([1, 2, 3, 4]));
   *
   * // The returned array is a clone, so you can modify it independently
   * const arr2 = bytes.toUint8Array();
   * arr2[0] = 99;
   * assert.deepEqual(bytes.data(), new Uint8Array([1, 2, 3, 4])); // original unchanged
   * ```
   */
  toUint8Array(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Returns an iterator over the bytes in the byte string.
   *
   * @returns Iterator yielding each byte
   *
   * @example
   * ```typescript
   * const bytes = new ByteString(new Uint8Array([1, 2, 3]));
   * const iter = bytes.iter();
   *
   * assert(iter.next().value === 1);
   * assert(iter.next().value === 2);
   * assert(iter.next().value === 3);
   * assert(iter.next().done);
   *
   * // You can also use for loops
   * let sum = 0;
   * for (const byte of bytes) {
   *   sum += byte;
   * }
   * assert(sum === 6);
   * ```
   */
  iter(): Iterator<number> {
    return this._data.values();
  }

  /**
   * Makes ByteString iterable.
   */
  [Symbol.iterator](): Iterator<number> {
    return this.iter();
  }

  /**
   * Converts the ByteString to a CBOR value.
   *
   * @returns CBOR byte string
   *
   * @example
   * ```typescript
   * const bytes = new ByteString(new Uint8Array([1, 2, 3, 4]));
   * const cborValue = bytes.toCbor();
   * ```
   */
  toCbor(): Cbor {
    return toCbor(this._data);
  }

  /**
   * Attempts to convert a CBOR value into a ByteString.
   *
   * @param cbor - CBOR value
   * @returns ByteString if successful
   * @throws Error if the CBOR value is not a byte string
   *
   * @example
   * ```typescript
   * const cborValue = toCbor(new Uint8Array([1, 2, 3, 4]));
   * const bytes = ByteString.fromCbor(cborValue);
   * assert.deepEqual(bytes.data(), new Uint8Array([1, 2, 3, 4]));
   *
   * // Converting from a different CBOR type throws
   * const cborInt = toCbor(42);
   * try {
   *   ByteString.fromCbor(cborInt); // throws
   * } catch(e) {
   *   // Error: Wrong type
   * }
   * ```
   */
  static fromCbor(cbor: Cbor): ByteString {
    if (cbor.type !== MajorType.ByteString) {
      throw new CborError({ type: "WrongType" });
    }
    return new ByteString(cbor.value);
  }

  /**
   * Get element at index.
   *
   * @param index - Index to access
   * @returns Byte at index or undefined
   */
  at(index: number): number | undefined {
    return this._data[index];
  }

  /**
   * Equality comparison.
   *
   * @param other - ByteString to compare with
   * @returns true if equal
   */
  equals(other: ByteString): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Clone this ByteString.
   *
   * @returns New ByteString with copied data
   */
  clone(): ByteString {
    return new ByteString(this.toUint8Array());
  }
}
