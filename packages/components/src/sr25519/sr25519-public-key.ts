/**
 * Sr25519PublicKey - Public key for Schnorr signatures over Ristretto25519
 *
 * SR25519 is the signature scheme used by Polkadot/Substrate.
 * It is based on Schnorr signatures over the Ristretto group.
 *
 * Note: SR25519 uses the SigningPublicKey CBOR tag (40022) with discriminator 3.
 *
 * Ported from bc-components-rust/src/sr25519/sr25519_public_key.rs
 */

import * as sr25519 from "@scure/sr25519";
import { SR25519_PUBLIC_KEY_SIZE, SR25519_DEFAULT_CONTEXT } from "./sr25519-private-key.js";
import { bytesToHex } from "../utils.js";

/**
 * Sr25519PublicKey - Public key for Schnorr signatures over Ristretto25519.
 *
 * This is the signature scheme used by Polkadot/Substrate.
 */
export class Sr25519PublicKey {
  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== SR25519_PUBLIC_KEY_SIZE) {
      throw new Error(
        `Sr25519PublicKey must be ${SR25519_PUBLIC_KEY_SIZE} bytes, got ${data.length}`,
      );
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an Sr25519 public key from raw bytes.
   */
  static from(data: Uint8Array): Sr25519PublicKey {
    return new Sr25519PublicKey(data);
  }

  /**
   * Create an Sr25519 public key from a hex string.
   */
  static fromHex(hex: string): Sr25519PublicKey {
    const matches = hex.match(/.{1,2}/g);
    if (matches === null) {
      throw new Error("Invalid hex string");
    }
    const data = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
    return Sr25519PublicKey.from(data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the raw key bytes.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Returns the raw key bytes (alias for toData).
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Returns the hex representation of the key.
   */
  toHex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Verify a signature using the default "substrate" context.
   *
   * @param signature - The 64-byte signature
   * @param message - The message that was signed
   * @returns true if the signature is valid
   */
  verify(signature: Uint8Array, message: Uint8Array): boolean {
    return this.verifyWithContext(signature, message, SR25519_DEFAULT_CONTEXT);
  }

  /**
   * Verify a signature using a custom context.
   *
   * Note: The @scure/sr25519 library uses a hardcoded "substrate" context.
   * Custom context is accepted for API compatibility but only signatures created
   * with "substrate" context will verify correctly.
   *
   * @param signature - The 64-byte signature
   * @param message - The message that was signed
   * @param context - The signing context (only "substrate" is supported)
   * @returns true if the signature is valid
   */
  verifyWithContext(signature: Uint8Array, message: Uint8Array, _context: Uint8Array): boolean {
    try {
      // Note: @scure/sr25519 verify() uses hardcoded "substrate" context
      // Arguments: verify(message, signature, publicKey)
      return sr25519.verify(message, signature, this._data);
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another Sr25519PublicKey.
   */
  equals(other: Sr25519PublicKey): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    const hex = bytesToHex(this._data);
    return `Sr25519PublicKey(${hex.substring(0, 16)}...)`;
  }
}
