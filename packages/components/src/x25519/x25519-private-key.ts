/**
 * X25519 private key for ECDH key exchange (32 bytes seed)
 * Ported from bc-components-rust/src/x25519_private_key.rs
 */

import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import {
  X25519_PRIVATE_KEY_SIZE,
  x25519PublicKeyFromPrivateKey,
  x25519SharedKey,
} from "@blockchain-commons/crypto";
import { CryptoError } from "../error.js";
import { X25519PublicKey } from "./x25519-public-key.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class X25519PrivateKey {
  private readonly data: Uint8Array;
  private _publicKey?: X25519PublicKey;

  private constructor(data: Uint8Array) {
    if (data.length !== X25519_PRIVATE_KEY_SIZE) {
      throw CryptoError.invalidSize(X25519_PRIVATE_KEY_SIZE, data.length);
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
    return new X25519PrivateKey(hexToBytes(hex));
  }

  /**
   * Generate a random X25519PrivateKey
   */
  static random(): X25519PrivateKey {
    const rng = new SecureRandomNumberGenerator();
    return new X25519PrivateKey(rng.randomData(X25519_PRIVATE_KEY_SIZE));
  }

  /**
   * Generate a random X25519PrivateKey using provided RNG
   */
  static randomUsing(rng: SecureRandomNumberGenerator): X25519PrivateKey {
    return new X25519PrivateKey(rng.randomData(X25519_PRIVATE_KEY_SIZE));
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
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
  }

  /**
   * Derive the corresponding public key
   */
  publicKey(): X25519PublicKey {
    if (!this._publicKey) {
      const publicKeyBytes = x25519PublicKeyFromPrivateKey(this.data);
      this._publicKey = X25519PublicKey.from(publicKeyBytes);
    }
    return this._publicKey;
  }

  /**
   * Perform ECDH key agreement with a public key
   */
  sharedSecret(publicKey: X25519PublicKey): Uint8Array {
    try {
      const shared = x25519SharedKey(this.data, publicKey.toData());
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
