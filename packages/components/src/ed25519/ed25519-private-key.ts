/**
 * Ed25519 private key for EdDSA signatures (32 bytes seed)
 * Ported from bc-components-rust/src/ed25519_private_key.rs
 */

import { SecureRandomNumberGenerator } from "@bcts/rand";
import {
  ED25519_PRIVATE_KEY_SIZE,
  ed25519PublicKeyFromPrivateKey,
  ed25519Sign,
} from "@bcts/crypto";
import { CryptoError } from "../error.js";
import { Ed25519PublicKey } from "./ed25519-public-key.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class Ed25519PrivateKey {
  private readonly seed: Uint8Array;
  private _publicKey?: Ed25519PublicKey;

  private constructor(seed: Uint8Array) {
    if (seed.length !== ED25519_PRIVATE_KEY_SIZE) {
      throw CryptoError.invalidSize(ED25519_PRIVATE_KEY_SIZE, seed.length);
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
    return new Ed25519PrivateKey(hexToBytes(hex));
  }

  /**
   * Generate a random Ed25519PrivateKey
   */
  static random(): Ed25519PrivateKey {
    const rng = new SecureRandomNumberGenerator();
    return new Ed25519PrivateKey(rng.randomData(ED25519_PRIVATE_KEY_SIZE));
  }

  /**
   * Generate a random Ed25519PrivateKey using provided RNG
   */
  static randomUsing(rng: SecureRandomNumberGenerator): Ed25519PrivateKey {
    return new Ed25519PrivateKey(rng.randomData(ED25519_PRIVATE_KEY_SIZE));
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
    return bytesToHex(this.seed);
  }

  /**
   * Get base64 representation of the seed
   */
  toBase64(): string {
    return toBase64(this.seed);
  }

  /**
   * Derive the corresponding public key
   */
  publicKey(): Ed25519PublicKey {
    if (this._publicKey === undefined) {
      const publicKeyBytes = ed25519PublicKeyFromPrivateKey(this.seed);
      this._publicKey = Ed25519PublicKey.from(publicKeyBytes);
    }
    return this._publicKey;
  }

  /**
   * Sign a message using Ed25519
   */
  sign(message: Uint8Array): Uint8Array {
    try {
      const signature = ed25519Sign(this.seed, message);
      return new Uint8Array(signature);
    } catch (e) {
      throw CryptoError.cryptoOperation(`Ed25519 signing failed: ${String(e)}`);
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
