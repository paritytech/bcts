/**
 * Argon2id parameters for password-based key derivation
 *
 * Argon2id is a memory-hard key derivation function defined in RFC 9106.
 * It combines Argon2i (resistant to side-channel attacks) and Argon2d
 * (resistant to GPU cracking attacks). It is the recommended choice for
 * password-based key derivation.
 *
 * CDDL:
 * ```cddl
 * Argon2idParams = [3, Salt]
 * ```
 *
 * Note: Argon2id uses sensible defaults for memory, iterations, and parallelism.
 * Only the salt is configurable in the CBOR encoding for simplicity.
 *
 * Ported from bc-components-rust/src/encrypted_key/argon2id_params.rs
 */

import {
  type Cbor,
  cbor,
  expectArray,
  expectNumber,
  expectBytes,
} from "@blockchain-commons/dcbor";
import { argon2idHash } from "@blockchain-commons/crypto";

import { Salt } from "../salt.js";
import { Nonce } from "../nonce.js";
import { SymmetricKey } from "../symmetric/symmetric-key.js";
import { EncryptedMessage } from "../symmetric/encrypted-message.js";
import { KeyDerivationMethod } from "./key-derivation-method.js";
import { SALT_LEN } from "./hkdf-params.js";
import type { KeyDerivation } from "./key-derivation.js";

/**
 * Argon2id parameters for password-based key derivation.
 *
 * This is the recommended method for password-based key derivation as it
 * provides the best protection against both GPU cracking and side-channel
 * attacks.
 */
export class Argon2idParams implements KeyDerivation {
  static readonly INDEX = KeyDerivationMethod.Argon2id;

  private readonly _salt: Salt;

  private constructor(salt: Salt) {
    this._salt = salt;
  }

  /**
   * Create new Argon2id parameters with default settings.
   * Uses a random 16-byte salt.
   */
  static new(): Argon2idParams {
    return Argon2idParams.newOpt(Salt.newWithLen(SALT_LEN));
  }

  /**
   * Create Argon2id parameters with a custom salt.
   */
  static newOpt(salt: Salt): Argon2idParams {
    return new Argon2idParams(salt);
  }

  /** Returns the salt. */
  salt(): Salt {
    return this._salt;
  }

  /** Returns the method index for CBOR encoding. */
  index(): number {
    return Argon2idParams.INDEX;
  }

  /**
   * Derive a key from the secret and encrypt the content key.
   */
  lock(contentKey: SymmetricKey, secret: Uint8Array): EncryptedMessage {
    const derivedKeyData = this._deriveKey(secret);
    const derivedKey = SymmetricKey.fromData(derivedKeyData);

    // Encode the method parameters as AAD
    const encodedMethod = this.toCbor().toData();

    // Encrypt the content key using the derived key
    return derivedKey.encrypt(contentKey.data(), encodedMethod, Nonce.new());
  }

  /**
   * Derive a key from the secret and decrypt the content key.
   */
  unlock(encryptedMessage: EncryptedMessage, secret: Uint8Array): SymmetricKey {
    const derivedKeyData = this._deriveKey(secret);
    const derivedKey = SymmetricKey.fromData(derivedKeyData);

    // Decrypt to get the content key
    const contentKeyData = derivedKey.decrypt(encryptedMessage);
    return SymmetricKey.fromData(contentKeyData);
  }

  private _deriveKey(secret: Uint8Array): Uint8Array {
    return argon2idHash(secret, this._salt.data(), 32);
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return "Argon2id";
  }

  /**
   * Check equality with another Argon2idParams.
   */
  equals(other: Argon2idParams): boolean {
    return this._salt.equals(other._salt);
  }

  // ============================================================================
  // CBOR Serialization
  // ============================================================================

  /**
   * Convert to CBOR.
   * Format: [3, Salt]
   */
  toCbor(): Cbor {
    return cbor([
      cbor(Argon2idParams.INDEX),
      this._salt.untaggedCbor(),
    ]);
  }

  /**
   * Convert to CBOR binary data.
   */
  toCborData(): Uint8Array {
    return this.toCbor().toData();
  }

  /**
   * Parse from CBOR.
   */
  static fromCbor(cborValue: Cbor): Argon2idParams {
    const array = expectArray(cborValue);

    if (array.length !== 2) {
      throw new Error(`Invalid Argon2idParams: expected 2 elements, got ${array.length}`);
    }

    const index = expectNumber(array[0]);
    if (index !== Argon2idParams.INDEX) {
      throw new Error(`Invalid Argon2idParams index: expected ${Argon2idParams.INDEX}, got ${index}`);
    }

    const saltData = expectBytes(array[1]);
    const salt = Salt.fromData(saltData);

    return new Argon2idParams(salt);
  }
}
