// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * Key derivation functions for the Signal Protocol.
 *
 * HKDF-SHA256 with info parameter support, and chain key material calculation.
 *
 * Reference: libsignal/rust/protocol/src/ratchet/keys.rs
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";

/**
 * HKDF-SHA256 with salt and info parameters.
 *
 * Signal uses specific info strings like "WhisperRatchet", "WhisperMessageKeys", "WhisperText".
 *
 * @param ikm - Input keying material
 * @param salt - Salt value (can be undefined for initial derivation)
 * @param info - Context/info string
 * @param length - Desired output length in bytes
 * @returns Derived key material
 */
export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array | undefined,
  info: Uint8Array,
  length: number,
): Uint8Array {
  return hkdf(sha256, ikm, salt, info, length);
}

/**
 * Calculate chain key material: HMAC-SHA256(key, seed).
 *
 * Used for deriving message key seeds (seed=0x01) and next chain keys (seed=0x02).
 *
 * @param key - 32-byte chain key
 * @param seed - Derivation seed byte(s)
 * @returns 32-byte derived material
 */
export function hmacSha256(key: Uint8Array, seed: Uint8Array): Uint8Array {
  return hmac(sha256, key, seed);
}
