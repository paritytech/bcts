/**
 * Encrypted message with ChaCha20-Poly1305 AEAD (nonce + ciphertext + authentication tag)
 */

import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { CryptoError } from './error.js';
import { SymmetricKey } from './symmetric-key.js';
import { Nonce } from './nonce.js';
import { AuthenticationTag } from './authentication-tag.js';

export class EncryptedMessage {
  private nonce: Nonce;
  private ciphertext: Uint8Array;
  private tag: AuthenticationTag;

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
    associatedData?: Uint8Array
  ): EncryptedMessage {
    try {
      // Generate random nonce if not provided
      if (!nonce) {
        nonce = Nonce.random();
      }

      // Create cipher
      const cipher = chacha20poly1305(key.toData());

      // Encrypt with optional associated data
      const ciphertext = cipher.encrypt(nonce.toData(), plaintext, associatedData);

      // The last 16 bytes are the authentication tag
      if (ciphertext.length < 16) {
        throw new Error('Ciphertext too short');
      }

      const tag = new AuthenticationTag(ciphertext.slice(ciphertext.length - 16));
      const actualCiphertext = ciphertext.slice(0, ciphertext.length - 16);

      return new EncryptedMessage(nonce, actualCiphertext, tag);
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
    associatedData?: Uint8Array
  ): Uint8Array {
    try {
      // Create cipher
      const cipher = chacha20poly1305(key.toData());

      // Combine ciphertext and tag
      const ciphertextWithTag = new Uint8Array(encrypted.ciphertext.length + 16);
      ciphertextWithTag.set(encrypted.ciphertext);
      ciphertextWithTag.set(encrypted.tag.toData(), encrypted.ciphertext.length);

      // Decrypt
      const plaintext = cipher.decrypt(encrypted.nonce.toData(), ciphertextWithTag, associatedData);
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
    const combined = new Uint8Array(this.ciphertext.length + 16);
    combined.set(this.ciphertext);
    combined.set(this.tag.toData(), this.ciphertext.length);
    return combined;
  }

  /**
   * Get hex string representation
   */
  toHex(): string {
    const data = this.toData();
    return Array.from(data)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  /**
   * Get total size (nonce + ciphertext + tag)
   */
  size(): number {
    return 12 + this.ciphertext.length + 16;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `EncryptedMessage(${this.toHex().substring(0, 16)}..., ${this.size()} bytes)`;
  }
}
