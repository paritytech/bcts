/**
 * Cryptographic seed with optional metadata (minimum 16 bytes)
 */

import { CryptoError } from './error.js';

const MIN_SEED_SIZE = 16;

export interface SeedMetadata {
  name?: string;
  note?: string;
  createdAt?: Date;
}

export class Seed {
  private data: Uint8Array;
  private metadata?: SeedMetadata;

  private constructor(data: Uint8Array, metadata?: SeedMetadata) {
    if (data.length < MIN_SEED_SIZE) {
      throw CryptoError.invalidSize(MIN_SEED_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
    this.metadata = metadata;
  }

  /**
   * Create a Seed from raw bytes
   */
  static from(data: Uint8Array, metadata?: SeedMetadata): Seed {
    return new Seed(new Uint8Array(data), metadata);
  }

  /**
   * Create a Seed from hex string
   */
  static fromHex(hex: string, metadata?: SeedMetadata): Seed {
    const data = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      data[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return new Seed(data, metadata);
  }

  /**
   * Generate a random seed with specified size
   */
  static random(size: number = 32, metadata?: SeedMetadata): Seed {
    if (size < MIN_SEED_SIZE) {
      throw CryptoError.invalidSize(MIN_SEED_SIZE, size);
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
    return new Seed(data, metadata);
  }

  /**
   * Get the raw seed bytes
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
   * Get seed size in bytes
   */
  size(): number {
    return this.data.length;
  }

  /**
   * Get or set name
   */
  name(): string | undefined {
    return this.metadata?.name;
  }

  setName(name: string): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.name = name;
  }

  /**
   * Get or set note
   */
  note(): string | undefined {
    return this.metadata?.note;
  }

  setNote(note: string): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.note = note;
  }

  /**
   * Get or set creation date
   */
  createdAt(): Date | undefined {
    return this.metadata?.createdAt;
  }

  setCreatedAt(date: Date): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.createdAt = date;
  }

  /**
   * Get metadata
   */
  getMetadata(): SeedMetadata | undefined {
    return this.metadata ? { ...this.metadata } : undefined;
  }

  /**
   * Compare with another Seed
   */
  equals(other: Seed): boolean {
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
    const parts = [`Seed(${this.toHex().substring(0, 16)}..., ${this.size()} bytes)`];
    if (this.metadata?.name) parts.push(`name: ${this.metadata.name}`);
    if (this.metadata?.note) parts.push(`note: ${this.metadata.note}`);
    if (this.metadata?.createdAt) parts.push(`created: ${this.metadata.createdAt.toISOString()}`);
    return parts[0];
  }
}
