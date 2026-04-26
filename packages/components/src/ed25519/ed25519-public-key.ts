/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Ed25519 public key for EdDSA signature verification (32 bytes)
 * Ported from bc-components-rust/src/ed25519/ed25519_public_key.rs
 */

import { ED25519_PUBLIC_KEY_SIZE, ED25519_SIGNATURE_SIZE, ed25519Verify } from "@bcts/crypto";
import { Digest } from "../digest.js";
import { CryptoError } from "../error.js";
import { bytesToHex, hexToBytes, toBase64 } from "../utils.js";

export class Ed25519PublicKey {
  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(ED25519_PUBLIC_KEY_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  /**
   * Create an Ed25519PublicKey from raw bytes (32 bytes).
   */
  static from(data: Uint8Array): Ed25519PublicKey {
    return new Ed25519PublicKey(data);
  }

  /**
   * Mirror of Rust `Ed25519PublicKey::from_data` — exact-length copy.
   */
  static fromData(data: Uint8Array): Ed25519PublicKey {
    return new Ed25519PublicKey(data);
  }

  /**
   * Mirror of Rust `Ed25519PublicKey::from_data_ref` — validates length.
   */
  static fromDataRef(data: Uint8Array): Ed25519PublicKey {
    if (data.length !== ED25519_PUBLIC_KEY_SIZE) {
      throw CryptoError.invalidSize(ED25519_PUBLIC_KEY_SIZE, data.length);
    }
    return new Ed25519PublicKey(data);
  }

  /**
   * Create an Ed25519PublicKey from hex string.
   */
  static fromHex(hex: string): Ed25519PublicKey {
    return new Ed25519PublicKey(hexToBytes(hex));
  }

  /** Returns the 32 raw public key bytes (copy). */
  data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /** Alias of {@link data}. */
  asBytes(): Uint8Array {
    return this.data();
  }

  /** Backwards-compatible alias of {@link data}. */
  toData(): Uint8Array {
    return this.data();
  }

  /**
   * Get hex string representation
   */
  toHex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Verify a signature using Ed25519
   */
  verify(message: Uint8Array, signature: Uint8Array): boolean {
    try {
      if (signature.length !== ED25519_SIGNATURE_SIZE) {
        throw CryptoError.invalidSize(ED25519_SIGNATURE_SIZE, signature.length);
      }
      return ed25519Verify(this._data, message, signature);
    } catch (e) {
      throw CryptoError.cryptoOperation(`Ed25519 verification failed: ${String(e)}`);
    }
  }

  /**
   * Compare with another Ed25519PublicKey
   */
  equals(other: Ed25519PublicKey): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation.
   *
   * Mirrors Rust `Display for Ed25519PublicKey`
   * (`bc-components-rust/src/ed25519/ed25519_public_key.rs`):
   *   `Ed25519PublicKey(<ref_hex_short>)`
   * where the reference is computed from the **raw 32-byte data**
   * (not tagged CBOR) — same pattern as SchnorrPublicKey.
   */
  toString(): string {
    const digest = Digest.fromImage(this._data);
    return `Ed25519PublicKey(${digest.shortDescription()})`;
  }
}
