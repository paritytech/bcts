/**
 * Symmetric key for ChaCha20-Poly1305 AEAD encryption (32 bytes)
 * Ported from bc-components-rust/src/symmetric_key.rs
 */

import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import { SYMMETRIC_KEY_SIZE } from "@blockchain-commons/crypto";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

export class SymmetricKey {
  private readonly data: Uint8Array;

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
    return new SymmetricKey(hexToBytes(hex));
  }

  /**
   * Generate a random symmetric key
   */
  static random(): SymmetricKey {
    const rng = new SecureRandomNumberGenerator();
    return new SymmetricKey(rng.randomData(SYMMETRIC_KEY_SIZE));
  }

  /**
   * Generate a random symmetric key using provided RNG
   */
  static randomUsing(rng: SecureRandomNumberGenerator): SymmetricKey {
    return new SymmetricKey(rng.randomData(SYMMETRIC_KEY_SIZE));
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
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
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
