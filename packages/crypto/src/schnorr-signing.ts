// Ported from bc-crypto-rust/src/schnorr_signing.rs

import { schnorr } from "@noble/curves/secp256k1.js";
import type { RandomNumberGenerator } from "@bcts/rand";
import { SecureRandomNumberGenerator } from "@bcts/rand";
import { ECDSA_PRIVATE_KEY_SIZE, SCHNORR_PUBLIC_KEY_SIZE } from "./ecdsa-keys.js";

// Constants
export const SCHNORR_SIGNATURE_SIZE = 64;

/**
 * Sign a message using Schnorr signature (BIP-340).
 * Uses secure random auxiliary randomness.
 *
 * @param ecdsaPrivateKey - 32-byte private key
 * @param message - Message to sign (not pre-hashed, per BIP-340)
 * @returns 64-byte Schnorr signature
 */
export function schnorrSign(ecdsaPrivateKey: Uint8Array, message: Uint8Array): Uint8Array {
  const rng = new SecureRandomNumberGenerator();
  return schnorrSignUsing(ecdsaPrivateKey, message, rng);
}

/**
 * Sign a message using Schnorr signature with a custom RNG.
 *
 * @param ecdsaPrivateKey - 32-byte private key
 * @param message - Message to sign
 * @param rng - Random number generator for auxiliary randomness
 * @returns 64-byte Schnorr signature
 */
export function schnorrSignUsing(
  ecdsaPrivateKey: Uint8Array,
  message: Uint8Array,
  rng: RandomNumberGenerator,
): Uint8Array {
  const auxRand = rng.randomData(32);
  return schnorrSignWithAuxRand(ecdsaPrivateKey, message, auxRand);
}

/**
 * Sign a message using Schnorr signature with specific auxiliary randomness.
 * This is useful for deterministic signing in tests.
 *
 * @param ecdsaPrivateKey - 32-byte private key
 * @param message - Message to sign
 * @param auxRand - 32-byte auxiliary randomness (per BIP-340)
 * @returns 64-byte Schnorr signature
 */
export function schnorrSignWithAuxRand(
  ecdsaPrivateKey: Uint8Array,
  message: Uint8Array,
  auxRand: Uint8Array,
): Uint8Array {
  if (ecdsaPrivateKey.length !== ECDSA_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${ECDSA_PRIVATE_KEY_SIZE} bytes`);
  }
  if (auxRand.length !== 32) {
    throw new Error("Auxiliary randomness must be 32 bytes");
  }

  return schnorr.sign(message, ecdsaPrivateKey, auxRand);
}

/**
 * Verify a Schnorr signature (BIP-340).
 *
 * @param schnorrPublicKey - 32-byte x-only public key
 * @param signature - 64-byte Schnorr signature
 * @param message - Original message
 * @returns true if signature is valid
 */
export function schnorrVerify(
  schnorrPublicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array,
): boolean {
  if (schnorrPublicKey.length !== SCHNORR_PUBLIC_KEY_SIZE) {
    throw new Error(`Public key must be ${SCHNORR_PUBLIC_KEY_SIZE} bytes`);
  }
  if (signature.length !== SCHNORR_SIGNATURE_SIZE) {
    throw new Error(`Signature must be ${SCHNORR_SIGNATURE_SIZE} bytes`);
  }

  try {
    return schnorr.verify(signature, message, schnorrPublicKey);
  } catch {
    return false;
  }
}
