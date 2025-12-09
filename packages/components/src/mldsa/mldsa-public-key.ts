/**
 * MLDSAPublicKey - ML-DSA Public Key for post-quantum signature verification
 *
 * MLDSAPublicKey wraps an ML-DSA public key for verifying signatures.
 * It supports all three security levels (MLDSA44, MLDSA65, MLDSA87).
 *
 * # CBOR Serialization
 *
 * MLDSAPublicKey is serialized with tag 40104:
 * ```
 * #6.40104([level, h'<public-key-bytes>'])
 * ```
 *
 * # UR Serialization
 *
 * UR type: `mldsa-public-key`
 *
 * Ported from bc-components-rust/src/mldsa/mldsa_public_key.rs
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  expectArray,
  expectInteger,
  expectBytes,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { MLDSA_PUBLIC_KEY as TAG_MLDSA_PUBLIC_KEY } from "@bcts/tags";

import {
  MLDSALevel,
  mldsaLevelFromValue,
  mldsaLevelToString,
  mldsaPublicKeySize,
  mldsaVerify,
} from "./mldsa-level.js";
import type { MLDSASignature } from "./mldsa-signature.js";
import { bytesToHex } from "../utils.js";

/**
 * MLDSAPublicKey - Post-quantum signature verification key using ML-DSA.
 */
export class MLDSAPublicKey
  implements CborTaggedEncodable, CborTaggedDecodable<MLDSAPublicKey>, UREncodable
{
  private readonly _level: MLDSALevel;
  private readonly _data: Uint8Array;

  private constructor(level: MLDSALevel, data: Uint8Array) {
    const expectedSize = mldsaPublicKeySize(level);
    if (data.length !== expectedSize) {
      throw new Error(
        `MLDSAPublicKey (${mldsaLevelToString(level)}) must be ${expectedSize} bytes, got ${data.length}`,
      );
    }
    this._level = level;
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an MLDSAPublicKey from raw bytes.
   *
   * @param level - The ML-DSA security level
   * @param data - The public key bytes
   */
  static fromBytes(level: MLDSALevel, data: Uint8Array): MLDSAPublicKey {
    return new MLDSAPublicKey(level, data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the security level of this key.
   */
  level(): MLDSALevel {
    return this._level;
  }

  /**
   * Returns the raw key bytes.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Returns a copy of the raw key bytes.
   */
  data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Returns the size of the key in bytes.
   */
  size(): number {
    return this._data.length;
  }

  /**
   * Verify a signature against a message.
   *
   * @param signature - The ML-DSA signature to verify
   * @param message - The message that was signed
   * @returns True if the signature is valid
   */
  verify(signature: MLDSASignature, message: Uint8Array): boolean {
    if (signature.level() !== this._level) {
      return false;
    }
    return mldsaVerify(this._level, this._data, message, signature.asBytes());
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another MLDSAPublicKey.
   */
  equals(other: MLDSAPublicKey): boolean {
    if (this._level !== other._level) return false;
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
    const hex = bytesToHex(this._data);
    return `MLDSAPublicKey(${mldsaLevelToString(this._level)}, ${hex.substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with MLDSAPublicKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_MLDSA_PUBLIC_KEY.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: [level, key_bytes]
   */
  untaggedCbor(): Cbor {
    return cbor([this._level, this._data]);
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
   * Creates an MLDSAPublicKey by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): MLDSAPublicKey {
    const elements = expectArray(cborValue);
    if (elements.length !== 2) {
      throw new Error(`MLDSAPublicKey CBOR must have 2 elements, got ${elements.length}`);
    }
    const levelValue = Number(expectInteger(elements[0]));
    const level = mldsaLevelFromValue(levelValue);
    const data = expectBytes(elements[1]);
    return MLDSAPublicKey.fromBytes(level, data);
  }

  /**
   * Creates an MLDSAPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): MLDSAPublicKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): MLDSAPublicKey {
    // Create a minimal dummy instance for decoding
    const dummyData = new Uint8Array(mldsaPublicKeySize(MLDSALevel.MLDSA44));
    const dummy = new MLDSAPublicKey(MLDSALevel.MLDSA44, dummyData);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): MLDSAPublicKey {
    const cborValue = decodeCbor(data);
    return MLDSAPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): MLDSAPublicKey {
    const cborValue = decodeCbor(data);
    const dummyData = new Uint8Array(mldsaPublicKeySize(MLDSALevel.MLDSA44));
    const dummy = new MLDSAPublicKey(MLDSALevel.MLDSA44, dummyData);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_MLDSA_PUBLIC_KEY.name;
    if (name === undefined) {
      throw new Error("MLDSA_PUBLIC_KEY tag name is undefined");
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
   * Creates an MLDSAPublicKey from a UR.
   */
  static fromUR(ur: UR): MLDSAPublicKey {
    if (ur.urTypeStr() !== TAG_MLDSA_PUBLIC_KEY.name) {
      throw new Error(`Expected UR type ${TAG_MLDSA_PUBLIC_KEY.name}, got ${ur.urTypeStr()}`);
    }
    const dummyData = new Uint8Array(mldsaPublicKeySize(MLDSALevel.MLDSA44));
    const dummy = new MLDSAPublicKey(MLDSALevel.MLDSA44, dummyData);
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an MLDSAPublicKey from a UR string.
   */
  static fromURString(urString: string): MLDSAPublicKey {
    const ur = UR.fromURString(urString);
    return MLDSAPublicKey.fromUR(ur);
  }
}
