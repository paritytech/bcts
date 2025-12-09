// Ported from bc-crypto-rust/src/symmetric_encryption.rs

import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { CryptoError, AeadError } from "./error.js";

// Constants
export const SYMMETRIC_KEY_SIZE = 32;
export const SYMMETRIC_NONCE_SIZE = 12;
export const SYMMETRIC_AUTH_SIZE = 16;

/**
 * Encrypt data using ChaCha20-Poly1305 AEAD cipher.
 *
 * @param plaintext - The data to encrypt
 * @param key - 32-byte encryption key
 * @param nonce - 12-byte nonce (must be unique for each encryption with the same key)
 * @returns Tuple of [ciphertext, auth_tag]
 */
export function aeadChaCha20Poly1305Encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
): [Uint8Array, Uint8Array] {
  return aeadChaCha20Poly1305EncryptWithAad(plaintext, key, nonce, new Uint8Array(0));
}

/**
 * Encrypt data using ChaCha20-Poly1305 AEAD cipher with additional authenticated data.
 *
 * @param plaintext - The data to encrypt
 * @param key - 32-byte encryption key
 * @param nonce - 12-byte nonce (must be unique for each encryption with the same key)
 * @param aad - Additional authenticated data (not encrypted, but authenticated)
 * @returns Tuple of [ciphertext, auth_tag]
 */
export function aeadChaCha20Poly1305EncryptWithAad(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
): [Uint8Array, Uint8Array] {
  if (key.length !== SYMMETRIC_KEY_SIZE) {
    throw new Error(`Key must be ${SYMMETRIC_KEY_SIZE} bytes`);
  }
  if (nonce.length !== SYMMETRIC_NONCE_SIZE) {
    throw new Error(`Nonce must be ${SYMMETRIC_NONCE_SIZE} bytes`);
  }

  const cipher = chacha20poly1305(key, nonce, aad);
  const sealed = cipher.encrypt(plaintext);

  // The sealed output contains ciphertext + 16-byte auth tag
  const ciphertext = sealed.slice(0, sealed.length - SYMMETRIC_AUTH_SIZE);
  const authTag = sealed.slice(sealed.length - SYMMETRIC_AUTH_SIZE);

  return [ciphertext, authTag];
}

/**
 * Decrypt data using ChaCha20-Poly1305 AEAD cipher.
 *
 * @param ciphertext - The encrypted data
 * @param key - 32-byte encryption key
 * @param nonce - 12-byte nonce (must match the nonce used for encryption)
 * @param authTag - 16-byte authentication tag
 * @returns Decrypted plaintext
 * @throws CryptoError if authentication fails
 */
export function aeadChaCha20Poly1305Decrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  authTag: Uint8Array,
): Uint8Array {
  return aeadChaCha20Poly1305DecryptWithAad(ciphertext, key, nonce, new Uint8Array(0), authTag);
}

/**
 * Decrypt data using ChaCha20-Poly1305 AEAD cipher with additional authenticated data.
 *
 * @param ciphertext - The encrypted data
 * @param key - 32-byte encryption key
 * @param nonce - 12-byte nonce (must match the nonce used for encryption)
 * @param aad - Additional authenticated data (must match the AAD used for encryption)
 * @param authTag - 16-byte authentication tag
 * @returns Decrypted plaintext
 * @throws CryptoError if authentication fails
 */
export function aeadChaCha20Poly1305DecryptWithAad(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  authTag: Uint8Array,
): Uint8Array {
  if (key.length !== SYMMETRIC_KEY_SIZE) {
    throw new Error(`Key must be ${SYMMETRIC_KEY_SIZE} bytes`);
  }
  if (nonce.length !== SYMMETRIC_NONCE_SIZE) {
    throw new Error(`Nonce must be ${SYMMETRIC_NONCE_SIZE} bytes`);
  }
  if (authTag.length !== SYMMETRIC_AUTH_SIZE) {
    throw new Error(`Auth tag must be ${SYMMETRIC_AUTH_SIZE} bytes`);
  }

  // Combine ciphertext and auth tag for decryption
  const sealed = new Uint8Array(ciphertext.length + authTag.length);
  sealed.set(ciphertext);
  sealed.set(authTag, ciphertext.length);

  try {
    const cipher = chacha20poly1305(key, nonce, aad);
    return cipher.decrypt(sealed);
  } catch {
    throw CryptoError.aead(new AeadError("Decryption failed: authentication error"));
  }
}
