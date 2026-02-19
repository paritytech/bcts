/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * SSH Agent key derivation parameters
 *
 * SSH Agent uses an SSH agent daemon for key derivation. The agent signs
 * a challenge derived from the salt to produce the encryption key.
 *
 * CDDL:
 * ```cddl
 * SSHAgentParams = [4, Salt, id: tstr]
 * ```
 *
 * Ported from bc-components-rust/src/encrypted_key/ssh_agent_params.rs
 */

import { type Cbor, cbor, expectArray, expectNumber, expectBytes, expectText } from "@bcts/dcbor";

import { Salt } from "../salt.js";
import type { SymmetricKey } from "../symmetric/symmetric-key.js";
import type { EncryptedMessage } from "../symmetric/encrypted-message.js";
import { KeyDerivationMethod } from "./key-derivation-method.js";
import type { KeyDerivation } from "./key-derivation.js";
import { CryptoError } from "../error.js";

/** Default salt length for SSH agent key derivation */
export const SALT_LEN = 16;

/**
 * SSH Agent parameters for key derivation.
 *
 * This method uses an SSH agent daemon to derive encryption keys.
 * The agent signs a challenge derived from the salt using the specified
 * SSH key identity, and the signature is used to derive the encryption key.
 *
 * **Note:** SSH agent communication requires platform-specific support and
 * may not be available in all JavaScript environments. The lock/unlock
 * methods will throw an error if SSH agent support is not available.
 */
export class SSHAgentParams implements KeyDerivation {
  static readonly INDEX = KeyDerivationMethod.SSHAgent;

  private readonly _salt: Salt;
  private readonly _id: string;

  private constructor(salt: Salt, id: string) {
    this._salt = salt;
    this._id = id;
  }

  /**
   * Create new SSH agent parameters with default salt and specified key ID.
   *
   * @param id - The SSH key identity (usually the key comment or public key fingerprint)
   */
  static new(id: string): SSHAgentParams {
    return SSHAgentParams.newOpt(Salt.newWithLen(SALT_LEN), id);
  }

  /**
   * Create SSH agent parameters with custom salt and key ID.
   *
   * @param salt - The salt for key derivation
   * @param id - The SSH key identity
   */
  static newOpt(salt: Salt, id: string): SSHAgentParams {
    return new SSHAgentParams(salt, id);
  }

  /** Returns the salt. */
  salt(): Salt {
    return this._salt;
  }

  /** Returns the SSH key identity. */
  id(): string {
    return this._id;
  }

  /** Returns the method index for CBOR encoding. */
  index(): number {
    return SSHAgentParams.INDEX;
  }

  /**
   * Derive a key using SSH agent and encrypt the content key.
   *
   * **Note:** This method requires SSH agent support which is not yet
   * implemented in this TypeScript port. Use an alternative key derivation
   * method or implement SSH agent communication for your environment.
   *
   * @throws CryptoError - SSH agent support is not available
   */
  lock(_contentKey: SymmetricKey, _secret: Uint8Array): EncryptedMessage {
    throw CryptoError.sshAgent(
      "SSH agent key derivation is not yet implemented in this TypeScript port. " +
        "Use HKDF, PBKDF2, Scrypt, or Argon2id instead.",
    );
  }

  /**
   * Derive a key using SSH agent and decrypt the content key.
   *
   * **Note:** This method requires SSH agent support which is not yet
   * implemented in this TypeScript port. Use an alternative key derivation
   * method or implement SSH agent communication for your environment.
   *
   * @throws CryptoError - SSH agent support is not available
   */
  unlock(_encryptedMessage: EncryptedMessage, _secret: Uint8Array): SymmetricKey {
    throw CryptoError.sshAgent(
      "SSH agent key derivation is not yet implemented in this TypeScript port. " +
        "Use HKDF, PBKDF2, Scrypt, or Argon2id instead.",
    );
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `SSHAgent(id: "${this._id}")`;
  }

  /**
   * Check equality with another SSHAgentParams.
   */
  equals(other: SSHAgentParams): boolean {
    return this._salt.equals(other._salt) && this._id === other._id;
  }

  // ============================================================================
  // CBOR Serialization
  // ============================================================================

  /**
   * Convert to CBOR.
   * Format: [4, Salt, id: tstr]
   */
  toCbor(): Cbor {
    return cbor([cbor(SSHAgentParams.INDEX), this._salt.untaggedCbor(), cbor(this._id)]);
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
  static fromCbor(cborValue: Cbor): SSHAgentParams {
    const array = expectArray(cborValue);

    if (array.length !== 3) {
      throw new Error(`Invalid SSHAgentParams: expected 3 elements, got ${array.length}`);
    }

    const index = expectNumber(array[0]);
    if (index !== SSHAgentParams.INDEX) {
      throw new Error(
        `Invalid SSHAgentParams index: expected ${SSHAgentParams.INDEX}, got ${index}`,
      );
    }

    const saltData = expectBytes(array[1]);
    const salt = Salt.fromData(saltData);
    const id = expectText(array[2]);

    return new SSHAgentParams(salt, id);
  }
}
