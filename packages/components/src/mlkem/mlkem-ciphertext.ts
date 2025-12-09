/**
 * MLKEMCiphertext - ML-KEM Ciphertext for post-quantum key encapsulation
 *
 * MLKEMCiphertext wraps an ML-KEM ciphertext for transmission and decapsulation.
 * It supports all three security levels (MLKEM512, MLKEM768, MLKEM1024).
 *
 * # CBOR Serialization
 *
 * MLKEMCiphertext is serialized with tag 40102:
 * ```
 * #6.40102([level, h'<ciphertext-bytes>'])
 * ```
 *
 * # UR Serialization
 *
 * UR type: `mlkem-ciphertext`
 *
 * Ported from bc-components-rust/src/mlkem/mlkem_ciphertext.rs
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  expectArray,
  expectInt,
  expectBytes,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@blockchain-commons/dcbor";
import { UR, type UREncodable } from "@blockchain-commons/uniform-resources";
import { MLKEM_CIPHERTEXT as TAG_MLKEM_CIPHERTEXT } from "@blockchain-commons/tags";

import {
  MLKEMLevel,
  mlkemLevelFromValue,
  mlkemLevelToString,
  mlkemCiphertextSize,
} from "./mlkem-level.js";
import { bytesToHex } from "../utils.js";

/**
 * MLKEMCiphertext - Post-quantum key encapsulation ciphertext using ML-KEM.
 */
export class MLKEMCiphertext
  implements CborTaggedEncodable, CborTaggedDecodable<MLKEMCiphertext>, UREncodable
{
  private readonly _level: MLKEMLevel;
  private readonly _data: Uint8Array;

  private constructor(level: MLKEMLevel, data: Uint8Array) {
    const expectedSize = mlkemCiphertextSize(level);
    if (data.length !== expectedSize) {
      throw new Error(
        `MLKEMCiphertext (${mlkemLevelToString(level)}) must be ${expectedSize} bytes, got ${data.length}`,
      );
    }
    this._level = level;
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an MLKEMCiphertext from raw bytes.
   *
   * @param level - The ML-KEM security level
   * @param data - The ciphertext bytes
   */
  static fromBytes(level: MLKEMLevel, data: Uint8Array): MLKEMCiphertext {
    return new MLKEMCiphertext(level, data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the security level of this ciphertext.
   */
  level(): MLKEMLevel {
    return this._level;
  }

  /**
   * Returns the raw ciphertext bytes.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Returns a copy of the raw ciphertext bytes.
   */
  data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Returns the size of the ciphertext in bytes.
   */
  size(): number {
    return this._data.length;
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another MLKEMCiphertext.
   */
  equals(other: MLKEMCiphertext): boolean {
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
    return `MLKEMCiphertext(${mlkemLevelToString(this._level)}, ${hex.substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with MLKEMCiphertext.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_MLKEM_CIPHERTEXT.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: [level, ciphertext_bytes]
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
   * Creates an MLKEMCiphertext by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): MLKEMCiphertext {
    const elements = expectArray(cborValue);
    if (elements.length !== 2) {
      throw new Error(`MLKEMCiphertext CBOR must have 2 elements, got ${elements.length}`);
    }
    const levelValue = expectInt(elements[0]);
    const level = mlkemLevelFromValue(levelValue);
    const data = expectBytes(elements[1]);
    return MLKEMCiphertext.fromBytes(level, data);
  }

  /**
   * Creates an MLKEMCiphertext by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): MLKEMCiphertext {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): MLKEMCiphertext {
    // Create a minimal dummy instance for decoding
    const dummyData = new Uint8Array(mlkemCiphertextSize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMCiphertext(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): MLKEMCiphertext {
    const cborValue = decodeCbor(data);
    return MLKEMCiphertext.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): MLKEMCiphertext {
    const cborValue = decodeCbor(data);
    const dummyData = new Uint8Array(mlkemCiphertextSize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMCiphertext(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    return UR.new(TAG_MLKEM_CIPHERTEXT.name!, this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an MLKEMCiphertext from a UR.
   */
  static fromUR(ur: UR): MLKEMCiphertext {
    if (ur.urTypeStr() !== TAG_MLKEM_CIPHERTEXT.name) {
      throw new Error(
        `Expected UR type ${TAG_MLKEM_CIPHERTEXT.name}, got ${ur.urTypeStr()}`,
      );
    }
    const dummyData = new Uint8Array(mlkemCiphertextSize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMCiphertext(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an MLKEMCiphertext from a UR string.
   */
  static fromURString(urString: string): MLKEMCiphertext {
    const ur = UR.fromURString(urString);
    return MLKEMCiphertext.fromUR(ur);
  }
}
