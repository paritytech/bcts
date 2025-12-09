/**
 * Authentication tag for AEAD encryption (16 bytes)
 */

declare global {
  interface Global {
    crypto?: Crypto;
  }
  var global: Global;
  var Buffer: any;
}

import { CryptoError } from "./error.js";

const AUTH_TAG_SIZE = 16;

export class AuthenticationTag {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== AUTH_TAG_SIZE) {
      throw CryptoError.invalidSize(AUTH_TAG_SIZE, data.length);
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
    if (hex.length !== 32) {
      throw CryptoError.invalidFormat(
        `AuthenticationTag hex must be 32 characters, got ${hex.length}`,
      );
    }
    const data = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      data[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new AuthenticationTag(data);
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
    return Array.from(this.data)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return Buffer.from(this.data).toString("base64");
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
