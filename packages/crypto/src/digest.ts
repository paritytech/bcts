/**
 * SHA-256 cryptographic digest (32 bytes)
 */

import { sha256 } from '@noble/hashes/sha256';
import { CryptoError } from './error.js';

const DIGEST_SIZE = 32;

export class Digest {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== DIGEST_SIZE) {
      throw CryptoError.invalidSize(DIGEST_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create a Digest from raw bytes
   */
  static from(data: Uint8Array): Digest {
    return new Digest(new Uint8Array(data));
  }

  /**
   * Create a Digest from hex string
   */
  static fromHex(hex: string): Digest {
    const data = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      data[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new Digest(data);
  }

  /**
   * Compute SHA-256 digest of data
   */
  static hash(data: Uint8Array): Digest {
    const hashData = sha256(data);
    return new Digest(new Uint8Array(hashData));
  }

  /**
   * Get the raw digest bytes
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
   * Compare with another Digest
   */
  equals(other: Digest): boolean {
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
    return `Digest(${this.toHex()})`;
  }
}
