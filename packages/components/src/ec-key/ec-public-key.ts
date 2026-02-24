/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * EC compressed public key for ECDSA verification (secp256k1, 33 bytes)
 *
 * An `ECPublicKey` is a 33-byte compressed representation of a public key on
 * the secp256k1 curve. The first byte is a prefix (0x02 or 0x03) that
 * indicates the parity of the y-coordinate, followed by the 32-byte
 * x-coordinate.
 *
 * These public keys are used to:
 * - Verify ECDSA signatures
 * - Identify the owner of a private key without revealing the private key
 *
 * # CBOR Serialization
 *
 * `ECPublicKey` is serialized to CBOR with tags 40306 (or legacy 306).
 *
 * The format is a map:
 * ```
 * #6.40306({
 *   3: h'<33-byte-public-key>' // key data (no key 2 means public key)
 * })
 * ```
 *
 * Ported from bc-components-rust/src/ec_key/ec_public_key.rs
 */

import { ECDSA_PUBLIC_KEY_SIZE, ecdsaVerify, ecdsaDecompressPublicKey } from "@bcts/crypto";
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
import { ECUncompressedPublicKey } from "./ec-uncompressed-public-key.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";
import type { ECPublicKeyBase } from "./ec-key-base.js";

export class ECPublicKey
  implements ECPublicKeyBase, CborTaggedEncodable, CborTaggedDecodable<ECPublicKey>, UREncodable
{
  static readonly KEY_SIZE = ECDSA_PUBLIC_KEY_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== ECDSA_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(ECDSA_PUBLIC_KEY_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Restore an ECPublicKey from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): ECPublicKey {
    return new ECPublicKey(new Uint8Array(data));
  }

  /**
   * Restore an ECPublicKey from a reference to an array of bytes.
   * Validates the length.
   */
  static fromDataRef(data: Uint8Array): ECPublicKey {
    if (data.length !== ECDSA_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(ECDSA_PUBLIC_KEY_SIZE, data.length);
    }
    return ECPublicKey.fromData(data);
  }

  /**
   * Create an ECPublicKey from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): ECPublicKey {
    return ECPublicKey.fromData(data);
  }

  /**
   * Restore an ECPublicKey from a hex string.
   */
  static fromHex(hex: string): ECPublicKey {
    return ECPublicKey.fromData(hexToBytes(hex));
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
   * Returns the compressed public key (self).
   *
   * This method implements the ECKey interface. Since ECPublicKey is already
   * a compressed public key, this returns itself.
   */
  publicKey(): ECPublicKey {
    return this;
  }

  /**
   * Convert this compressed public key to uncompressed format.
   */
  uncompressedPublicKey(): ECUncompressedPublicKey {
    const uncompressed = ecdsaDecompressPublicKey(this._data);
    return ECUncompressedPublicKey.fromData(uncompressed);
  }

  /**
   * Verify an ECDSA signature.
   *
   * @param signature - The 64-byte signature to verify
   * @param message - The message that was signed
   * @returns true if the signature is valid
   */
  verify(signature: Uint8Array, message: Uint8Array): boolean {
    try {
      return ecdsaVerify(this._data, signature, message);
    } catch {
      return false;
    }
  }

  /**
   * Compare with another ECPublicKey.
   */
  equals(other: ECPublicKey): boolean {
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
    return `ECPublicKey(${this.toHex().substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with ECPublicKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_EC_KEY.value, TAG_EC_KEY_V1.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: { 3: h'<33-byte-key>' }
   * Note: No key 2 indicates this is a public key
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
   * Creates an ECPublicKey by decoding it from untagged CBOR.
   *
   * Format: { 3: h'<33-byte-key>' }
   */
  fromUntaggedCbor(cborValue: Cbor): ECPublicKey {
    const map = expectMap(cborValue);

    // Check that key 2 is not present (would indicate private key)
    const isPrivate = map.get<number, boolean>(2);
    if (isPrivate === true) {
      throw new Error("Expected ECPublicKey but found private key (key 2 is true)");
    }

    // Get key data from key 3
    // CborMap.extract() returns native types (Uint8Array for byte strings)
    const keyData = map.extract<number, Uint8Array>(3);
    if (keyData === undefined || keyData.length === 0) {
      throw new Error("ECPublicKey CBOR must have key 3 (data)");
    }

    return ECPublicKey.fromDataRef(keyData);
  }

  /**
   * Creates an ECPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): ECPublicKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): ECPublicKey {
    const dummy = new ECPublicKey(new Uint8Array(ECDSA_PUBLIC_KEY_SIZE));
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): ECPublicKey {
    const cborValue = decodeCbor(data);
    return ECPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): ECPublicKey {
    const cborValue = decodeCbor(data);
    const dummy = new ECPublicKey(new Uint8Array(ECDSA_PUBLIC_KEY_SIZE));
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the ECPublicKey.
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
   * Creates an ECPublicKey from a UR.
   */
  static fromUR(ur: UR): ECPublicKey {
    const name = TAG_EC_KEY.name;
    if (name === undefined) {
      throw new Error("TAG_EC_KEY.name is undefined");
    }
    ur.checkType(name);
    const dummy = new ECPublicKey(new Uint8Array(ECDSA_PUBLIC_KEY_SIZE));
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an ECPublicKey from a UR string.
   */
  static fromURString(urString: string): ECPublicKey {
    const ur = UR.fromURString(urString);
    return ECPublicKey.fromUR(ur);
  }
}
