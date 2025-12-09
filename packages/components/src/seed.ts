/**
 * Cryptographic seed with optional metadata (minimum 16 bytes)
 * Ported from bc-components-rust/src/seed.rs
 */

import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

const MIN_SEED_SIZE = 16;

export interface SeedMetadata {
  name?: string;
  note?: string;
  createdAt?: Date;
}

export class Seed {
  private readonly data: Uint8Array;
  private metadata: SeedMetadata | undefined;

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
    return new Seed(hexToBytes(hex), metadata);
  }

  /**
   * Generate a random seed with specified size
   */
  static random(size = 32, metadata?: SeedMetadata): Seed {
    if (size < MIN_SEED_SIZE) {
      throw CryptoError.invalidSize(MIN_SEED_SIZE, size);
    }
    const rng = new SecureRandomNumberGenerator();
    return new Seed(rng.randomData(size), metadata);
  }

  /**
   * Generate a random seed using provided RNG
   */
  static randomUsing(
    rng: SecureRandomNumberGenerator,
    size = 32,
    metadata?: SeedMetadata,
  ): Seed {
    if (size < MIN_SEED_SIZE) {
      throw CryptoError.invalidSize(MIN_SEED_SIZE, size);
    }
    return new Seed(rng.randomData(size), metadata);
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
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
  }

  /**
   * Get seed size in bytes
   */
  size(): number {
    return this.data.length;
  }

  /**
   * Get name
   */
  name(): string | undefined {
    return this.metadata?.name;
  }

  /**
   * Set name
   */
  setName(name: string): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.name = name;
  }

  /**
   * Get note
   */
  note(): string | undefined {
    return this.metadata?.note;
  }

  /**
   * Set note
   */
  setNote(note: string): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata.note = note;
  }

  /**
   * Get creation date
   */
  createdAt(): Date | undefined {
    return this.metadata?.createdAt;
  }

  /**
   * Set creation date
   */
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
    return `Seed(${this.toHex().substring(0, 16)}..., ${this.size()} bytes)`;
  }
}
