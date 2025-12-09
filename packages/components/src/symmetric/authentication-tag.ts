/**
 * Authentication tag for AEAD encryption (16 bytes)
 *
 * An `AuthenticationTag` is a 16-byte value generated during ChaCha20-Poly1305
 * authenticated encryption. It serves as a message authentication code (MAC)
 * that verifies both the authenticity and integrity of the encrypted message.
 *
 * During decryption, the tag is verified to ensure:
 * - The message has not been tampered with (integrity)
 * - The message was encrypted by someone who possesses the encryption key
 *   (authenticity)
 *
 * This implementation follows the Poly1305 MAC algorithm as specified in
 * [RFC-8439](https://datatracker.ietf.org/doc/html/rfc8439).
 *
 * Ported from bc-components-rust/src/symmetric/authentication_tag.rs
 */

import { type Cbor, toByteString, expectBytes, decodeCbor } from "@bcts/dcbor";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

const AUTHENTICATION_TAG_SIZE = 16;

export class AuthenticationTag {
  static readonly AUTHENTICATION_TAG_SIZE = AUTHENTICATION_TAG_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== AUTHENTICATION_TAG_SIZE) {
      throw CryptoError.invalidSize(AUTHENTICATION_TAG_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Restore an AuthenticationTag from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): AuthenticationTag {
    return new AuthenticationTag(new Uint8Array(data));
  }

  /**
   * Restore an AuthenticationTag from a reference to an array of bytes.
   */
  static fromDataRef(data: Uint8Array): AuthenticationTag {
    if (data.length !== AUTHENTICATION_TAG_SIZE) {
      throw CryptoError.invalidSize(AUTHENTICATION_TAG_SIZE, data.length);
    }
    return AuthenticationTag.fromData(data);
  }

  /**
   * Create an AuthenticationTag from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): AuthenticationTag {
    return AuthenticationTag.fromData(data);
  }

  /**
   * Create an AuthenticationTag from hex string.
   */
  static fromHex(hex: string): AuthenticationTag {
    return AuthenticationTag.fromData(hexToBytes(hex));
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
   * Get the reference as a byte slice.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get the raw tag bytes as a copy.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Get hex string representation.
   */
  toHex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Get base64 representation.
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Compare with another AuthenticationTag.
   */
  equals(other: AuthenticationTag): boolean {
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
    return `AuthenticationTag(${this.toHex()})`;
  }

  // ============================================================================
  // CBOR Serialization (untagged - no CBOR tag for AuthenticationTag)
  // ============================================================================

  /**
   * Returns the untagged CBOR encoding (as a byte string).
   * AuthenticationTag has no CBOR tag - it's serialized as a plain byte string.
   */
  toCbor(): Cbor {
    return toByteString(this._data);
  }

  /**
   * Returns the CBOR binary representation.
   */
  toCborData(): Uint8Array {
    return this.toCbor().toData();
  }

  /**
   * Creates an AuthenticationTag from CBOR.
   */
  static fromCbor(cbor: Cbor): AuthenticationTag {
    const data = expectBytes(cbor);
    return AuthenticationTag.fromDataRef(data);
  }

  /**
   * Creates an AuthenticationTag from CBOR binary data.
   */
  static fromCborData(data: Uint8Array): AuthenticationTag {
    const cbor = decodeCbor(data);
    return AuthenticationTag.fromCbor(cbor);
  }
}
