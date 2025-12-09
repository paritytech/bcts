/**
 * X25519 private key for ECDH key exchange (32 bytes seed)
 */

declare global {
  interface Global {
    crypto?: Crypto;
  }
  var global: Global;
  var Buffer: any;
}

import { x25519 } from "@noble/curves/ed25519.js";
import { CryptoError } from "./error.js";
import { X25519PublicKey } from "./x25519-public-key.js";

const X25519_KEY_SIZE = 32;

export class X25519PrivateKey {
  private data: Uint8Array;
  private _publicKey?: X25519PublicKey;

  private constructor(data: Uint8Array) {
    if (data.length !== X25519_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_KEY_SIZE, data.length);
    }
    this.data = new Uint8Array(data);
  }

  /**
   * Create an X25519PrivateKey from raw bytes
   */
  static from(data: Uint8Array): X25519PrivateKey {
    return new X25519PrivateKey(new Uint8Array(data));
  }

  /**
   * Create an X25519PrivateKey from hex string
   */
  static fromHex(hex: string): X25519PrivateKey {
    if (hex.length !== 64) {
      throw CryptoError.invalidFormat(
        `X25519 private key hex must be 64 characters, got ${hex.length}`,
      );
    }
    const data = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      data[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new X25519PrivateKey(data);
  }

  /**
   * Generate a random X25519PrivateKey
   */
  static random(): X25519PrivateKey {
    const data = new Uint8Array(X25519_KEY_SIZE);
    if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(data);
    } else if (typeof global !== "undefined" && typeof global.crypto !== "undefined") {
      global.crypto.getRandomValues(data);
    } else {
      // Fallback: fill with available random data
      for (let i = 0; i < X25519_KEY_SIZE; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }
    }
    return new X25519PrivateKey(data);
  }

  /**
   * Get the raw private key bytes
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
   * Derive the corresponding public key
   */
  publicKey(): X25519PublicKey {
    if (!this._publicKey) {
      // Use x25519 to get the public key from the private key
      // The @noble/curves library provides this functionality
      // @ts-ignore - x25519 function signature compatibility
      const publicKeyBytes = x25519(this.data);
      this._publicKey = X25519PublicKey.from(publicKeyBytes);
    }
    return this._publicKey;
  }

  /**
   * Perform ECDH key agreement with a public key
   */
  sharedSecret(publicKey: X25519PublicKey): Uint8Array {
    try {
      // @ts-ignore - x25519 function signature compatibility
      const shared = x25519(this.data, publicKey.toData());
      return new Uint8Array(shared);
    } catch (e) {
      throw CryptoError.cryptoOperation(`ECDH key agreement failed: ${e}`);
    }
  }

  /**
   * Compare with another X25519PrivateKey
   */
  equals(other: X25519PrivateKey): boolean {
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
    return `X25519PrivateKey(${this.toHex().substring(0, 16)}...)`;
  }
}
