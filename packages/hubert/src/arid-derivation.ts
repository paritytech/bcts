/**
 * ARID key derivation and obfuscation utilities.
 *
 * Port of arid_derivation.rs from hubert-rust.
 *
 * @module
 */

import { type ARID } from "@bcts/components";
import { hkdfHmacSha256 } from "@bcts/crypto";
import { chacha20 } from "@noble/ciphers/chacha";

/**
 * Derive a deterministic key from an ARID using a specific salt.
 *
 * Uses HKDF to derive key material from the ARID, ensuring that:
 * - Same ARID always produces same key for a given salt
 * - Keys are cryptographically derived (not guessable)
 * - Collision resistance inherited from ARID
 * - No identifying information in the key (fully anonymized)
 *
 * Port of `derive_key()` from arid_derivation.rs lines 8-29.
 *
 * @param salt - Domain-specific salt to ensure different backends derive different keys
 * @param arid - The ARID to derive from
 * @param outputLen - Length of output in bytes (typically 20 or 32)
 * @returns Derived key bytes
 * @category ARID Derivation
 *
 * @example
 * ```typescript
 * const key = deriveKey(new TextEncoder().encode("my-salt"), arid, 32);
 * ```
 */
export function deriveKey(salt: Uint8Array, arid: ARID, outputLen: number): Uint8Array {
  const aridBytes = arid.data();
  // Note: @bcts/crypto hkdfHmacSha256 takes (keyMaterial, salt, keyLen)
  // Rust bc-crypto takes (salt, ikm, keyLen)
  return hkdfHmacSha256(aridBytes, salt, outputLen);
}

/**
 * Salt for IPFS IPNS key derivation.
 * @internal
 */
const IPFS_KEY_NAME_SALT = new TextEncoder().encode("hubert-ipfs-ipns-v1");

/**
 * Salt for Mainline DHT key derivation.
 * @internal
 */
const MAINLINE_KEY_SALT = new TextEncoder().encode("hubert-mainline-dht-v1");

/**
 * Salt for obfuscation key derivation.
 * @internal
 */
const OBFUSCATION_SALT = new TextEncoder().encode("hubert-obfuscation-v1");

/**
 * Derive an IPNS key name from an ARID.
 *
 * Returns a 64-character hex string suitable for use as an IPFS key name.
 *
 * Port of `derive_ipfs_key_name()` from arid_derivation.rs lines 31-37.
 *
 * @param arid - The ARID to derive from
 * @returns 64-character hex string
 * @category ARID Derivation
 *
 * @example
 * ```typescript
 * const keyName = deriveIpfsKeyName(arid);
 * // => "a1b2c3d4e5f6..." (64 hex characters)
 * ```
 */
export function deriveIpfsKeyName(arid: ARID): string {
  const keyBytes = deriveKey(IPFS_KEY_NAME_SALT, arid, 32);
  return bytesToHex(keyBytes);
}

/**
 * Derive Mainline DHT key material from an ARID.
 *
 * Returns 20 bytes of key material (SHA-1 compatible length).
 *
 * Port of `derive_mainline_key()` from arid_derivation.rs lines 39-45.
 *
 * @param arid - The ARID to derive from
 * @returns 20 bytes of key material
 * @category ARID Derivation
 *
 * @example
 * ```typescript
 * const key = deriveMainlineKey(arid);
 * // => Uint8Array(20) [...]
 * ```
 */
export function deriveMainlineKey(arid: ARID): Uint8Array {
  return deriveKey(MAINLINE_KEY_SALT, arid, 20);
}

/**
 * Obfuscate or deobfuscate data using ChaCha20 with an ARID-derived key.
 *
 * This function uses ChaCha20 as a stream cipher to XOR the data with a
 * keystream derived from the ARID. Since XOR is symmetric, the same function
 * is used for both obfuscation and deobfuscation.
 *
 * The result appears as uniform random data to anyone who doesn't have the
 * ARID, hiding both the structure and content of the reference envelope.
 *
 * Port of `obfuscate_with_arid()` from arid_derivation.rs lines 47-91.
 *
 * @param arid - The ARID used to derive the obfuscation key
 * @param data - The data to obfuscate or deobfuscate
 * @returns The obfuscated (or deobfuscated) data
 * @category ARID Derivation
 *
 * @example
 * ```typescript
 * const obfuscated = obfuscateWithArid(arid, plaintext);
 * const deobfuscated = obfuscateWithArid(arid, obfuscated);
 * // deobfuscated === plaintext
 * ```
 */
export function obfuscateWithArid(arid: ARID, data: Uint8Array): Uint8Array {
  if (data.length === 0) {
    return new Uint8Array(0);
  }

  // Derive a 32-byte key from the ARID using HKDF with domain-specific salt
  const key = deriveKey(OBFUSCATION_SALT, arid, 32);

  // Derive IV from the key (last 12 bytes, reversed)
  // Match Rust: key.iter().rev().take(12).copied().collect()
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    iv[i] = key[31 - i];
  }

  // Use ChaCha20 to XOR the data
  // @noble/ciphers chacha20 takes (key, nonce, data) and returns encrypted data
  return chacha20(key, iv, data);
}

/**
 * Convert bytes to lowercase hex string.
 * @internal
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
