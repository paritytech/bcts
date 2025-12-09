/**
 * EC private key for ECDSA and Schnorr signatures (secp256k1, 32 bytes)
 *
 * An `ECPrivateKey` is a 32-byte secret value that can be used to:
 * - Generate its corresponding public key
 * - Sign messages using the ECDSA signature scheme
 * - Sign messages using the Schnorr signature scheme (BIP-340)
 *
 * These keys use the secp256k1 curve, which is the same curve used in Bitcoin
 * and other cryptocurrencies.
 *
 * # CBOR Serialization
 *
 * `ECPrivateKey` is serialized to CBOR with tags 40306 (or legacy 306).
 *
 * The format is a map:
 * ```
 * #6.40306({
 *   2: true,                    // indicates private key
 *   3: h'<32-byte-private-key>' // key data
 * })
 * ```
 *
 * Ported from bc-components-rust/src/ec_key/ec_private_key.rs
 */

import { SecureRandomNumberGenerator, type RandomNumberGenerator } from "@blockchain-commons/rand";
import {
  ECDSA_PRIVATE_KEY_SIZE,
  ecdsaPublicKeyFromPrivateKey,
  ecdsaDerivePrivateKey,
  ecdsaSign,
  schnorrPublicKeyFromPrivateKey,
  schnorrSign,
  schnorrSignUsing,
} from "@blockchain-commons/crypto";
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
} from "@blockchain-commons/dcbor";
import { UR, type UREncodable } from "@blockchain-commons/uniform-resources";
import { EC_KEY as TAG_EC_KEY, EC_KEY_V1 as TAG_EC_KEY_V1 } from "@blockchain-commons/tags";
import { CryptoError } from "../error.js";
import { ECPublicKey } from "./ec-public-key.js";
import { SchnorrPublicKey } from "./schnorr-public-key.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class ECPrivateKey
  implements CborTaggedEncodable, CborTaggedDecodable<ECPrivateKey>, UREncodable
{
  static readonly KEY_SIZE = ECDSA_PRIVATE_KEY_SIZE;

  private readonly _data: Uint8Array;
  private _publicKey?: ECPublicKey;
  private _schnorrPublicKey?: SchnorrPublicKey;

  private constructor(data: Uint8Array) {
    if (data.length !== ECDSA_PRIVATE_KEY_SIZE) {
      throw CryptoError.invalidSize(ECDSA_PRIVATE_KEY_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Generate a new random ECPrivateKey.
   */
  static new(): ECPrivateKey {
    return ECPrivateKey.random();
  }

  /**
   * Generate a new random ECPrivateKey.
   */
  static random(): ECPrivateKey {
    const rng = new SecureRandomNumberGenerator();
    return ECPrivateKey.newUsing(rng);
  }

  /**
   * Generate a new random ECPrivateKey using provided RNG.
   */
  static newUsing(rng: RandomNumberGenerator): ECPrivateKey {
    return new ECPrivateKey(rng.randomData(ECDSA_PRIVATE_KEY_SIZE));
  }

  /**
   * Generate a new random ECPrivateKey and corresponding ECPublicKey.
   */
  static keypair(): [ECPrivateKey, ECPublicKey] {
    const privateKey = ECPrivateKey.new();
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  /**
   * Generate a new random ECPrivateKey and corresponding ECPublicKey
   * using the given random number generator.
   */
  static keypairUsing(rng: RandomNumberGenerator): [ECPrivateKey, ECPublicKey] {
    const privateKey = ECPrivateKey.newUsing(rng);
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  /**
   * Derive an ECPrivateKey from the given key material.
   *
   * @param keyMaterial - The key material to derive from
   * @returns A new ECPrivateKey derived from the key material
   */
  static deriveFromKeyMaterial(keyMaterial: Uint8Array): ECPrivateKey {
    return new ECPrivateKey(ecdsaDerivePrivateKey(keyMaterial));
  }

  /**
   * Restore an ECPrivateKey from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): ECPrivateKey {
    return new ECPrivateKey(new Uint8Array(data));
  }

  /**
   * Restore an ECPrivateKey from a reference to an array of bytes.
   * Validates the length.
   */
  static fromDataRef(data: Uint8Array): ECPrivateKey {
    if (data.length !== ECDSA_PRIVATE_KEY_SIZE) {
      throw CryptoError.invalidSize(ECDSA_PRIVATE_KEY_SIZE, data.length);
    }
    return ECPrivateKey.fromData(data);
  }

  /**
   * Create an ECPrivateKey from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): ECPrivateKey {
    return ECPrivateKey.fromData(data);
  }

  /**
   * Restore an ECPrivateKey from a hex string.
   */
  static fromHex(hex: string): ECPrivateKey {
    return ECPrivateKey.fromData(hexToBytes(hex));
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
   * Get the raw private key bytes (copy).
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
   * Get the ECPublicKey (compressed) corresponding to this ECPrivateKey.
   */
  publicKey(): ECPublicKey {
    if (!this._publicKey) {
      const publicKeyBytes = ecdsaPublicKeyFromPrivateKey(this._data);
      this._publicKey = ECPublicKey.fromData(publicKeyBytes);
    }
    return this._publicKey;
  }

  /**
   * Get the SchnorrPublicKey (x-only) corresponding to this ECPrivateKey.
   */
  schnorrPublicKey(): SchnorrPublicKey {
    if (!this._schnorrPublicKey) {
      const publicKeyBytes = schnorrPublicKeyFromPrivateKey(this._data);
      this._schnorrPublicKey = SchnorrPublicKey.fromData(publicKeyBytes);
    }
    return this._schnorrPublicKey;
  }

  /**
   * Sign a message using ECDSA.
   *
   * @param message - The message to sign
   * @returns A 64-byte signature
   */
  ecdsaSign(message: Uint8Array): Uint8Array {
    try {
      return ecdsaSign(this._data, message);
    } catch (e) {
      throw CryptoError.cryptoOperation(`ECDSA signing failed: ${e}`);
    }
  }

  /**
   * Sign a message using Schnorr signature (BIP-340).
   *
   * @param message - The message to sign
   * @returns A 64-byte signature
   */
  schnorrSign(message: Uint8Array): Uint8Array {
    try {
      return schnorrSign(this._data, message);
    } catch (e) {
      throw CryptoError.cryptoOperation(`Schnorr signing failed: ${e}`);
    }
  }

  /**
   * Sign a message using Schnorr signature with custom RNG.
   *
   * @param message - The message to sign
   * @param rng - Random number generator for auxiliary randomness
   * @returns A 64-byte signature
   */
  schnorrSignUsing(message: Uint8Array, rng: RandomNumberGenerator): Uint8Array {
    try {
      return schnorrSignUsing(this._data, message, rng);
    } catch (e) {
      throw CryptoError.cryptoOperation(`Schnorr signing failed: ${e}`);
    }
  }

  /**
   * Compare with another ECPrivateKey.
   */
  equals(other: ECPrivateKey): boolean {
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
    return `ECPrivateKey(${this.toHex().substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with ECPrivateKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_EC_KEY.value, TAG_EC_KEY_V1.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   *
   * Format: { 2: true, 3: h'<32-byte-key>' }
   */
  untaggedCbor(): Cbor {
    const map = new Map<number, unknown>();
    map.set(2, true);
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
   * Creates an ECPrivateKey by decoding it from untagged CBOR.
   *
   * Format: { 2: true, 3: h'<32-byte-key>' }
   */
  fromUntaggedCbor(cborValue: Cbor): ECPrivateKey {
    const map = expectMap(cborValue);

    // Check for key 2 (isPrivate = true)
    const isPrivate = map.get<number, boolean>(2);
    if (isPrivate !== true) {
      throw new Error("ECPrivateKey CBOR must have key 2 set to true");
    }

    // Get key data from key 3
    // CborMap.extract() returns native types (Uint8Array for byte strings)
    const keyData = map.extract<number, Uint8Array>(3);
    if (!keyData || keyData.length === 0) {
      throw new Error("ECPrivateKey CBOR must have key 3 (data)");
    }

    return ECPrivateKey.fromDataRef(keyData);
  }

  /**
   * Creates an ECPrivateKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): ECPrivateKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): ECPrivateKey {
    const dummy = new ECPrivateKey(new Uint8Array(ECDSA_PRIVATE_KEY_SIZE));
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): ECPrivateKey {
    const cborValue = decodeCbor(data);
    return ECPrivateKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): ECPrivateKey {
    const cborValue = decodeCbor(data);
    const dummy = new ECPrivateKey(new Uint8Array(ECDSA_PRIVATE_KEY_SIZE));
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the ECPrivateKey.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new(TAG_EC_KEY.name!, this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an ECPrivateKey from a UR.
   */
  static fromUR(ur: UR): ECPrivateKey {
    ur.checkType(TAG_EC_KEY.name!);
    const dummy = new ECPrivateKey(new Uint8Array(ECDSA_PRIVATE_KEY_SIZE));
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an ECPrivateKey from a UR string.
   */
  static fromURString(urString: string): ECPrivateKey {
    const ur = UR.fromURString(urString);
    return ECPrivateKey.fromUR(ur);
  }
}
