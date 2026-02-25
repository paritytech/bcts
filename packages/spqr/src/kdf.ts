/**
 * Copyright © 2025 Signal Messenger, LLC
 * Copyright © 2026 Parity Technologies
 *
 * KDF wrappers for SPQR (HKDF-SHA256 and HMAC-SHA256).
 */

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";

/**
 * HKDF-SHA256 key derivation.
 * @param ikm Input key material
 * @param salt Salt (use ZERO_SALT for empty)
 * @param info Context info string or bytes
 * @param length Output length in bytes
 */
export function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array | string,
  length: number,
): Uint8Array {
  const infoBytes = typeof info === "string" ? new TextEncoder().encode(info) : info;
  return hkdf(sha256, ikm, salt, infoBytes, length);
}

/**
 * HMAC-SHA256 computation.
 */
export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  return hmac(sha256, key, data);
}
