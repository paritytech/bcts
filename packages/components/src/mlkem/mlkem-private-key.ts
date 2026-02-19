/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * MLKEMPrivateKey - ML-KEM Private Key for post-quantum key decapsulation
 *
 * MLKEMPrivateKey wraps an ML-KEM secret key for decapsulating shared secrets.
 * It supports all three security levels (MLKEM512, MLKEM768, MLKEM1024).
 *
 * # CBOR Serialization
 *
 * MLKEMPrivateKey is serialized with tag 40100:
 * ```
 * #6.40100([level, h'<private-key-bytes>'])
 * ```
 *
 * # UR Serialization
 *
 * UR type: `mlkem-private-key`
 *
 * Ported from bc-components-rust/src/mlkem/mlkem_private_key.rs
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
import { MLKEM_PRIVATE_KEY as TAG_MLKEM_PRIVATE_KEY } from "@bcts/tags";
import type { RandomNumberGenerator } from "@bcts/rand";
import { SecureRandomNumberGenerator } from "@bcts/rand";

import {
  MLKEMLevel,
  mlkemLevelFromValue,
  mlkemLevelToString,
  mlkemPrivateKeySize,
  mlkemGenerateKeypairUsing,
  mlkemDecapsulate,
  mlkemExtractPublicKey,
} from "./mlkem-level.js";
import { MLKEMPublicKey } from "./mlkem-public-key.js";
import type { MLKEMCiphertext } from "./mlkem-ciphertext.js";
import { SymmetricKey } from "../symmetric/symmetric-key.js";
import { bytesToHex } from "../utils.js";

/**
 * MLKEMPrivateKey - Post-quantum key decapsulation private key using ML-KEM.
 */
