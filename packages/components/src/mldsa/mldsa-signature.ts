/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * MLDSASignature - ML-DSA Digital Signature
 *
 * MLDSASignature wraps an ML-DSA signature for serialization and verification.
 * It supports all three security levels (MLDSA44, MLDSA65, MLDSA87).
 *
 * # CBOR Serialization
 *
 * MLDSASignature is serialized with tag 40105:
 * ```
 * #6.40105([level, h'<signature-bytes>'])
 * ```
 *
 * # UR Serialization
 *
 * UR type: `mldsa-signature`
 *
 * Ported from bc-components-rust/src/mldsa/mldsa_signature.rs
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
import { MLDSA_SIGNATURE as TAG_MLDSA_SIGNATURE } from "@bcts/tags";

import {
  MLDSALevel,
  mldsaLevelFromValue,
  mldsaLevelToString,
  mldsaSignatureSize,
} from "./mldsa-level.js";
import { bytesToHex } from "../utils.js";

/**
 * MLDSASignature - Post-quantum digital signature using ML-DSA.
 */
export class MLDSASignature
  implements CborTaggedEncodable, CborTaggedDecodable<MLDSASignature>, UREncodable
{
  private readonly _level: MLDSALevel;
  private readonly _data: Uint8Array;

  private constructor(level: MLDSALevel, data: Uint8Array) {
    const expectedSize = mldsaSignatureSize(level);
    if (data.length !== expectedSize) {
      throw new Error(
        `MLDSASignature (${mldsaLevelToString(level)}) must be ${expectedSize} bytes, got ${data.length}`,
      );
    }
    this._level = level;
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an MLDSASignature from raw bytes.
   *
   * @param level - The ML-DSA security level
   * @param data - The signature bytes
   */
  static fromBytes(level: MLDSALevel, data: Uint8Array): MLDSASignature {
    return new MLDSASignature(level, data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the security level of this signature.
   */
  level(): MLDSALevel {
    return this._level;
  }

  /**
   * Returns the raw signature bytes.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Returns a copy of the raw signature bytes.
   */
  data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Returns the size of the signature in bytes.
   */
  size(): number {
    return this._data.length;
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another MLDSASignature.
   */
  equals(other: MLDSASignature): boolean {
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
    return `MLDSASignature(${mldsaLevelToString(this._level)}, ${hex.substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with MLDSASignature.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_MLDSA_SIGNATURE.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: [level, signature_bytes]
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
   * Creates an MLDSASignature by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): MLDSASignature {
    const elements = expectArray(cborValue);
    if (elements.length !== 2) {
      throw new Error(`MLDSASignature CBOR must have 2 elements, got ${elements.length}`);
    }
    const levelValue = Number(expectInteger(elements[0]));
    const level = mldsaLevelFromValue(levelValue);
    const data = expectBytes(elements[1]);
    return MLDSASignature.fromBytes(level, data);
  }

  /**
   * Creates an MLDSASignature by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): MLDSASignature {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): MLDSASignature {
    // Create a minimal dummy instance for decoding
    const dummyData = new Uint8Array(mldsaSignatureSize(MLDSALevel.MLDSA44));
    const dummy = new MLDSASignature(MLDSALevel.MLDSA44, dummyData);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): MLDSASignature {
    const cborValue = decodeCbor(data);
    return MLDSASignature.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): MLDSASignature {
    const cborValue = decodeCbor(data);
    const dummyData = new Uint8Array(mldsaSignatureSize(MLDSALevel.MLDSA44));
    const dummy = new MLDSASignature(MLDSALevel.MLDSA44, dummyData);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_MLDSA_SIGNATURE.name;
    if (name === undefined) {
      throw new Error("MLDSA_SIGNATURE tag name is undefined");
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
   * Creates an MLDSASignature from a UR.
   */
  static fromUR(ur: UR): MLDSASignature {
    if (ur.urTypeStr() !== TAG_MLDSA_SIGNATURE.name) {
      throw new Error(`Expected UR type ${TAG_MLDSA_SIGNATURE.name}, got ${ur.urTypeStr()}`);
    }
    const dummyData = new Uint8Array(mldsaSignatureSize(MLDSALevel.MLDSA44));
    const dummy = new MLDSASignature(MLDSALevel.MLDSA44, dummyData);
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an MLDSASignature from a UR string.
   */
  static fromURString(urString: string): MLDSASignature {
    const ur = UR.fromURString(urString);
    return MLDSASignature.fromUR(ur);
  }
}
