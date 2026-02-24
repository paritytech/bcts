/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * MLKEMPublicKey - ML-KEM Public Key for post-quantum key encapsulation
 *
 * MLKEMPublicKey wraps an ML-KEM public key for encapsulating shared secrets.
 * It supports all three security levels (MLKEM512, MLKEM768, MLKEM1024).
 *
 * # CBOR Serialization
 *
 * MLKEMPublicKey is serialized with tag 40101:
 * ```
 * #6.40101([level, h'<public-key-bytes>'])
 * ```
 *
 * # UR Serialization
 *
 * UR type: `mlkem-public-key`
 *
 * Ported from bc-components-rust/src/mlkem/mlkem_public_key.rs
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
import { MLKEM_PUBLIC_KEY as TAG_MLKEM_PUBLIC_KEY } from "@bcts/tags";

import {
  MLKEMLevel,
  mlkemLevelFromValue,
  mlkemLevelToString,
  mlkemPublicKeySize,
  mlkemEncapsulate,
} from "./mlkem-level.js";
import { MLKEMCiphertext } from "./mlkem-ciphertext.js";
import { SymmetricKey } from "../symmetric/symmetric-key.js";
import { bytesToHex } from "../utils.js";

/**
 * Result of encapsulation operation.
 */
export interface MLKEMEncapsulationPair {
  /** The shared secret as a SymmetricKey */
  sharedSecret: SymmetricKey;
  /** The ciphertext to send to the private key holder */
  ciphertext: MLKEMCiphertext;
}

/**
 * MLKEMPublicKey - Post-quantum key encapsulation public key using ML-KEM.
 */
export class MLKEMPublicKey
  implements CborTaggedEncodable, CborTaggedDecodable<MLKEMPublicKey>, UREncodable
{
  private readonly _level: MLKEMLevel;
  private readonly _data: Uint8Array;

  private constructor(level: MLKEMLevel, data: Uint8Array) {
    const expectedSize = mlkemPublicKeySize(level);
    if (data.length !== expectedSize) {
      throw new Error(
        `MLKEMPublicKey (${mlkemLevelToString(level)}) must be ${expectedSize} bytes, got ${data.length}`,
      );
    }
    this._level = level;
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an MLKEMPublicKey from raw bytes.
   *
   * @param level - The ML-KEM security level
   * @param data - The public key bytes
   */
  static fromBytes(level: MLKEMLevel, data: Uint8Array): MLKEMPublicKey {
    return new MLKEMPublicKey(level, data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the security level of this key.
   */
  level(): MLKEMLevel {
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
   * Encapsulate a new shared secret.
   *
   * This creates a random shared secret and encapsulates it, returning both
   * the shared secret (to be used as a symmetric key) and the ciphertext
   * (to be sent to the private key holder for decapsulation).
   *
   * @returns Object containing sharedSecret and ciphertext
   */
  encapsulate(): MLKEMEncapsulationPair {
    const result = mlkemEncapsulate(this._level, this._data);
    const sharedSecret = SymmetricKey.fromData(result.sharedSecret);
    const ciphertext = MLKEMCiphertext.fromBytes(this._level, result.ciphertext);
    return { sharedSecret, ciphertext };
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another MLKEMPublicKey.
   */
  equals(other: MLKEMPublicKey): boolean {
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
    return `MLKEMPublicKey(${mlkemLevelToString(this._level)}, ${hex.substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with MLKEMPublicKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_MLKEM_PUBLIC_KEY.value]);
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
   * Creates an MLKEMPublicKey by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): MLKEMPublicKey {
    const elements = expectArray(cborValue);
    if (elements.length !== 2) {
      throw new Error(`MLKEMPublicKey CBOR must have 2 elements, got ${elements.length}`);
    }
    const levelValue = Number(expectInteger(elements[0]));
    const level = mlkemLevelFromValue(levelValue);
    const data = expectBytes(elements[1]);
    return MLKEMPublicKey.fromBytes(level, data);
  }

  /**
   * Creates an MLKEMPublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): MLKEMPublicKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): MLKEMPublicKey {
    // Create a minimal dummy instance for decoding
    const dummyData = new Uint8Array(mlkemPublicKeySize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMPublicKey(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): MLKEMPublicKey {
    const cborValue = decodeCbor(data);
    return MLKEMPublicKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): MLKEMPublicKey {
    const cborValue = decodeCbor(data);
    const dummyData = new Uint8Array(mlkemPublicKeySize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMPublicKey(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_MLKEM_PUBLIC_KEY.name;
    if (name === undefined) {
      throw new Error("MLKEM_PUBLIC_KEY tag name is undefined");
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
   * Creates an MLKEMPublicKey from a UR.
   */
  static fromUR(ur: UR): MLKEMPublicKey {
    if (ur.urTypeStr() !== TAG_MLKEM_PUBLIC_KEY.name) {
      throw new Error(`Expected UR type ${TAG_MLKEM_PUBLIC_KEY.name}, got ${ur.urTypeStr()}`);
    }
    const dummyData = new Uint8Array(mlkemPublicKeySize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMPublicKey(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an MLKEMPublicKey from a UR string.
   */
  static fromURString(urString: string): MLKEMPublicKey {
    const ur = UR.fromURString(urString);
    return MLKEMPublicKey.fromUR(ur);
  }
}
