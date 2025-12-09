/**
 * SHA-256 cryptographic digest (32 bytes)
 * Ported from bc-components-rust/src/digest.rs
 */

import { sha256, SHA256_SIZE } from "@blockchain-commons/crypto";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

export class Digest {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== SHA256_SIZE) {
      throw CryptoError.invalidSize(SHA256_SIZE, data.length);
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
    return new Digest(hexToBytes(hex));
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
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
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
