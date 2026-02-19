/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-crypto-rust/src/ecdsa_keys.rs

import { secp256k1 } from "@noble/curves/secp256k1.js";
import type { RandomNumberGenerator } from "@bcts/rand";
import { hkdfHmacSha256 } from "./hash.js";

// Constants
export const ECDSA_PRIVATE_KEY_SIZE = 32;
export const ECDSA_PUBLIC_KEY_SIZE = 33; // Compressed
export const ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE = 65;
export const ECDSA_MESSAGE_HASH_SIZE = 32;
export const ECDSA_SIGNATURE_SIZE = 64;
export const SCHNORR_PUBLIC_KEY_SIZE = 32; // x-only

/**
 * Generate a new random ECDSA private key using secp256k1.
 *
 * Note: Unlike some implementations, this directly returns the random bytes
 * without validation. The secp256k1 library will handle any edge cases when
 * the key is used.
 */
export function ecdsaNewPrivateKeyUsing(rng: RandomNumberGenerator): Uint8Array {
  return rng.randomData(ECDSA_PRIVATE_KEY_SIZE);
}

/**
 * Derive a compressed ECDSA public key from a private key.
 */
export function ecdsaPublicKeyFromPrivateKey(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== ECDSA_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${ECDSA_PRIVATE_KEY_SIZE} bytes`);
  }
  return secp256k1.getPublicKey(privateKey, true); // true = compressed
}

/**
 * Decompress a compressed public key to uncompressed format.
 */
export function ecdsaDecompressPublicKey(compressed: Uint8Array): Uint8Array {
  if (compressed.length !== ECDSA_PUBLIC_KEY_SIZE) {
    throw new Error(`Compressed public key must be ${ECDSA_PUBLIC_KEY_SIZE} bytes`);
  }
  const point = secp256k1.Point.fromBytes(compressed);
  return point.toBytes(false); // false = uncompressed
}

/**
 * Compress an uncompressed public key.
 */
export function ecdsaCompressPublicKey(uncompressed: Uint8Array): Uint8Array {
  if (uncompressed.length !== ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE) {
    throw new Error(`Uncompressed public key must be ${ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE} bytes`);
  }
  const point = secp256k1.Point.fromBytes(uncompressed);
  return point.toBytes(true); // true = compressed
}

/**
 * Derive an ECDSA private key from key material using HKDF.
 *
 * Note: This directly returns the HKDF output without validation,
 * matching the Rust reference implementation behavior.
 */
export function ecdsaDerivePrivateKey(keyMaterial: Uint8Array): Uint8Array {
  const salt = new TextEncoder().encode("signing");
  return hkdfHmacSha256(keyMaterial, salt, ECDSA_PRIVATE_KEY_SIZE);
}

/**
 * Extract the x-only (Schnorr) public key from a private key.
 * This is used for BIP-340 Schnorr signatures.
 */
export function schnorrPublicKeyFromPrivateKey(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== ECDSA_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${ECDSA_PRIVATE_KEY_SIZE} bytes`);
  }
  // Get the full public key and extract just the x-coordinate
  const fullPubKey = secp256k1.getPublicKey(privateKey, false); // uncompressed
  // Skip the 0x04 prefix and take only x-coordinate (first 32 bytes after prefix)
  return fullPubKey.slice(1, 33);
}
