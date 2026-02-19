/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * X25519 private key for ECDH key exchange (32 bytes seed)
 *
 * X25519 is an elliptic-curve Diffie-Hellman key exchange protocol based on
 * Curve25519 as defined in RFC 7748. It allows two parties to establish a
 * shared secret key over an insecure channel.
 *
 * Key features of X25519:
 * - High security (128-bit security level)
 * - High performance
 * - Small key sizes (32 bytes)
 * - Protection against various side-channel attacks
 *
 * # CBOR Serialization
 *
 * `X25519PrivateKey` is serialized to CBOR with tag 40010.
 *
 * ```
 * #6.40010(h'<32-byte-private-key>')
 * ```
 *
 * Ported from bc-components-rust/src/x25519/x25519_private_key.rs
 */

import { SecureRandomNumberGenerator, type RandomNumberGenerator } from "@bcts/rand";
import {
  X25519_PRIVATE_KEY_SIZE,
  x25519PublicKeyFromPrivateKey,
  x25519SharedKey,
  deriveAgreementPrivateKey,
} from "@bcts/crypto";
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
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { X25519_PRIVATE_KEY as TAG_X25519_PRIVATE_KEY } from "@bcts/tags";
import { CryptoError } from "../error.js";
import { X25519PublicKey } from "./x25519-public-key.js";
import { SymmetricKey } from "../symmetric/symmetric-key.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class X25519PrivateKey
  implements CborTaggedEncodable, CborTaggedDecodable<X25519PrivateKey>, UREncodable
{
  static readonly KEY_SIZE = X25519_PRIVATE_KEY_SIZE;

  private readonly _data: Uint8Array;
  private _publicKey?: X25519PublicKey;

  private constructor(data: Uint8Array) {
    if (data.length !== X25519_PRIVATE_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_PRIVATE_KEY_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Generate a new random X25519PrivateKey.
   */
  static new(): X25519PrivateKey {
    return X25519PrivateKey.random();
  }

  /**
   * Generate a new random X25519PrivateKey.
   */
  static random(): X25519PrivateKey {
    const rng = new SecureRandomNumberGenerator();
    return X25519PrivateKey.newUsing(rng);
  }

  /**
   * Generate a new random X25519PrivateKey using provided RNG.
   */
  static newUsing(rng: RandomNumberGenerator): X25519PrivateKey {
    return new X25519PrivateKey(rng.randomData(X25519_PRIVATE_KEY_SIZE));
  }

  /**
   * Generate a new random X25519PrivateKey and corresponding X25519PublicKey.
   */
  static keypair(): [X25519PrivateKey, X25519PublicKey] {
    const privateKey = X25519PrivateKey.new();
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  /**
   * Generate a new random X25519PrivateKey and corresponding X25519PublicKey
   * using the given random number generator.
   */
  static keypairUsing(rng: RandomNumberGenerator): [X25519PrivateKey, X25519PublicKey] {
    const privateKey = X25519PrivateKey.newUsing(rng);
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  /**
   * Derive an X25519PrivateKey from the given key material.
   *
   * @param keyMaterial - The key material to derive from
   * @returns A new X25519PrivateKey derived from the key material
   */
  static deriveFromKeyMaterial(keyMaterial: Uint8Array): X25519PrivateKey {
    return new X25519PrivateKey(deriveAgreementPrivateKey(keyMaterial));
  }

  /**
   * Restore an X25519PrivateKey from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): X25519PrivateKey {
    return new X25519PrivateKey(new Uint8Array(data));
  }

  /**
   * Restore an X25519PrivateKey from a reference to an array of bytes.
   * Validates the length.
   */
  static fromDataRef(data: Uint8Array): X25519PrivateKey {
    if (data.length !== X25519_PRIVATE_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_PRIVATE_KEY_SIZE, data.length);
    }
    return X25519PrivateKey.fromData(data);
  }

  /**
   * Create an X25519PrivateKey from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): X25519PrivateKey {
    return X25519PrivateKey.fromData(data);
  }

  /**
   * Restore an X25519PrivateKey from a hex string.
   */
  static fromHex(hex: string): X25519PrivateKey {
    return X25519PrivateKey.fromData(hexToBytes(hex));
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
   * Get the X25519PublicKey corresponding to this X25519PrivateKey.
   */
  publicKey(): X25519PublicKey {
    if (this._publicKey === undefined) {
      const publicKeyBytes = x25519PublicKeyFromPrivateKey(this._data);
      this._publicKey = X25519PublicKey.fromData(publicKeyBytes);
    }
    return this._publicKey;
  }

  /**
   * Derive a shared symmetric key from this X25519PrivateKey and the given
   * X25519PublicKey.
   *
   * @param publicKey - The other party's public key
   * @returns A SymmetricKey derived from the shared secret
   */
  sharedKeyWith(publicKey: X25519PublicKey): SymmetricKey {
    const shared = x25519SharedKey(this._data, publicKey.data());
    return SymmetricKey.fromData(shared);
  }

  /**
   * Perform ECDH key agreement with a public key (legacy method).
   *
   * @deprecated Use sharedKeyWith() instead which returns a SymmetricKey
   */
  sharedSecret(publicKey: X25519PublicKey): Uint8Array {
    try {
      const shared = x25519SharedKey(this._data, publicKey.data());
      return new Uint8Array(shared);
    } catch (e: unknown) {
      throw CryptoError.cryptoOperation(`ECDH key agreement failed: ${String(e)}`);
    }
  }

  /**
   * Compare with another X25519PrivateKey.
   */
  equals(other: X25519PrivateKey): boolean {
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
    return `X25519PrivateKey(${this.toHex().substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with X25519PrivateKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_X25519_PRIVATE_KEY.value]);
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
   * Creates an X25519PrivateKey by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): X25519PrivateKey {
    const data = expectBytes(cbor);
    return X25519PrivateKey.fromDataRef(data);
  }

  /**
   * Creates an X25519PrivateKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): X25519PrivateKey {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): X25519PrivateKey {
    const dummy = new X25519PrivateKey(new Uint8Array(X25519_PRIVATE_KEY_SIZE));
    return dummy.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): X25519PrivateKey {
    const cbor = decodeCbor(data);
    return X25519PrivateKey.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): X25519PrivateKey {
    const cbor = decodeCbor(data);
    const dummy = new X25519PrivateKey(new Uint8Array(X25519_PRIVATE_KEY_SIZE));
    return dummy.fromUntaggedCbor(cbor);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the X25519PrivateKey.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    const name = TAG_X25519_PRIVATE_KEY.name;
    if (name === undefined) {
      throw new Error("X25519_PRIVATE_KEY tag name is undefined");
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
   * Creates an X25519PrivateKey from a UR.
   */
  static fromUR(ur: UR): X25519PrivateKey {
    const name = TAG_X25519_PRIVATE_KEY.name;
    if (name === undefined) {
      throw new Error("X25519_PRIVATE_KEY tag name is undefined");
    }
    ur.checkType(name);
    const dummy = new X25519PrivateKey(new Uint8Array(X25519_PRIVATE_KEY_SIZE));
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an X25519PrivateKey from a UR string.
   */
  static fromURString(urString: string): X25519PrivateKey {
    const ur = UR.fromURString(urString);
    return X25519PrivateKey.fromUR(ur);
  }
}
