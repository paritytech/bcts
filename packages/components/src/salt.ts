/**
 * Cryptographic salt - variable-length randomization value (minimum 8 bytes)
 * Ported from bc-components-rust/src/salt.rs
 */

import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

const MIN_SALT_SIZE = 8;

export class Salt {
  private readonly data: Uint8Array;

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
    return new Salt(hexToBytes(hex));
  }

  /**
   * Generate a random salt with specified size
   */
  static random(size = 16): Salt {
    if (size < MIN_SALT_SIZE) {
      throw CryptoError.invalidSize(MIN_SALT_SIZE, size);
    }
    const rng = new SecureRandomNumberGenerator();
    return new Salt(rng.randomData(size));
  }

  /**
   * Generate a random salt with specified size using provided RNG
   */
  static randomUsing(rng: SecureRandomNumberGenerator, size = 16): Salt {
    if (size < MIN_SALT_SIZE) {
      throw CryptoError.invalidSize(MIN_SALT_SIZE, size);
    }
    return new Salt(rng.randomData(size));
  }

  /**
   * Generate a proportionally-sized salt (10% of target data size, clamped 8-32)
   */
  static proportional(dataSize: number): Salt {
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
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
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
