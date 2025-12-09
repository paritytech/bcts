/**
 * Authentication tag for AEAD encryption (16 bytes)
 * Ported from bc-components-rust/src/auth.rs
 */

import { SYMMETRIC_AUTH_SIZE } from "@blockchain-commons/crypto";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";

export class AuthenticationTag {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== SYMMETRIC_AUTH_SIZE) {
      throw CryptoError.invalidSize(SYMMETRIC_AUTH_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create an AuthenticationTag from raw bytes
   */
  static from(data: Uint8Array): AuthenticationTag {
    return new AuthenticationTag(new Uint8Array(data));
  }

  /**
   * Create an AuthenticationTag from hex string
   */
  static fromHex(hex: string): AuthenticationTag {
    return new AuthenticationTag(hexToBytes(hex));
  }

  /**
   * Get the raw tag bytes
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
   * Compare with another AuthenticationTag
   */
  equals(other: AuthenticationTag): boolean {
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
    return `AuthenticationTag(${this.toHex()})`;
  }
}
