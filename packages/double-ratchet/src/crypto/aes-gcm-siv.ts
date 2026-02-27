// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * AES-256-GCM-SIV encryption/decryption.
 *
 * Used by the Sealed Sender protocol for anonymous delivery encryption.
 * GCM-SIV provides nonce-misuse resistance: repeating a nonce only reveals
 * whether the same plaintext was encrypted, but does not compromise integrity.
 *
 * Reference: libsignal/rust/protocol/src/crypto.rs (v2 uses AES-GCM-SIV)
 */

import { gcmsiv } from "@noble/ciphers/aes.js";

/**
 * AES-256-GCM-SIV encrypt.
 * @param key - 32-byte key
 * @param nonce - 12-byte nonce
 * @param plaintext - data to encrypt
 * @param aad - additional authenticated data
 * @returns ciphertext with 16-byte tag appended
 */
export function aes256GcmSivEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  const cipher = gcmsiv(key, nonce, aad);
  return cipher.encrypt(plaintext);
}

/**
 * AES-256-GCM-SIV decrypt.
 * @param key - 32-byte key
 * @param nonce - 12-byte nonce
 * @param ciphertext - data to decrypt (with 16-byte tag appended)
 * @param aad - additional authenticated data
 * @returns plaintext
 */
export function aes256GcmSivDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  const cipher = gcmsiv(key, nonce, aad);
  return cipher.decrypt(ciphertext);
}
