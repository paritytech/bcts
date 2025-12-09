/**
 * Cryptographic nonce (12 bytes, suitable for ChaCha20-Poly1305)
 * Ported from bc-components-rust/src/nonce.rs
 */

import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import { SYMMETRIC_NONCE_SIZE } from "@blockchain-commons/crypto";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

export class Nonce {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== SYMMETRIC_NONCE_SIZE) {
      throw CryptoError.invalidSize(SYMMETRIC_NONCE_SIZE, data.length);
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
    return new Nonce(hexToBytes(hex));
  }

  /**
   * Generate a random nonce using SecureRandomNumberGenerator
   */
  static random(): Nonce {
    const rng = new SecureRandomNumberGenerator();
    return new Nonce(rng.randomData(SYMMETRIC_NONCE_SIZE));
  }

  /**
   * Generate a random nonce using provided RNG
   */
  static randomUsing(rng: SecureRandomNumberGenerator): Nonce {
    return new Nonce(rng.randomData(SYMMETRIC_NONCE_SIZE));
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
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
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
