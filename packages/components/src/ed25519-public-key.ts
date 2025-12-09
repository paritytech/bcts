/**
 * Ed25519 public key for EdDSA signature verification (32 bytes)
 * Ported from bc-components-rust/src/ed25519_public_key.rs
 */

import {
  ED25519_PUBLIC_KEY_SIZE,
  ED25519_SIGNATURE_SIZE,
  ed25519Verify,
} from "@blockchain-commons/crypto";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

export class Ed25519PublicKey {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(ED25519_PUBLIC_KEY_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create an Ed25519PublicKey from raw bytes
   */
  static from(data: Uint8Array): Ed25519PublicKey {
    return new Ed25519PublicKey(new Uint8Array(data));
  }

  /**
   * Create an Ed25519PublicKey from hex string
   */
  static fromHex(hex: string): Ed25519PublicKey {
    return new Ed25519PublicKey(hexToBytes(hex));
  }

  /**
   * Get the raw public key bytes
   */
  toData(): Uint8Array {
    return new Uint8Array(this.data);
  }

  /**
   * Get hex string representation
   */
  toHex(): string {
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
  }

  /**
   * Verify a signature using Ed25519
   */
  verify(message: Uint8Array, signature: Uint8Array): boolean {
    try {
      if (signature.length !== ED25519_SIGNATURE_SIZE) {
        throw CryptoError.invalidSize(ED25519_SIGNATURE_SIZE, signature.length);
      }
      return ed25519Verify(this.data, message, signature);
    } catch (e) {
      throw CryptoError.cryptoOperation(`Ed25519 verification failed: ${e}`);
    }
  }

  /**
   * Compare with another Ed25519PublicKey
   */
  equals(other: Ed25519PublicKey): boolean {
    if (this.data.length !== other.data.length) return false;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `Ed25519PublicKey(${this.toHex().substring(0, 16)}...)`;
  }
}
