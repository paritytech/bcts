/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Encrypted key for secure symmetric key storage
 *
 * `EncryptedKey` provides symmetric encryption and decryption of content keys
 * using various key derivation methods (HKDF, PBKDF2, Scrypt, Argon2id).
 *
 * The form of an `EncryptedKey` is an `EncryptedMessage` that contains the
 * encrypted content key, with its Additional Authenticated Data (AAD) being
 * the CBOR encoding of the key derivation method and parameters.
 *
 * CDDL:
 * ```cddl
 * EncryptedKey = #6.40027(EncryptedMessage)
 *
 * EncryptedMessage =
 *     #6.40002([ ciphertext: bstr, nonce: bstr, auth: bstr, aad: bstr .cbor KeyDerivation ])
 *
 * KeyDerivation = HKDFParams / PBKDF2Params / ScryptParams / Argon2idParams
 * ```
 *
 * Ported from bc-components-rust/src/encrypted_key/encrypted_key_impl.rs
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  createTaggedCbor,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
  validateTag,
} from "@bcts/dcbor";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { ENCRYPTED_KEY as TAG_ENCRYPTED_KEY } from "@bcts/tags";

import { type SymmetricKey } from "../symmetric/symmetric-key.js";
import { EncryptedMessage } from "../symmetric/encrypted-message.js";
import { CryptoError } from "../error.js";
import { KeyDerivationMethod } from "./key-derivation-method.js";
import {
  type KeyDerivationParams,
  hkdfParams,
  pbkdf2Params,
  scryptParams,
  argon2idParams,
  keyDerivationParamsMethod,
  keyDerivationParamsToString,
  keyDerivationParamsFromCbor,
  lockWithParams,
  isPasswordBased,
  isSshAgent,
} from "./key-derivation-params.js";

/**
 * Encrypted key providing secure storage of symmetric keys.
 *
 * Use `lock()` to encrypt a content key with a password or secret,
 * and `unlock()` to decrypt it.
 */
