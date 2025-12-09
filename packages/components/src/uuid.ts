/**
 * Universally Unique Identifier (UUID) - 16-byte identifier
 */

declare global {
  interface Global {
    crypto?: Crypto;
  }
  var global: Global;
  var Buffer: any;
}

import { CryptoError } from "./error.js";

const UUID_SIZE = 16;

export class UUID {
  private data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== UUID_SIZE) {
      throw CryptoError.invalidSize(UUID_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create a UUID from raw bytes
   */
  static from(data: Uint8Array): UUID {
    return new UUID(new Uint8Array(data));
  }

  /**
   * Create a UUID from hex string (32 hex chars)
   */
  static fromHex(hex: string): UUID {
    if (hex.length !== 32) {
      throw CryptoError.invalidFormat(`UUID hex must be 32 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      data[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new UUID(data);
  }

  /**
   * Create a UUID from string representation (standard UUID format)
   * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  static fromString(uuidString: string): UUID {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuidString)) {
      throw CryptoError.invalidFormat(`Invalid UUID format: ${uuidString}`);
    }
    const hex = uuidString.replace(/-/g, "");
    return UUID.fromHex(hex);
  }

  /**
   * Generate a random UUID (v4)
   */
  static random(): UUID {
    const data = new Uint8Array(UUID_SIZE);
    if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(data);
    } else if (typeof global !== "undefined" && typeof global.crypto !== "undefined") {
      global.crypto.getRandomValues(data);
    } else {
      // Fallback: fill with available random data
      for (let i = 0; i < UUID_SIZE; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
    }

    // Set version to 4 (random)
    data[6] = (data[6] & 0x0f) | 0x40;
    // Set variant to RFC 4122
    data[8] = (data[8] & 0x3f) | 0x80;

    return new UUID(data);
  }

  /**
   * Get the raw UUID bytes
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
   * Get standard UUID string representation
   * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  toString(): string {
    const hex = this.toHex().toLowerCase();
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return Buffer.from(this.data).toString("base64");
  }

  /**
   * Compare with another UUID
   */
  equals(other: UUID): boolean {
    if (this.data.length !== other.data.length) return false;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }
    return true;
  }
}
