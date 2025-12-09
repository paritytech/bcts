/**
 * Schnorr (x-only) public key for BIP-340 signatures (secp256k1, 32 bytes)
 *
 * A `SchnorrPublicKey` is a 32-byte "x-only" public key used with the BIP-340
 * Schnorr signature scheme. Unlike compressed ECDSA public keys (33 bytes)
 * that include a prefix byte indicating the parity of the y-coordinate,
 * Schnorr public keys only contain the x-coordinate of the elliptic curve
 * point.
 *
 * Schnorr signatures offer several advantages over traditional ECDSA
 * signatures:
 * - Linearity: Enables key and signature aggregation
 * - Non-malleability: Prevents third parties from modifying signatures
 * - Smaller size: Signatures are 64 bytes vs 70-72 bytes for ECDSA
 * - Better privacy: Makes different multisig policies indistinguishable
 *
 * Schnorr signatures were introduced to Bitcoin via the Taproot upgrade
 * (BIP-340).
 *
 * Note: SchnorrPublicKey does not have CBOR serialization in the Rust
 * implementation, so we keep it simple here.
 *
 * Ported from bc-components-rust/src/ec_key/schnorr_public_key.rs
 */

import { SCHNORR_PUBLIC_KEY_SIZE, schnorrVerify } from "@bcts/crypto";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class SchnorrPublicKey {
  static readonly KEY_SIZE = SCHNORR_PUBLIC_KEY_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== SCHNORR_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(SCHNORR_PUBLIC_KEY_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Restore a SchnorrPublicKey from a fixed-size array of bytes.
   */
  static fromData(data: Uint8Array): SchnorrPublicKey {
    return new SchnorrPublicKey(new Uint8Array(data));
  }

  /**
   * Restore a SchnorrPublicKey from a reference to an array of bytes.
   * Validates the length.
   */
  static fromDataRef(data: Uint8Array): SchnorrPublicKey {
    if (data.length !== SCHNORR_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(SCHNORR_PUBLIC_KEY_SIZE, data.length);
    }
    return SchnorrPublicKey.fromData(data);
  }

  /**
   * Create a SchnorrPublicKey from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): SchnorrPublicKey {
    return SchnorrPublicKey.fromData(data);
  }

  /**
   * Restore a SchnorrPublicKey from a hex string.
   */
  static fromHex(hex: string): SchnorrPublicKey {
    return SchnorrPublicKey.fromData(hexToBytes(hex));
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
   * Verify a Schnorr signature (BIP-340).
   *
   * @param signature - The 64-byte signature to verify
   * @param message - The message that was signed
   * @returns true if the signature is valid
   */
  schnorrVerify(signature: Uint8Array, message: Uint8Array): boolean {
    try {
      return schnorrVerify(this._data, signature, message);
    } catch {
      return false;
    }
  }

  /**
   * Compare with another SchnorrPublicKey.
   */
  equals(other: SchnorrPublicKey): boolean {
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
    return `SchnorrPublicKey(${this.toHex().substring(0, 16)}...)`;
  }
}
