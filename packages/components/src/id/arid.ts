/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * An "Apparently Random Identifier" (ARID)
 *
 * Ported from bc-components-rust/src/id/arid.rs
 *
 * An ARID is a cryptographically strong, universally unique identifier with
 * the following properties:
 * - Non-correlatability: The sequence of bits cannot be correlated with its
 *   referent or any other ARID
 * - Neutral semantics: Contains no inherent type information
 * - Open generation: Any method of generation is allowed as long as it
 *   produces statistically random bits
 * - Minimum strength: Must be 256 bits (32 bytes) in length
 * - Cryptographic suitability: Can be used as inputs to cryptographic
 *   constructs
 *
 * Unlike digests/hashes which identify a fixed, immutable state of data, ARIDs
 * can serve as stable identifiers for mutable data structures.
 *
 * ARIDs should not be confused with or cast to/from other identifier types
 * (like UUIDs), used as nonces, keys, or cryptographic seeds.
 *
 * As defined in [BCR-2022-002](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2022-002-arid.md).
 *
 * # CBOR Serialization
 *
 * `ARID` implements the CBOR tagged encoding interfaces, which means it can be
 * serialized to and deserialized from CBOR with a specific tag (TAG_ARID = 40012).
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), an `ARID` is represented as a
 * binary blob with the type "arid".
 *
 * @example
 * ```typescript
 * import { ARID } from '@bcts/components';
 *
 * // Create a new random ARID
 * const arid = ARID.new();
 *
 * // Create an ARID from a hex string
 * const arid2 = ARID.fromHex("...");
 *
 * // Get the ARID as hex
 * console.log(arid.hex());
 * ```
 */

import { SecureRandomNumberGenerator } from "@bcts/rand";
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
import { ARID as TAG_ARID } from "@bcts/tags";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class ARID implements CborTaggedEncodable, CborTaggedDecodable<ARID>, UREncodable {
  static readonly ARID_SIZE = 32;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== ARID.ARID_SIZE) {
      throw CryptoError.invalidSize(ARID.ARID_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new random ARID.
   */
  static new(): ARID {
    const rng = new SecureRandomNumberGenerator();
    return new ARID(rng.randomData(ARID.ARID_SIZE));
  }

  /**
   * Create a new random ARID (alias for new()).
   */
  static random(): ARID {
    return ARID.new();
  }

  /**
   * Restore an ARID from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): ARID {
    return new ARID(new Uint8Array(data));
  }

  /**
   * Create a new ARID from a reference to an array of bytes.
   */
  static fromDataRef(data: Uint8Array): ARID {
    if (data.length !== ARID.ARID_SIZE) {
      throw CryptoError.invalidSize(ARID.ARID_SIZE, data.length);
    }
    return ARID.fromData(data);
  }

  /**
   * Create an ARID from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): ARID {
    return ARID.fromData(data);
  }

  /**
   * Create a new ARID from the given hexadecimal string.
   *
   * @throws Error if the string is not exactly 64 hexadecimal digits.
   */
  static fromHex(hex: string): ARID {
    return new ARID(hexToBytes(hex));
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Get the data of the ARID as an array of bytes.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Get the data of the ARID as a byte slice.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get the raw ARID bytes as a copy.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * The data as a hexadecimal string.
   */
  hex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Get hex string representation (alias for hex()).
   */
  toHex(): string {
    return this.hex();
  }

  /**
   * Get base64 representation.
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * The first four bytes of the ARID as a hexadecimal string.
   */
  shortDescription(): string {
    return bytesToHex(this._data.slice(0, 4));
  }

  /**
   * Compare with another ARID.
   */
  equals(other: ARID): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Compare ARIDs lexicographically.
   */
  compare(other: ARID): number {
    for (let i = 0; i < this._data.length; i++) {
      const a = this._data[i];
      const b = other._data[i];
      if (a < b) return -1;
      if (a > b) return 1;
    }
    return 0;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `ARID(${this.hex()})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with ARID.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_ARID.value]);
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
   * Creates an ARID by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): ARID {
    const data = expectBytes(cbor);
    return ARID.fromDataRef(data);
  }

  /**
   * Creates an ARID by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): ARID {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): ARID {
    const instance = new ARID(new Uint8Array(ARID.ARID_SIZE));
    return instance.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): ARID {
    const cbor = decodeCbor(data);
    return ARID.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): ARID {
    const cbor = decodeCbor(data);
    const bytes = expectBytes(cbor);
    return ARID.fromDataRef(bytes);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the ARID.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("arid", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an ARID from a UR.
   */
  static fromUR(ur: UR): ARID {
    ur.checkType("arid");
    const instance = new ARID(new Uint8Array(ARID.ARID_SIZE));
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an ARID from a UR string.
   */
  static fromURString(urString: string): ARID {
    const ur = UR.fromURString(urString);
    return ARID.fromUR(ur);
  }

  /**
   * Alias for fromURString for Rust API compatibility.
   */
  static fromUrString(urString: string): ARID {
    return ARID.fromURString(urString);
  }
}
