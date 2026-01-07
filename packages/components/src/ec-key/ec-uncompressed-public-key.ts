/**
 * EC uncompressed public key for ECDSA (secp256k1, 65 bytes)
 *
 * An `ECUncompressedPublicKey` is a 65-byte uncompressed representation of a
 * public key on the secp256k1 curve. The first byte is 0x04 (uncompressed prefix),
 * followed by the 32-byte x-coordinate and 32-byte y-coordinate.
 *
 * While compressed public keys (33 bytes) are preferred for space efficiency,
 * uncompressed keys are sometimes needed for compatibility with legacy systems.
 *
 * # CBOR Serialization
 *
 * `ECUncompressedPublicKey` is serialized to CBOR with tags 40306 (or legacy 306).
 *
 * The format is a map:
 * ```
 * #6.40306({
 *   3: h'<65-byte-uncompressed-public-key>' // key data
 * })
 * ```
 *
 * Ported from bc-components-rust/src/ec_key/ec_uncompressed_public_key.rs
 */

import { ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE, ecdsaCompressPublicKey } from "@bcts/crypto";
import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  toByteString,
  expectMap,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { EC_KEY as TAG_EC_KEY, EC_KEY_V1 as TAG_EC_KEY_V1 } from "@bcts/tags";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";
import type { ECKeyBase } from "./ec-key-base.js";

export class ECUncompressedPublicKey
  implements
    ECKeyBase,
    CborTaggedEncodable,
    CborTaggedDecodable<ECUncompressedPublicKey>,
    UREncodable
{
  static readonly KEY_SIZE = ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Restore an ECUncompressedPublicKey from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): ECUncompressedPublicKey {
    return new ECUncompressedPublicKey(new Uint8Array(data));
  }

  /**
   * Restore an ECUncompressedPublicKey from a reference to an array of bytes.
   * Validates the length.
   */
  static fromDataRef(data: Uint8Array): ECUncompressedPublicKey {
    if (data.length !== ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE, data.length);
    }
    return ECUncompressedPublicKey.fromData(data);
  }

  /**
   * Create an ECUncompressedPublicKey from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): ECUncompressedPublicKey {
    return ECUncompressedPublicKey.fromData(data);
  }

  /**
   * Restore an ECUncompressedPublicKey from a hex string.
   */
  static fromHex(hex: string): ECUncompressedPublicKey {
    return ECUncompressedPublicKey.fromData(hexToBytes(hex));
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Get a reference to the fixed-size array of bytes.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Get the raw public key bytes (copy).
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Get hex string representation.
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
   * Convert to compressed public key format.
   * Note: Returns the compressed bytes. To get ECPublicKey, use the ec-public-key module.
   */
  compressedData(): Uint8Array {
    return ecdsaCompressPublicKey(this._data);
  }

  /**
   * Compare with another ECUncompressedPublicKey.
   */
  equals(other: ECUncompressedPublicKey): boolean {
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
    return `ECUncompressedPublicKey(${this.toHex().substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with ECUncompressedPublicKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_EC_KEY.value, TAG_EC_KEY_V1.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: { 3: h'<65-byte-key>' }
   */
  untaggedCbor(): Cbor {
    const map = new Map<number, unknown>();
    map.set(3, toByteString(this._data));
    return cbor(map);
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
   * Creates an ECUncompressedPublicKey by decoding it from untagged CBOR.
   *
   * Format: { 3: h'<65-byte-key>' }
   */
  fromUntaggedCbor(cborValue: Cbor): ECUncompressedPublicKey {
    const map = expectMap(cborValue);

    // Check that key 2 is not present (would indicate private key)
    const isPrivate = map.get<number, boolean>(2);
    if (isPrivate === true) {
      throw new Error("Expected ECUncompressedPublicKey but found private key");
    }

    // Get key data from key 3
    // CborMap.extract() returns native types (Uint8Array for byte strings)
    const keyData = map.extract<number, Uint8Array>(3);
    if (keyData === undefined || keyData.length === 0) {
      throw new Error("ECUncompressedPublicKey CBOR must have key 3 (data)");
    }

    return ECUncompressedPublicKey.fromDataRef(keyData);
  }

  /**
   * Creates an ECUncompressedPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): ECUncompressedPublicKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): ECUncompressedPublicKey {
    const dummy = new ECUncompressedPublicKey(new Uint8Array(ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE));
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): ECUncompressedPublicKey {
    const cborValue = decodeCbor(data);
    return ECUncompressedPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): ECUncompressedPublicKey {
    const cborValue = decodeCbor(data);
    const dummy = new ECUncompressedPublicKey(new Uint8Array(ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE));
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the ECUncompressedPublicKey.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    const name = TAG_EC_KEY.name;
    if (name === undefined) {
      throw new Error("TAG_EC_KEY.name is undefined");
    }
    return UR.new(name, this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an ECUncompressedPublicKey from a UR.
   */
  static fromUR(ur: UR): ECUncompressedPublicKey {
    const name = TAG_EC_KEY.name;
    if (name === undefined) {
      throw new Error("TAG_EC_KEY.name is undefined");
    }
    ur.checkType(name);
    const dummy = new ECUncompressedPublicKey(new Uint8Array(ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE));
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an ECUncompressedPublicKey from a UR string.
   */
  static fromURString(urString: string): ECUncompressedPublicKey {
    const ur = UR.fromURString(urString);
    return ECUncompressedPublicKey.fromUR(ur);
  }
}
