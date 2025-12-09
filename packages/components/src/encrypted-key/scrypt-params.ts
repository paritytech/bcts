/**
 * Scrypt parameters for password-based key derivation
 *
 * Scrypt is a memory-hard key derivation function defined in RFC 7914.
 * It is suitable for password-based key derivation and is more resistant
 * to hardware brute-force attacks than PBKDF2.
 *
 * CDDL:
 * ```cddl
 * ScryptParams = [2, Salt, log_n: uint, r: uint, p: uint]
 * ```
 *
 * Ported from bc-components-rust/src/encrypted_key/scrypt_params.rs
 */

import {
  type Cbor,
  cbor,
  expectArray,
  expectNumber,
  expectBytes,
} from "@blockchain-commons/dcbor";
import { scryptOpt } from "@blockchain-commons/crypto";

import { Salt } from "../salt.js";
import { Nonce } from "../nonce.js";
import { SymmetricKey } from "../symmetric/symmetric-key.js";
import { EncryptedMessage } from "../symmetric/encrypted-message.js";
import { KeyDerivationMethod } from "./key-derivation-method.js";
import { SALT_LEN } from "./hkdf-params.js";
import type { KeyDerivation } from "./key-derivation.js";

/** Default log_n parameter (2^15 = 32768 iterations) */
export const DEFAULT_SCRYPT_LOG_N = 15;
/** Default r parameter (block size) */
export const DEFAULT_SCRYPT_R = 8;
/** Default p parameter (parallelism) */
export const DEFAULT_SCRYPT_P = 1;

/**
 * Scrypt parameters for password-based key derivation.
 *
 * Parameters:
 * - log_n: CPU/memory cost parameter (N = 2^log_n)
 * - r: Block size parameter
 * - p: Parallelization parameter
 */
export class ScryptParams implements KeyDerivation {
  static readonly INDEX = KeyDerivationMethod.Scrypt;

  private readonly _salt: Salt;
  private readonly _logN: number;
  private readonly _r: number;
  private readonly _p: number;

  private constructor(salt: Salt, logN: number, r: number, p: number) {
    this._salt = salt;
    this._logN = logN;
    this._r = r;
    this._p = p;
  }

  /**
   * Create new Scrypt parameters with default settings.
   * Uses a random 16-byte salt, log_n=15, r=8, p=1.
   */
  static new(): ScryptParams {
    return ScryptParams.newOpt(
      Salt.newWithLen(SALT_LEN),
      DEFAULT_SCRYPT_LOG_N,
      DEFAULT_SCRYPT_R,
      DEFAULT_SCRYPT_P,
    );
  }

  /**
   * Create Scrypt parameters with custom settings.
   */
  static newOpt(salt: Salt, logN: number, r: number, p: number): ScryptParams {
    return new ScryptParams(salt, logN, r, p);
  }

  /** Returns the salt. */
  salt(): Salt {
    return this._salt;
  }

  /** Returns the log_n parameter. */
  logN(): number {
    return this._logN;
  }

  /** Returns the r parameter (block size). */
  r(): number {
    return this._r;
  }

  /** Returns the p parameter (parallelism). */
  p(): number {
    return this._p;
  }

  /** Returns the method index for CBOR encoding. */
  index(): number {
    return ScryptParams.INDEX;
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
    return scryptOpt(secret, this._salt.data(), 32, this._logN, this._r, this._p);
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return "Scrypt";
  }

  /**
   * Check equality with another ScryptParams.
   */
  equals(other: ScryptParams): boolean {
    return (
      this._salt.equals(other._salt) &&
      this._logN === other._logN &&
      this._r === other._r &&
      this._p === other._p
    );
  }

  // ============================================================================
  // CBOR Serialization
  // ============================================================================

  /**
   * Convert to CBOR.
   * Format: [2, Salt, log_n, r, p]
   */
  toCbor(): Cbor {
    return cbor([
      cbor(ScryptParams.INDEX),
      this._salt.untaggedCbor(),
      cbor(this._logN),
      cbor(this._r),
      cbor(this._p),
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
  static fromCbor(cborValue: Cbor): ScryptParams {
    const array = expectArray(cborValue);

    if (array.length !== 5) {
      throw new Error(`Invalid ScryptParams: expected 5 elements, got ${array.length}`);
    }

    const index = expectNumber(array[0]);
    if (index !== ScryptParams.INDEX) {
      throw new Error(`Invalid ScryptParams index: expected ${ScryptParams.INDEX}, got ${index}`);
    }

    const saltData = expectBytes(array[1]);
    const salt = Salt.fromData(saltData);
    const logN = expectNumber(array[2]);
    const r = expectNumber(array[3]);
    const p = expectNumber(array[4]);

    return new ScryptParams(salt, logN, r, p);
  }
}
