// Ported from bc-crypto-rust/src/ed25519_signing.rs

import { ed25519 } from "@noble/curves/ed25519";
import type { RandomNumberGenerator } from "@blockchain-commons/rand";

// Constants
export const ED25519_PUBLIC_KEY_SIZE = 32;
export const ED25519_PRIVATE_KEY_SIZE = 32;
export const ED25519_SIGNATURE_SIZE = 64;

/**
 * Generate a new random Ed25519 private key.
 */
export function ed25519NewPrivateKeyUsing(rng: RandomNumberGenerator): Uint8Array {
  return rng.randomData(ED25519_PRIVATE_KEY_SIZE);
}

/**
 * Derive an Ed25519 public key from a private key.
 */
export function ed25519PublicKeyFromPrivateKey(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== ED25519_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${ED25519_PRIVATE_KEY_SIZE} bytes`);
  }
  return ed25519.getPublicKey(privateKey);
}

/**
 * Sign a message using Ed25519.
 *
 * @param privateKey - 32-byte private key
 * @param message - Message to sign
 * @returns 64-byte Ed25519 signature
 */
export function ed25519Sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  if (privateKey.length !== ED25519_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${ED25519_PRIVATE_KEY_SIZE} bytes`);
  }
  return ed25519.sign(message, privateKey);
}

/**
 * Verify an Ed25519 signature.
 *
 * @param publicKey - 32-byte public key
 * @param message - Original message
 * @param signature - 64-byte signature
 * @returns true if signature is valid
 */
export function ed25519Verify(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  if (publicKey.length !== ED25519_PUBLIC_KEY_SIZE) {
    throw new Error(`Public key must be ${ED25519_PUBLIC_KEY_SIZE} bytes`);
  }
  if (signature.length !== ED25519_SIGNATURE_SIZE) {
    throw new Error(`Signature must be ${ED25519_SIGNATURE_SIZE} bytes`);
  }

  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}