export class EncryptedKey
  implements CborTaggedEncodable, CborTaggedDecodable<EncryptedKey>, UREncodable
{
  private readonly _params: KeyDerivationParams;
  private readonly _encryptedMessage: EncryptedMessage;

  private constructor(params: KeyDerivationParams, encryptedMessage: EncryptedMessage) {
    this._params = params;
    this._encryptedMessage = encryptedMessage;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Lock (encrypt) a content key using custom derivation parameters.
   *
   * @param params - The key derivation parameters to use
   * @param secret - The secret (password or key material) to derive from
   * @param contentKey - The symmetric key to encrypt
   * @returns The encrypted key
   */
  static lockOpt(
    params: KeyDerivationParams,
    secret: Uint8Array,
    contentKey: SymmetricKey,
  ): EncryptedKey {
    const encryptedMessage = lockWithParams(params, contentKey, secret);
    return new EncryptedKey(params, encryptedMessage);
  }

  /**
   * Lock (encrypt) a content key using a specific derivation method with defaults.
   *
   * @param method - The key derivation method to use
   * @param secret - The secret (password or key material) to derive from
   * @param contentKey - The symmetric key to encrypt
   * @returns The encrypted key
   */
  static lock(
    method: KeyDerivationMethod,
    secret: Uint8Array,
    contentKey: SymmetricKey,
  ): EncryptedKey {
    let params: KeyDerivationParams;

    switch (method) {
      case KeyDerivationMethod.HKDF:
        params = hkdfParams();
        break;
      case KeyDerivationMethod.PBKDF2:
        params = pbkdf2Params();
        break;
      case KeyDerivationMethod.Scrypt:
        params = scryptParams();
        break;
      case KeyDerivationMethod.Argon2id:
        params = argon2idParams();
        break;
      case KeyDerivationMethod.SSHAgent:
        throw new Error(
          "SSH Agent key derivation cannot be used with lock() - use lockOpt() with sshAgentParams() instead",
        );
    }

    return EncryptedKey.lockOpt(params, secret, contentKey);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Returns the encrypted message.
   */
  encryptedMessage(): EncryptedMessage {
    return this._encryptedMessage;
  }

  /**
   * Returns the key derivation parameters.
   */
  params(): KeyDerivationParams {
    return this._params;
  }

  /**
   * Returns the key derivation method.
   */
  method(): KeyDerivationMethod {
    return keyDerivationParamsMethod(this._params);
  }

  /**
   * Check if this uses a password-based key derivation method.
   */
  isPasswordBased(): boolean {
    return isPasswordBased(this._params);
  }

  /**
   * Check if this uses SSH Agent for key derivation.
   *
   * Note: SSH Agent key derivation is not yet functional in TypeScript.
   * This method is useful for detecting envelopes locked by other
   * implementations (e.g., Rust).
   */
  isSshAgent(): boolean {
    return isSshAgent(this._params);
  }

  /**
   * Unlock (decrypt) the content key.
   *
   * @param secret - The secret (password or key material) used to lock
   * @returns The decrypted symmetric key
   * @throws CryptoError if decryption fails (wrong password, tampered data, etc.)
   */
  unlock(secret: Uint8Array): SymmetricKey {
    // Get the AAD from the encrypted message, which contains the derivation params
    const aad = this._encryptedMessage.aad();
    if (aad.length === 0) {
      throw CryptoError.invalidData("Missing AAD in EncryptedKey");
    }

    // Parse the derivation parameters from AAD
    const paramsCbor = decodeCbor(aad);
    const params = keyDerivationParamsFromCbor(paramsCbor);

    // Unlock using the parsed parameters
    switch (params.type) {
      case "hkdf":
        return params.params.unlock(this._encryptedMessage, secret);
      case "pbkdf2":
        return params.params.unlock(this._encryptedMessage, secret);
      case "scrypt":
        return params.params.unlock(this._encryptedMessage, secret);
      case "argon2id":
        return params.params.unlock(this._encryptedMessage, secret);
      case "sshagent":
        return params.params.unlock(this._encryptedMessage, secret);
    }
  }

  /**
   * Check equality with another EncryptedKey.
   */
  equals(other: EncryptedKey): boolean {
    return this._encryptedMessage.equals(other._encryptedMessage);
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `EncryptedKey(${keyDerivationParamsToString(this._params)})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with EncryptedKey.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_ENCRYPTED_KEY.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   * The EncryptedMessage is encoded with its own tag (40002).
   */
  untaggedCbor(): Cbor {
    return this._encryptedMessage.taggedCbor();
  }

  /**
   * Returns the tagged CBOR encoding.
   */
  taggedCbor(): Cbor {
    return createTaggedCbor(this);
  }

  /**
   * Returns the tagged value in CBOR binary representation.
   */
  taggedCborData(): Uint8Array {
    return this.taggedCbor().toData();
  }

  // ============================================================================
  // CBOR Deserialization (CborTaggedDecodable)
  // ============================================================================

  /**
   * Creates an EncryptedKey by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): EncryptedKey {
    // The untagged content is a tagged EncryptedMessage
    const encryptedMessage = EncryptedMessage.fromTaggedCbor(cborValue);

    // Parse the derivation parameters from AAD
    const aad = encryptedMessage.aad();
    if (aad.length === 0) {
      throw CryptoError.invalidData("Missing AAD in EncryptedKey");
    }
    const paramsCbor = decodeCbor(aad);
    const params = keyDerivationParamsFromCbor(paramsCbor);

    return new EncryptedKey(params, encryptedMessage);
  }

  /**
   * Creates an EncryptedKey by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): EncryptedKey {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): EncryptedKey {
    // Create a dummy instance for the method
    const dummyParams = hkdfParams();
    const dummyMessage = EncryptedMessage.new(
      new Uint8Array(32),
      new Uint8Array(0),
      // @ts-expect-error - Using internal method for dummy
      { data: () => new Uint8Array(12) },
      new Uint8Array(16),
    );
    const dummy = new EncryptedKey(dummyParams, dummyMessage);
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): EncryptedKey {
    const cborValue = decodeCbor(data);
    return EncryptedKey.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): EncryptedKey {
    const cborValue = decodeCbor(data);
    const dummyParams = hkdfParams();
    const dummyMessage = EncryptedMessage.new(
      new Uint8Array(32),
      new Uint8Array(0),
      // @ts-expect-error - Using internal method for dummy
      { data: () => new Uint8Array(12) },
      new Uint8Array(16),
    );
    const dummy = new EncryptedKey(dummyParams, dummyMessage);
    return dummy.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation.
   */
  ur(): UR {
    const name = TAG_ENCRYPTED_KEY.name;
    if (name === undefined) {
      throw new Error("TAG_ENCRYPTED_KEY.name is undefined");
    }
    return UR.new(name, this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates an EncryptedKey from a UR.
   */
  static fromUR(ur: UR): EncryptedKey {
    const name = TAG_ENCRYPTED_KEY.name;
    if (name === undefined) {
      throw new Error("TAG_ENCRYPTED_KEY.name is undefined");
    }
    ur.checkType(name);
    return EncryptedKey.fromUntaggedCborData(ur.cbor().toData());
  }

  /**
   * Creates an EncryptedKey from a UR string.
   */
  static fromURString(urString: string): EncryptedKey {
    const ur = UR.fromURString(urString);
    return EncryptedKey.fromUR(ur);
  }
}
