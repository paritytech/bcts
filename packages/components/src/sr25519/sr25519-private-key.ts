/**
 * Sr25519PrivateKey - Schnorr signatures over Ristretto25519
 *
 * SR25519 is the signature scheme used by Polkadot/Substrate.
 * It is based on Schnorr signatures over the Ristretto group.
 *
 * Key sizes:
 * - Private key (seed): 32 bytes
 * - Public key: 32 bytes
 * - Signature: 64 bytes
 *
 * Note: SR25519 uses the SigningPrivateKey CBOR tag (40021) with discriminator 3.
 *
 * Ported from bc-components-rust/src/sr25519/sr25519_private_key.rs
 */

import * as sr25519 from "@scure/sr25519";
import type { RandomNumberGenerator } from "@bcts/rand";
import { SecureRandomNumberGenerator } from "@bcts/rand";
import { blake2b } from "@noble/hashes/blake2.js";
import { Sr25519PublicKey } from "./sr25519-public-key.js";
import { bytesToHex } from "../utils.js";

/** Size of SR25519 private key (seed) in bytes */
export const SR25519_PRIVATE_KEY_SIZE = 32;

/** Size of SR25519 public key in bytes */
export const SR25519_PUBLIC_KEY_SIZE = 32;

/** Size of SR25519 signature in bytes */
export const SR25519_SIGNATURE_SIZE = 64;

/** Default signing context (Substrate/Polkadot compatible) */
export const SR25519_DEFAULT_CONTEXT = new TextEncoder().encode("substrate");

/**
 * Sr25519PrivateKey - Private key for Schnorr signatures over Ristretto25519.
 *
 * This is the signature scheme used by Polkadot/Substrate.
 */
export class Sr25519PrivateKey {
  private readonly _seed: Uint8Array;
  private _cachedPublicKey?: Sr25519PublicKey;

  private constructor(seed: Uint8Array) {
    if (seed.length !== SR25519_PRIVATE_KEY_SIZE) {
      throw new Error(
        `Sr25519PrivateKey seed must be ${SR25519_PRIVATE_KEY_SIZE} bytes, got ${seed.length}`,
      );
    }
    this._seed = new Uint8Array(seed);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new random Sr25519 private key.
   */
  static random(): Sr25519PrivateKey {
    const rng = new SecureRandomNumberGenerator();
    return Sr25519PrivateKey.randomUsing(rng);
  }

  /**
   * Create a new random Sr25519 private key using the provided RNG.
   */
  static randomUsing(rng: RandomNumberGenerator): Sr25519PrivateKey {
    const seed = rng.randomData(SR25519_PRIVATE_KEY_SIZE);
    return new Sr25519PrivateKey(seed);
  }

  /**
   * Create an Sr25519 private key from a 32-byte seed.
   */
  static fromSeed(seed: Uint8Array): Sr25519PrivateKey {
    return new Sr25519PrivateKey(seed);
  }

  /**
   * Create an Sr25519 private key from raw data.
   * Alias for fromSeed.
   */
  static from(data: Uint8Array): Sr25519PrivateKey {
    return Sr25519PrivateKey.fromSeed(data);
  }

  /**
   * Create an Sr25519 private key from a hex string.
   */
  static fromHex(hex: string): Sr25519PrivateKey {
    const matches = hex.match(/.{1,2}/g);
    if (matches === null) {
      throw new Error("Invalid hex string");
    }
    const data = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
    return Sr25519PrivateKey.fromSeed(data);
  }

  /**
   * Derive an Sr25519 private key from arbitrary key material using BLAKE2b.
   *
   * @param keyMaterial - Arbitrary bytes to derive the key from
   * @returns A new Sr25519 private key
   */
  static deriveFromKeyMaterial(keyMaterial: Uint8Array): Sr25519PrivateKey {
    // Use BLAKE2b to derive a 32-byte seed from arbitrary key material
    const seed = blake2b(keyMaterial, { dkLen: SR25519_PRIVATE_KEY_SIZE });
    return new Sr25519PrivateKey(seed);
  }

  /**
   * Generate a keypair and return both private and public keys.
   *
   * @returns Tuple of [privateKey, publicKey]
   */
  static keypair(): [Sr25519PrivateKey, Sr25519PublicKey] {
    const privateKey = Sr25519PrivateKey.random();
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  /**
   * Generate a keypair using the provided RNG.
   *
   * @param rng - Random number generator
   * @returns Tuple of [privateKey, publicKey]
   */
  static keypairUsing(rng: RandomNumberGenerator): [Sr25519PrivateKey, Sr25519PublicKey] {
    const privateKey = Sr25519PrivateKey.randomUsing(rng);
    const publicKey = privateKey.publicKey();
    return [privateKey, publicKey];
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the raw seed bytes.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._seed);
  }

  /**
   * Returns the raw seed bytes (alias for toData).
   */
  asBytes(): Uint8Array {
    return this._seed;
  }

  /**
   * Returns the hex representation of the seed.
   */
  toHex(): string {
    return bytesToHex(this._seed);
  }

  /**
   * Derives the corresponding public key.
   */
  publicKey(): Sr25519PublicKey {
    if (this._cachedPublicKey === undefined) {
      const secretKey = sr25519.secretFromSeed(this._seed);
      const pubKeyBytes = sr25519.getPublicKey(secretKey);
      this._cachedPublicKey = Sr25519PublicKey.from(pubKeyBytes);
    }
    return this._cachedPublicKey;
  }

  /**
   * Sign a message using the default "substrate" context.
   *
   * @param message - The message to sign
   * @returns 64-byte signature
   */
  sign(message: Uint8Array): Uint8Array {
    return this.signWithContext(message, SR25519_DEFAULT_CONTEXT);
  }

  /**
   * Sign a message using a custom context.
   *
   * Note: The @scure/sr25519 library uses a hardcoded "substrate" context.
   * Custom context is accepted for API compatibility but only "substrate" context
   * will produce signatures verifiable by this library.
   *
   * @param message - The message to sign
   * @param context - The signing context (only "substrate" is supported)
   * @returns 64-byte signature
   */
  signWithContext(message: Uint8Array, _context: Uint8Array): Uint8Array {
    const secretKey = sr25519.secretFromSeed(this._seed);
    // Note: @scure/sr25519 sign() uses hardcoded "substrate" context
    // Arguments: sign(secretKey, message, random?)
    return sr25519.sign(secretKey, message);
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another Sr25519PrivateKey.
   */
  equals(other: Sr25519PrivateKey): boolean {
    if (this._seed.length !== other._seed.length) return false;
    for (let i = 0; i < this._seed.length; i++) {
      if (this._seed[i] !== other._seed[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation (truncated for security).
   */
  toString(): string {
    const hex = bytesToHex(this._seed);
    return `Sr25519PrivateKey(${hex.substring(0, 8)}...)`;
  }
}
