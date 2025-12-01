/**
 * X25519 public key for ECDH key agreement (32 bytes)
 */

import { CryptoError } from './error.js';

const X25519_KEY_SIZE = 32;

export class X25519PublicKey {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== X25519_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_KEY_SIZE, data.length);
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
    if (hex.length !== 64) {
      throw CryptoError.invalidFormat(`X25519 public key hex must be 64 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      data[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new X25519PublicKey(data);
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
    return Array.from(this.data)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return Buffer.from(this.data).toString('base64');
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
