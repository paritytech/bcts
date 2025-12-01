/**
 * Ed25519 public key for EdDSA verification (32 bytes)
 */

import { ed25519ph } from '@noble/curves/ed25519';
import { CryptoError } from './error.js';

const ED25519_PUBLIC_KEY_SIZE = 32;

export class Ed25519PublicKey {
  private data: Uint8Array;

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
    if (hex.length !== 64) {
      throw CryptoError.invalidFormat(`Ed25519 public key hex must be 64 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      data[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new Ed25519PublicKey(data);
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
   * Verify a signature using Ed25519
   */
  verify(message: Uint8Array, signature: Uint8Array): boolean {
    try {
      if (signature.length !== 64) {
        throw CryptoError.invalidSize(64, signature.length);
      }
      return ed25519ph.verify(signature, message, this.data);
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
