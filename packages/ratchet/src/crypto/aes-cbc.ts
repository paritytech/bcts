/**
 * AES-256-CBC encryption with PKCS#7 padding.
 * Compatible with Signal's aes_256_cbc_encrypt / aes_256_cbc_decrypt.
 *
 * Reference: libsignal/rust/crypto/src/aes_cbc.rs
 */

import { cbc } from "@noble/ciphers/aes.js";
import { RatchetError } from "../error.js";

const AES_KEY_SIZE = 32;
const AES_IV_SIZE = 16;
const AES_BLOCK_SIZE = 16;

/**
 * Encrypt plaintext using AES-256-CBC with PKCS#7 padding.
 *
 * noble/ciphers cbc() applies PKCS#7 padding internally.
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte AES-256 key
 * @param iv - 16-byte initialization vector
 * @returns Encrypted ciphertext (multiple of 16 bytes)
 */
export function aes256CbcEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  if (key.length !== AES_KEY_SIZE) {
    throw new RatchetError(`Key must be ${AES_KEY_SIZE} bytes`);
  }
  if (iv.length !== AES_IV_SIZE) {
    throw new RatchetError(`IV must be ${AES_IV_SIZE} bytes`);
  }

  const cipher = cbc(key, iv);
  return cipher.encrypt(plaintext);
}

/**
 * Decrypt ciphertext using AES-256-CBC with PKCS#7 unpadding.
 *
 * noble/ciphers cbc() removes PKCS#7 padding internally.
 *
 * @param ciphertext - Encrypted data (must be non-zero multiple of 16 bytes)
 * @param key - 32-byte AES-256 key
 * @param iv - 16-byte initialization vector
 * @returns Decrypted plaintext
 */
export function aes256CbcDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  if (key.length !== AES_KEY_SIZE) {
    throw new RatchetError(`Key must be ${AES_KEY_SIZE} bytes`);
  }
  if (iv.length !== AES_IV_SIZE) {
    throw new RatchetError(`IV must be ${AES_IV_SIZE} bytes`);
  }
  if (ciphertext.length === 0 || ciphertext.length % AES_BLOCK_SIZE !== 0) {
    throw new RatchetError(
      "Ciphertext length must be a non-zero multiple of 16",
    );
  }

  const cipher = cbc(key, iv);
  return cipher.decrypt(ciphertext);
}
