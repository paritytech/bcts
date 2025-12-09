/**
 * X25519 public key for ECDH key exchange (32 bytes)
 * Ported from bc-components-rust/src/x25519_public_key.rs
 */

import { X25519_PUBLIC_KEY_SIZE } from "@blockchain-commons/crypto";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class X25519PublicKey {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== X25519_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_PUBLIC_KEY_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create an X25519PublicKey from raw bytes
   */
  static from(data: Uint8Array): X25519PublicKey {
    return new X25519PublicKey(new Uint8Array(data));
  }

  /**
   * Create an X25519PublicKey from hex string
   */
  static fromHex(hex: string): X25519PublicKey {
    return new X25519PublicKey(hexToBytes(hex));
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
   * Compare with another X25519PublicKey
   */
  equals(other: X25519PublicKey): boolean {
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
    return `X25519PublicKey(${this.toHex().substring(0, 16)}...)`;
  }
}
