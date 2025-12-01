/**
 * Ed25519 private key for EdDSA signatures (32 bytes seed)
 */

import { ed25519ph } from '@noble/curves/ed25519';
import { CryptoError } from './error.js';
import { Ed25519PublicKey } from './ed25519-public-key.js';

const ED25519_SEED_SIZE = 32;
const ED25519_PRIVATE_KEY_SIZE = 64; // seed (32) + public (32)

export class Ed25519PrivateKey {
  private seed: Uint8Array;
  private _privateKey?: Uint8Array;
  private _publicKey?: Ed25519PublicKey;

  private constructor(seed: Uint8Array) {
    if (seed.length !== ED25519_SEED_SIZE) {
      throw CryptoError.invalidSize(ED25519_SEED_SIZE, seed.length);
    }
    this.seed = new Uint8Array(seed);
  }

  /**
   * Create an Ed25519PrivateKey from seed (32 bytes)
   */
  static from(seed: Uint8Array): Ed25519PrivateKey {
    return new Ed25519PrivateKey(new Uint8Array(seed));
  }

  /**
   * Create an Ed25519PrivateKey from hex string (64 hex characters)
   */
  static fromHex(hex: string): Ed25519PrivateKey {
    if (hex.length !== 64) {
      throw CryptoError.invalidFormat(`Ed25519 seed hex must be 64 characters, got ${hex.length}`);
    }
    const seed = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      seed[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new Ed25519PrivateKey(seed);
  }

  /**
   * Generate a random Ed25519PrivateKey
   */
  static random(): Ed25519PrivateKey {
    const seed = new Uint8Array(ED25519_SEED_SIZE);
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(seed);
    } else {
      // Fallback for Node.js
      const { randomBytes } = require('crypto');
      const buf = randomBytes(ED25519_SEED_SIZE);
      seed.set(buf);
    }
    return new Ed25519PrivateKey(seed);
  }

  /**
   * Get the raw seed bytes (32 bytes)
   */
  toData(): Uint8Array {
    return new Uint8Array(this.seed);
  }

  /**
   * Get hex string representation of the seed
   */
  toHex(): string {
    return Array.from(this.seed)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Get base64 representation of the seed
   */
  toBase64(): string {
    return Buffer.from(this.seed).toString('base64');
  }

  /**
   * Get the full private key (seed + public, 64 bytes)
   */
  getFullPrivateKey(): Uint8Array {
    if (!this._privateKey) {
      // Create the full private key by combining seed with public key
      const publicKeyBytes = ed25519ph.getPublicKey(this.seed);
      this._privateKey = new Uint8Array(64);
      this._privateKey.set(this.seed, 0);
      this._privateKey.set(publicKeyBytes, 32);
    }
    return new Uint8Array(this._privateKey);
  }

  /**
   * Derive the corresponding public key
   */
  publicKey(): Ed25519PublicKey {
    if (!this._publicKey) {
      const publicKeyBytes = ed25519ph.getPublicKey(this.seed);
      this._publicKey = Ed25519PublicKey.from(publicKeyBytes);
    }
    return this._publicKey;
  }

  /**
   * Sign a message using Ed25519
   */
  sign(message: Uint8Array): Uint8Array {
    try {
      const signature = ed25519ph.sign(message, this.seed);
      return new Uint8Array(signature);
    } catch (e) {
      throw CryptoError.cryptoOperation(`Ed25519 signing failed: ${e}`);
    }
  }

  /**
   * Compare with another Ed25519PrivateKey
   */
  equals(other: Ed25519PrivateKey): boolean {
    if (this.seed.length !== other.seed.length) return false;
    for (let i = 0; i < this.seed.length; i++) {
      if (this.seed[i] !== other.seed[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `Ed25519PrivateKey(${this.toHex().substring(0, 16)}...)`;
  }
}
