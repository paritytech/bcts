/**
 * Cryptographic nonce (12 bytes, suitable for AES-GCM and ChaCha20-Poly1305)
 */

import { CryptoError } from './error.js';

const NONCE_SIZE = 12;

export class Nonce {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== NONCE_SIZE) {
      throw CryptoError.invalidSize(NONCE_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create a Nonce from raw bytes
   */
  static from(data: Uint8Array): Nonce {
    return new Nonce(new Uint8Array(data));
  }

  /**
   * Create a Nonce from hex string
   */
  static fromHex(hex: string): Nonce {
    const data = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      data[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new Nonce(data);
  }

  /**
   * Generate a random nonce
   */
  static random(): Nonce {
    const data = new Uint8Array(NONCE_SIZE);
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(data);
    } else {
      // Fallback for Node.js
      const { randomBytes } = require('crypto');
      const buf = randomBytes(NONCE_SIZE);
      data.set(buf);
    }
    return new Nonce(data);
  }

  /**
   * Get the raw nonce bytes
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
      .join('');
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return Buffer.from(this.data).toString('base64');
  }

  /**
   * Compare with another Nonce
   */
  equals(other: Nonce): boolean {
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
    return `Nonce(${this.toHex()})`;
  }
}