export class MLKEMPrivateKey
  implements CborTaggedEncodable, CborTaggedDecodable<MLKEMPrivateKey>, UREncodable
{
  private readonly _level: MLKEMLevel;
  private readonly _data: Uint8Array;

  private constructor(level: MLKEMLevel, data: Uint8Array) {
    const expectedSize = mlkemPrivateKeySize(level);
    if (data.length !== expectedSize) {
      throw new Error(
        `MLKEMPrivateKey (${mlkemLevelToString(level)}) must be ${expectedSize} bytes, got ${data.length}`,
      );
    }
    this._level = level;
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Generate a new random MLKEMPrivateKey with the specified security level.
   *
   * @param level - The ML-KEM security level (default: MLKEM768)
   */
  static new(level: MLKEMLevel = MLKEMLevel.MLKEM768): MLKEMPrivateKey {
    const rng = new SecureRandomNumberGenerator();
    return MLKEMPrivateKey.newUsing(level, rng);
  }

  /**
   * Generate a new random MLKEMPrivateKey using the provided RNG.
   *
   * @param level - The ML-KEM security level
   * @param rng - Random number generator
   */
  static newUsing(level: MLKEMLevel, rng: RandomNumberGenerator): MLKEMPrivateKey {
    const keypair = mlkemGenerateKeypairUsing(level, rng);
    return new MLKEMPrivateKey(level, keypair.secretKey);
  }

  /**
   * Create an MLKEMPrivateKey from raw bytes.
   *
   * @param level - The ML-KEM security level
   * @param data - The private key bytes
   */
  static fromBytes(level: MLKEMLevel, data: Uint8Array): MLKEMPrivateKey {
    return new MLKEMPrivateKey(level, data);
  }

  /**
   * Generate a keypair and return both private and public keys.
   *
   * @param level - The ML-KEM security level (default: MLKEM768)
   * @returns Tuple of [privateKey, publicKey]
   */
  static keypair(level: MLKEMLevel = MLKEMLevel.MLKEM768): [MLKEMPrivateKey, MLKEMPublicKey] {
    const rng = new SecureRandomNumberGenerator();
    return MLKEMPrivateKey.keypairUsing(level, rng);
  }

  /**
   * Generate a keypair using the provided RNG.
   *
   * @param level - The ML-KEM security level
   * @param rng - Random number generator
   * @returns Tuple of [privateKey, publicKey]
   */
  static keypairUsing(
    level: MLKEMLevel,
    rng: RandomNumberGenerator,
  ): [MLKEMPrivateKey, MLKEMPublicKey] {
    const keypairData = mlkemGenerateKeypairUsing(level, rng);
    const privateKey = new MLKEMPrivateKey(level, keypairData.secretKey);
    const publicKey = MLKEMPublicKey.fromBytes(level, keypairData.publicKey);
    return [privateKey, publicKey];
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
   * Decapsulate a shared secret from a ciphertext.
   *
   * @param ciphertext - The ML-KEM ciphertext
   * @returns The decapsulated shared secret as a SymmetricKey
   */
  decapsulate(ciphertext: MLKEMCiphertext): SymmetricKey {
    if (ciphertext.level() !== this._level) {
      throw new Error(
        `Ciphertext level (${mlkemLevelToString(ciphertext.level())}) does not match key level (${mlkemLevelToString(this._level)})`,
      );
    }
    const sharedSecret = mlkemDecapsulate(this._level, this._data, ciphertext.asBytes());
    return SymmetricKey.fromData(sharedSecret);
  }

  /**
   * Derives and returns the corresponding public key.
   *
   * In ML-KEM (FIPS 203), the decapsulation key contains the encapsulation key (public key)
   * embedded within it. This method extracts that public key.
   *
   * @returns The corresponding MLKEMPublicKey
   */
  publicKey(): MLKEMPublicKey {
    const publicKeyData = mlkemExtractPublicKey(this._level, this._data);
    return MLKEMPublicKey.fromBytes(this._level, publicKeyData);
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another MLKEMPrivateKey.
   */
  equals(other: MLKEMPrivateKey): boolean {
    if (this._level !== other._level) return false;
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation (truncated for security).
   */
  toString(): string {
    const hex = bytesToHex(this._data);
    return `MLKEMPrivateKey(${mlkemLevelToString(this._level)}, ${hex.substring(0, 8)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with MLKEMPrivateKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_MLKEM_PRIVATE_KEY.value]);
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
   * Creates an MLKEMPrivateKey by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): MLKEMPrivateKey {
    const elements = expectArray(cborValue);
    if (elements.length !== 2) {
      throw new Error(`MLKEMPrivateKey CBOR must have 2 elements, got ${elements.length}`);
    }
    const levelValue = Number(expectInteger(elements[0]));
    const level = mlkemLevelFromValue(levelValue);
    const data = expectBytes(elements[1]);
    return MLKEMPrivateKey.fromBytes(level, data);
  }

  /**
   * Creates an MLKEMPrivateKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): MLKEMPrivateKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): MLKEMPrivateKey {
    // Create a minimal dummy instance for decoding
    const dummyData = new Uint8Array(mlkemPrivateKeySize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMPrivateKey(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): MLKEMPrivateKey {
    const cborValue = decodeCbor(data);
    return MLKEMPrivateKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): MLKEMPrivateKey {
    const cborValue = decodeCbor(data);
    const dummyData = new Uint8Array(mlkemPrivateKeySize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMPrivateKey(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_MLKEM_PRIVATE_KEY.name;
    if (name === undefined) {
      throw new Error("MLKEM_PRIVATE_KEY tag name is undefined");
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
   * Creates an MLKEMPrivateKey from a UR.
   */
  static fromUR(ur: UR): MLKEMPrivateKey {
    if (ur.urTypeStr() !== TAG_MLKEM_PRIVATE_KEY.name) {
      throw new Error(`Expected UR type ${TAG_MLKEM_PRIVATE_KEY.name}, got ${ur.urTypeStr()}`);
    }
    const dummyData = new Uint8Array(mlkemPrivateKeySize(MLKEMLevel.MLKEM512));
    const dummy = new MLKEMPrivateKey(MLKEMLevel.MLKEM512, dummyData);
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an MLKEMPrivateKey from a UR string.
   */
  static fromURString(urString: string): MLKEMPrivateKey {
    const ur = UR.fromURString(urString);
    return MLKEMPrivateKey.fromUR(ur);
  }
}
