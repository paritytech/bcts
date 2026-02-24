/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * X25519 public key for ECDH key exchange (32 bytes)
 *
 * X25519 is an elliptic-curve Diffie-Hellman key exchange protocol based on
 * Curve25519 as defined in RFC 7748. It allows two parties to establish a
 * shared secret key over an insecure channel.
 *
 * The X25519 public key is generated from a corresponding private key and is
 * designed to be:
 * - Compact (32 bytes)
 * - Fast to use in key agreement operations
 * - Resistant to various cryptographic attacks
 *
 * # CBOR Serialization
 *
 * `X25519PublicKey` is serialized to CBOR with tag 40011.
 *
 * ```
 * #6.40011(h'<32-byte-public-key>')
 * ```
 *
 * Ported from bc-components-rust/src/x25519/x25519_public_key.rs
 */

import { X25519_PUBLIC_KEY_SIZE } from "@bcts/crypto";
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
import { X25519_PUBLIC_KEY as TAG_X25519_PUBLIC_KEY } from "@bcts/tags";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class X25519PublicKey
  implements CborTaggedEncodable, CborTaggedDecodable<X25519PublicKey>, UREncodable
{
  static readonly KEY_SIZE = X25519_PUBLIC_KEY_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== X25519_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_PUBLIC_KEY_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Restore an X25519PublicKey from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): X25519PublicKey {
    return new X25519PublicKey(new Uint8Array(data));
  }

  /**
   * Restore an X25519PublicKey from a reference to an array of bytes.
   * Validates the length.
   */
  static fromDataRef(data: Uint8Array): X25519PublicKey {
    if (data.length !== X25519_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_PUBLIC_KEY_SIZE, data.length);
    }
    return X25519PublicKey.fromData(data);
  }

  /**
   * Create an X25519PublicKey from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): X25519PublicKey {
    return X25519PublicKey.fromData(data);
  }

  /**
   * Restore an X25519PublicKey from a hex string.
   */
  static fromHex(hex: string): X25519PublicKey {
    return X25519PublicKey.fromData(hexToBytes(hex));
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
   * Compare with another X25519PublicKey.
   */
  equals(other: X25519PublicKey): boolean {
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
    return `X25519PublicKey(${this.toHex().substring(0, 16)}...)`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with X25519PublicKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_X25519_PUBLIC_KEY.value]);
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
   * Creates an X25519PublicKey by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): X25519PublicKey {
    const data = expectBytes(cbor);
    return X25519PublicKey.fromDataRef(data);
  }

  /**
   * Creates an X25519PublicKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): X25519PublicKey {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): X25519PublicKey {
    const dummy = new X25519PublicKey(new Uint8Array(X25519_PUBLIC_KEY_SIZE));
    return dummy.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): X25519PublicKey {
    const cbor = decodeCbor(data);
    return X25519PublicKey.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): X25519PublicKey {
    const cbor = decodeCbor(data);
    const dummy = new X25519PublicKey(new Uint8Array(X25519_PUBLIC_KEY_SIZE));
    return dummy.fromUntaggedCbor(cbor);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the X25519PublicKey.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    const name = TAG_X25519_PUBLIC_KEY.name;
    if (name === undefined) {
      throw new Error("X25519_PUBLIC_KEY tag name is undefined");
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
   * Creates an X25519PublicKey from a UR.
   */
  static fromUR(ur: UR): X25519PublicKey {
    const name = TAG_X25519_PUBLIC_KEY.name;
    if (name === undefined) {
      throw new Error("X25519_PUBLIC_KEY tag name is undefined");
    }
    ur.checkType(name);
    const dummy = new X25519PublicKey(new Uint8Array(X25519_PUBLIC_KEY_SIZE));
    return dummy.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates an X25519PublicKey from a UR string.
   */
  static fromURString(urString: string): X25519PublicKey {
    const ur = UR.fromURString(urString);
    return X25519PublicKey.fromUR(ur);
  }
}
