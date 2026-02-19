/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-crypto-rust/src/public_key_encryption.rs

import { x25519 } from "@noble/curves/ed25519.js";
import type { RandomNumberGenerator } from "@bcts/rand";
import { hkdfHmacSha256 } from "./hash.js";

// Constants
export const GENERIC_PRIVATE_KEY_SIZE = 32;
export const GENERIC_PUBLIC_KEY_SIZE = 32;
export const X25519_PRIVATE_KEY_SIZE = 32;
export const X25519_PUBLIC_KEY_SIZE = 32;

/**
 * Derive an X25519 agreement private key from key material.
 * Uses HKDF with "agreement" as domain separation salt.
 */
export function deriveAgreementPrivateKey(keyMaterial: Uint8Array): Uint8Array {
  const salt = new TextEncoder().encode("agreement");
  return hkdfHmacSha256(keyMaterial, salt, X25519_PRIVATE_KEY_SIZE);
}

/**
 * Derive a signing private key from key material.
 * Uses HKDF with "signing" as domain separation salt.
 */
export function deriveSigningPrivateKey(keyMaterial: Uint8Array): Uint8Array {
  const salt = new TextEncoder().encode("signing");
  return hkdfHmacSha256(keyMaterial, salt, 32);
}

/**
 * Generate a new random X25519 private key.
 */
export function x25519NewPrivateKeyUsing(rng: RandomNumberGenerator): Uint8Array {
  return rng.randomData(X25519_PRIVATE_KEY_SIZE);
}

/**
 * Derive an X25519 public key from a private key.
 */
export function x25519PublicKeyFromPrivateKey(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== X25519_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${X25519_PRIVATE_KEY_SIZE} bytes`);
  }
  return x25519.getPublicKey(privateKey);
}

// Symmetric key size for the derived shared key
const SYMMETRIC_KEY_SIZE = 32;

/**
 * Compute a shared symmetric key using X25519 key agreement (ECDH).
 *
 * This function performs X25519 Diffie-Hellman key agreement and then
 * derives a symmetric key using HKDF-SHA256 with "agreement" as the salt.
 * This matches the Rust bc-crypto implementation for cross-platform compatibility.
 *
 * @param x25519Private - 32-byte X25519 private key
 * @param x25519Public - 32-byte X25519 public key from the other party
 * @returns 32-byte derived symmetric key
 * @throws {Error} If private key is not 32 bytes or public key is not 32 bytes
 */
export function x25519SharedKey(x25519Private: Uint8Array, x25519Public: Uint8Array): Uint8Array {
  if (x25519Private.length !== X25519_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${X25519_PRIVATE_KEY_SIZE} bytes`);
  }
  if (x25519Public.length !== X25519_PUBLIC_KEY_SIZE) {
    throw new Error(`Public key must be ${X25519_PUBLIC_KEY_SIZE} bytes`);
  }
  // Perform raw X25519 Diffie-Hellman
  const rawSharedSecret = x25519.getSharedSecret(x25519Private, x25519Public);
  // Derive symmetric key using HKDF with "agreement" salt (matches Rust implementation)
  const salt = new TextEncoder().encode("agreement");
  return hkdfHmacSha256(rawSharedSecret, salt, SYMMETRIC_KEY_SIZE);
}
