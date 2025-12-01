/**
 * Symmetric key for ChaCha20-Poly1305 AEAD encryption (32 bytes)
 */

import { CryptoError } from './error.js';

const SYMMETRIC_KEY_SIZE = 32;

export class SymmetricKey {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== SYMMETRIC_KEY_SIZE) {
      throw CryptoError.invalidSize(SYMMETRIC_KEY_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create a SymmetricKey from raw bytes
   */
  static from(data: Uint8Array): SymmetricKey {
    return new SymmetricKey(new Uint8Array(data));
  }

  /**
   * Create a SymmetricKey from hex string
   */
  static fromHex(hex: string): SymmetricKey {
    if (hex.length !== 64) {
      throw CryptoError.invalidFormat(`SymmetricKey hex must be 64 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      data[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new SymmetricKey(data);
  }

  /**
   * Generate a random symmetric key
   */
  static random(): SymmetricKey {
    const data = new Uint8Array(SYMMETRIC_KEY_SIZE);
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(data);
    } else {
      // Fallback for Node.js
      const { randomBytes } = require('crypto');
      const buf = randomBytes(SYMMETRIC_KEY_SIZE);
      data.set(buf);
    }
    return new SymmetricKey(data);
  }

  /**
   * Get the raw key bytes
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
   * Compare with another SymmetricKey
   */
  equals(other: SymmetricKey): boolean {
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
    return `SymmetricKey(${this.toHex().substring(0, 16)}...)`;
  }
}
