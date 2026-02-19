/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from provenance-mark-rust/src/crypto_utils.rs

import { sha256 as sha256Hash } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { chacha20 } from "@noble/ciphers/chacha.js";

export const SHA256_SIZE = 32;

/**
 * Compute SHA-256 hash of data.
 */
export function sha256(data: Uint8Array): Uint8Array {
  return sha256Hash(data);
}

/**
 * Compute SHA-256 hash and return a prefix of the given length.
 */
export function sha256Prefix(data: Uint8Array, prefix: number): Uint8Array {
  const digest = sha256(data);
  return digest.slice(0, prefix);
}

/**
 * Extend a key to 32 bytes using HKDF-HMAC-SHA-256.
 */
export function extendKey(data: Uint8Array): Uint8Array {
  return hkdfHmacSha256(data, new Uint8Array(0), 32);
}

/**
 * Compute HKDF-HMAC-SHA-256 for the given key material.
 */
export function hkdfHmacSha256(
  keyMaterial: Uint8Array,
  salt: Uint8Array,
  keyLen: number,
): Uint8Array {
  // HKDF with empty info
  return hkdf(
    sha256Hash,
    keyMaterial,
    salt.length > 0 ? salt : undefined,
    new Uint8Array(0),
    keyLen,
  );
}

/**
 * Obfuscate (or deobfuscate) a message using ChaCha20.
 * The function is symmetric - applying it twice returns the original message.
 */
export function obfuscate(key: Uint8Array, message: Uint8Array): Uint8Array {
  if (message.length === 0) {
    return new Uint8Array(0);
  }

  // Ensure key is a proper Uint8Array
  const keyBytes = key instanceof Uint8Array ? key : new Uint8Array(key);
  const extendedKey = extendKey(keyBytes);

  // IV is the last 12 bytes of the extended key, reversed
  // Rust: extended_key.iter().rev().take(12).copied().collect()
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    iv[i] = extendedKey[31 - i];
  }

  // Ensure message is a proper Uint8Array
  const messageBytes = message instanceof Uint8Array ? message : new Uint8Array(message);

  // ChaCha20 is a XorStream function: (key, nonce, data) => encrypted
  // counter defaults to 0
  return chacha20(extendedKey, iv, messageBytes);
}
