/**
 * Encrypted message with ChaCha20-Poly1305 AEAD (nonce + ciphertext + authentication tag)
 * Ported from bc-components-rust/src/encrypted.rs
 */

import {
  aeadChaCha20Poly1305EncryptWithAad,
  aeadChaCha20Poly1305DecryptWithAad,
  SYMMETRIC_AUTH_SIZE,
} from "@blockchain-commons/crypto";
import { CryptoError } from "./error.js";
import { SymmetricKey } from "./symmetric-key.js";
import { Nonce } from "./nonce.js";
import { AuthenticationTag } from "./authentication-tag.js";
import { bytesToHex } from "./utils.js";

export class EncryptedMessage {
  private readonly nonce: Nonce;
  private readonly ciphertext: Uint8Array;
  private readonly tag: AuthenticationTag;

  private constructor(nonce: Nonce, ciphertext: Uint8Array, tag: AuthenticationTag) {
    this.nonce = nonce;
    this.ciphertext = new Uint8Array(ciphertext);
    this.tag = tag;
  }

  /**
   * Create an EncryptedMessage from components
   */
  static from(nonce: Nonce, ciphertext: Uint8Array, tag: AuthenticationTag): EncryptedMessage {
    return new EncryptedMessage(nonce, ciphertext, tag);
  }

  /**
   * Encrypt a message using ChaCha20-Poly1305
   */
  static encrypt(
    plaintext: Uint8Array,
    key: SymmetricKey,
    nonce?: Nonce,
    associatedData?: Uint8Array,
  ): EncryptedMessage {
    try {
      // Generate random nonce if not provided
      if (!nonce) {
        nonce = Nonce.random();
      }

      // Encrypt using crypto package - returns [ciphertext, authTag] tuple
      const [ciphertextData, authTagData] = aeadChaCha20Poly1305EncryptWithAad(
        plaintext,
        key.toData(),
        nonce.toData(),
        associatedData ?? new Uint8Array(0),
      );

      return new EncryptedMessage(nonce, ciphertextData, AuthenticationTag.from(authTagData));
    } catch (e) {
      throw CryptoError.cryptoOperation(`ChaCha20-Poly1305 encryption failed: ${e}`);
    }
  }

  /**
   * Decrypt a message using ChaCha20-Poly1305
   */
  static decrypt(
    encrypted: EncryptedMessage,
    key: SymmetricKey,
    associatedData?: Uint8Array,
  ): Uint8Array {
    try {
      // Decrypt using crypto package
      const plaintext = aeadChaCha20Poly1305DecryptWithAad(
        encrypted.ciphertext,
        key.toData(),
        encrypted.nonce.toData(),
        associatedData ?? new Uint8Array(0),
        encrypted.tag.toData(),
      );

      return new Uint8Array(plaintext);
    } catch (e) {
      throw CryptoError.cryptoOperation(`ChaCha20-Poly1305 decryption failed: ${e}`);
    }
  }

  /**
   * Get the nonce
   */
  getNonce(): Nonce {
    return this.nonce;
  }

  /**
   * Get the ciphertext
   */
  getCiphertext(): Uint8Array {
    return new Uint8Array(this.ciphertext);
  }

  /**
   * Get the authentication tag
   */
  getTag(): AuthenticationTag {
    return this.tag;
  }

  /**
   * Get combined ciphertext + tag
   */
  toData(): Uint8Array {
    const combined = new Uint8Array(this.ciphertext.length + SYMMETRIC_AUTH_SIZE);
    combined.set(this.ciphertext);
    combined.set(this.tag.toData(), this.ciphertext.length);
    return combined;
  }

  /**
   * Get hex string representation
   */
  toHex(): string {
    return bytesToHex(this.toData());
  }

  /**
   * Get total size (nonce + ciphertext + tag)
   */
  size(): number {
    return 12 + this.ciphertext.length + SYMMETRIC_AUTH_SIZE;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `EncryptedMessage(${this.toHex().substring(0, 16)}..., ${this.size()} bytes)`;
  }
}
