/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * PBKDF2 (Password-Based Key Derivation Function 2) parameters
 *
 * PBKDF2 is a key derivation function defined in RFC 8018 (PKCS #5 v2.1).
 * It is suitable for password-based key derivation.
 *
 * CDDL:
 * ```cddl
 * PBKDF2Params = [1, Salt, iterations: uint, HashType]
 * ```
 *
 * Ported from bc-components-rust/src/encrypted_key/pbkdf2_params.rs
 */

import { type Cbor, cbor, expectArray, expectNumber, expectBytes } from "@bcts/dcbor";
import { pbkdf2HmacSha256, pbkdf2HmacSha512 } from "@bcts/crypto";

import { Salt } from "../salt.js";
import { Nonce } from "../nonce.js";
import { SymmetricKey } from "../symmetric/symmetric-key.js";
import { type EncryptedMessage } from "../symmetric/encrypted-message.js";
import { HashType, hashTypeToCbor, hashTypeFromCbor, hashTypeToString } from "./hash-type.js";
import { KeyDerivationMethod } from "./key-derivation-method.js";
import { SALT_LEN } from "./hkdf-params.js";
import type { KeyDerivation } from "./key-derivation.js";

/** Default number of iterations for PBKDF2 */
export const DEFAULT_PBKDF2_ITERATIONS = 100_000;

/**
 * PBKDF2 parameters for password-based key derivation.
 */
export class PBKDF2Params implements KeyDerivation {
  static readonly INDEX = KeyDerivationMethod.PBKDF2;

  private readonly _salt: Salt;
  private readonly _iterations: number;
  private readonly _hashType: HashType;

  private constructor(salt: Salt, iterations: number, hashType: HashType) {
    this._salt = salt;
    this._iterations = iterations;
    this._hashType = hashType;
  }

  /**
   * Create new PBKDF2 parameters with default settings.
   * Uses a random 16-byte salt, 100,000 iterations, and SHA-256.
   */
  static new(): PBKDF2Params {
    return PBKDF2Params.newOpt(
      Salt.newWithLen(SALT_LEN),
      DEFAULT_PBKDF2_ITERATIONS,
      HashType.SHA256,
    );
  }

  /**
   * Create PBKDF2 parameters with custom settings.
   */
  static newOpt(salt: Salt, iterations: number, hashType: HashType): PBKDF2Params {
    return new PBKDF2Params(salt, iterations, hashType);
  }

  /** Returns the salt. */
  salt(): Salt {
    return this._salt;
  }

  /** Returns the number of iterations. */
  iterations(): number {
    return this._iterations;
  }

  /** Returns the hash type. */
  hashType(): HashType {
    return this._hashType;
  }

  /** Returns the method index for CBOR encoding. */
  index(): number {
    return PBKDF2Params.INDEX;
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
    switch (this._hashType) {
      case HashType.SHA256:
        return pbkdf2HmacSha256(secret, this._salt.asBytes(), this._iterations, 32);
      case HashType.SHA512:
        return pbkdf2HmacSha512(secret, this._salt.asBytes(), this._iterations, 32);
      default:
        throw new Error(`Unknown hash type: ${String(this._hashType)}`);
    }
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `PBKDF2(${hashTypeToString(this._hashType)})`;
  }

  /**
   * Check equality with another PBKDF2Params.
   */
  equals(other: PBKDF2Params): boolean {
    return (
      this._salt.equals(other._salt) &&
      this._iterations === other._iterations &&
      this._hashType === other._hashType
    );
  }

  // ============================================================================
  // CBOR Serialization
  // ============================================================================

  /**
   * Convert to CBOR.
   * Format: [1, Salt, iterations, HashType]
   */
  toCbor(): Cbor {
    return cbor([
      cbor(PBKDF2Params.INDEX),
      this._salt.untaggedCbor(),
      cbor(this._iterations),
      hashTypeToCbor(this._hashType),
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
  static fromCbor(cborValue: Cbor): PBKDF2Params {
    const array = expectArray(cborValue);

    if (array.length !== 4) {
      throw new Error(`Invalid PBKDF2Params: expected 4 elements, got ${array.length}`);
    }

    const index = expectNumber(array[0]);
    if (index !== PBKDF2Params.INDEX) {
      throw new Error(`Invalid PBKDF2Params index: expected ${PBKDF2Params.INDEX}, got ${index}`);
    }

    const saltData = expectBytes(array[1]);
    const salt = Salt.fromData(saltData);
    const iterations = Number(expectNumber(array[2]));
    const hashType = hashTypeFromCbor(array[3]);

    return new PBKDF2Params(salt, iterations, hashType);
  }
}
