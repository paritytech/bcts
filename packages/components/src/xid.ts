/**
 * eXtensible Identifier (XID) - 32-byte identifier bound to a public key
 */

declare global {
  interface Global {
    crypto?: Crypto;
  }
  var global: Global;
  var Buffer: any;
}

import { CryptoError } from "./error.js";

const XID_SIZE = 32;

export class XID {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== XID_SIZE) {
      throw CryptoError.invalidSize(XID_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create an XID from raw bytes
   */
  static from(data: Uint8Array): XID {
    return new XID(new Uint8Array(data));
  }

  /**
   * Create an XID from hex string
   */
  static fromHex(hex: string): XID {
    if (hex.length !== 64) {
      throw CryptoError.invalidFormat(`XID hex must be 64 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      data[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new XID(data);
  }

  /**
   * Generate a random XID
   */
  static random(): XID {
    const data = new Uint8Array(XID_SIZE);
    if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(data);
    } else if (typeof global !== "undefined" && typeof global.crypto !== "undefined") {
      global.crypto.getRandomValues(data);
    } else {
      // Fallback: fill with available random data
      for (let i = 0; i < XID_SIZE; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
    }
    return new XID(data);
  }

  /**
   * Get the raw XID bytes
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
   * Get short reference (first 4 bytes) as hex
   */
  shortReference(): string {
    return Array.from(this.data.slice(0, 4))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  /**
   * Compare with another XID
   */
  equals(other: XID): boolean {
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
    return `XID(${this.toHex()})`;
  }
}
