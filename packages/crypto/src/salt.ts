/**
 * Cryptographic salt - variable-length randomization value (minimum 8 bytes)
 */

import { CryptoError } from './error.js';

const MIN_SALT_SIZE = 8;

export class Salt {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length < MIN_SALT_SIZE) {
      throw CryptoError.invalidSize(MIN_SALT_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create a Salt from raw bytes
   */
  static from(data: Uint8Array): Salt {
    return new Salt(new Uint8Array(data));
  }

  /**
   * Create a Salt from hex string
   */
  static fromHex(hex: string): Salt {
    const data = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      data[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new Salt(data);
  }

  /**
   * Generate a random salt with specified size
   */
  static random(size: number = 16): Salt {
    if (size < MIN_SALT_SIZE) {
      throw CryptoError.invalidSize(MIN_SALT_SIZE, size);
    }
    const data = new Uint8Array(size);
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(data);
    } else {
      // Fallback for Node.js
      const { randomBytes } = require('crypto');
      const buf = randomBytes(size);
      data.set(buf);
    }
    return new Salt(data);
  }

  /**
   * Generate a proportionally-sized salt (5-25% of target data size)
   */
  static proportional(dataSize: number): Salt {
    // Calculate proportional size: 10% of data size, clamped between 8 and 32
    const size = Math.max(MIN_SALT_SIZE, Math.min(32, Math.ceil(dataSize * 0.1)));
    return Salt.random(size);
  }

  /**
   * Get the raw salt bytes
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
   * Get salt size in bytes
   */
  size(): number {
    return this.data.length;
  }

  /**
   * Compare with another Salt
   */
  equals(other: Salt): boolean {
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
    return `Salt(${this.toHex()}, ${this.size()} bytes)`;
  }
}
