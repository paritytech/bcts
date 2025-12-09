/**
 * HKDF (HMAC-based Key Derivation Function) parameters
 *
 * HKDF is a key derivation function based on HMAC, defined in RFC 5869.
 * It is NOT suitable for password-based key derivation (use PBKDF2, Scrypt,
 * or Argon2id instead).
 *
 * CDDL:
 * ```cddl
 * HKDFParams = [0, Salt, HashType]
 * ```
 *
 * Ported from bc-components-rust/src/encrypted_key/hkdf_params.rs
 */

import {
  type Cbor,
  cbor,
  expectArray,
  expectNumber,
  expectBytes,
} from "@blockchain-commons/dcbor";
import {
  hkdfHmacSha256,
  hkdfHmacSha512,
} from "@blockchain-commons/crypto";

import { Salt } from "../salt.js";
import { Nonce } from "../nonce.js";
import { SymmetricKey } from "../symmetric/symmetric-key.js";
import { EncryptedMessage } from "../symmetric/encrypted-message.js";
import { HashType, hashTypeToCbor, hashTypeFromCbor, hashTypeToString } from "./hash-type.js";
import { KeyDerivationMethod } from "./key-derivation-method.js";
import type { KeyDerivation } from "./key-derivation.js";

/** Default salt length for key derivation */
export const SALT_LEN = 16;

/**
 * HKDF parameters for key derivation.
 *
 * HKDF is suitable for deriving keys from high-entropy inputs (like other keys),
 * but NOT for password-based key derivation.
 */
export class HKDFParams implements KeyDerivation {
  static readonly INDEX = KeyDerivationMethod.HKDF;

  private readonly _salt: Salt;
  private readonly _hashType: HashType;

  private constructor(salt: Salt, hashType: HashType) {
    this._salt = salt;
    this._hashType = hashType;
  }

  /**
   * Create new HKDF parameters with default settings.
   * Uses a random 16-byte salt and SHA-256.
   */
  static new(): HKDFParams {
    return HKDFParams.newOpt(Salt.newWithLen(SALT_LEN), HashType.SHA256);
  }

  /**
   * Create HKDF parameters with custom settings.
   */
  static newOpt(salt: Salt, hashType: HashType): HKDFParams {
    return new HKDFParams(salt, hashType);
  }

  /** Returns the salt. */
  salt(): Salt {
    return this._salt;
  }

  /** Returns the hash type. */
  hashType(): HashType {
    return this._hashType;
  }

  /** Returns the method index for CBOR encoding. */
  index(): number {
    return HKDFParams.INDEX;
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
        return hkdfHmacSha256(secret, this._salt.data(), 32);
      case HashType.SHA512:
        return hkdfHmacSha512(secret, this._salt.data(), 32);
      default:
        throw new Error(`Unknown hash type: ${this._hashType}`);
    }
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `HKDF(${hashTypeToString(this._hashType)})`;
  }

  /**
   * Check equality with another HKDFParams.
   */
  equals(other: HKDFParams): boolean {
    return this._salt.equals(other._salt) && this._hashType === other._hashType;
  }

  // ============================================================================
  // CBOR Serialization
  // ============================================================================

  /**
   * Convert to CBOR.
   * Format: [0, Salt, HashType]
   */
  toCbor(): Cbor {
    return cbor([
      cbor(HKDFParams.INDEX),
      this._salt.untaggedCbor(),
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
  static fromCbor(cborValue: Cbor): HKDFParams {
    const array = expectArray(cborValue);

    if (array.length !== 3) {
      throw new Error(`Invalid HKDFParams: expected 3 elements, got ${array.length}`);
    }

    const index = expectNumber(array[0]);
    if (index !== HKDFParams.INDEX) {
      throw new Error(`Invalid HKDFParams index: expected ${HKDFParams.INDEX}, got ${index}`);
    }

    const saltData = expectBytes(array[1]);
    const salt = Salt.fromData(saltData);
    const hashType = hashTypeFromCbor(array[2]);

    return new HKDFParams(salt, hashType);
  }
}
