/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * MLDSA Security Level - ML-DSA (Module-Lattice-Based Digital Signature Algorithm)
 *
 * ML-DSA is a post-quantum digital signature algorithm standardized by NIST.
 * It provides three security levels corresponding to different NIST security categories.
 *
 * Security levels:
 * - MLDSA44: NIST Level 2 (equivalent to AES-128)
 * - MLDSA65: NIST Level 3 (equivalent to AES-192)
 * - MLDSA87: NIST Level 5 (equivalent to AES-256)
 *
 * Ported from bc-components-rust/src/mldsa/mldsa_level.rs
 */

import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import type { RandomNumberGenerator } from "@bcts/rand";
import { SecureRandomNumberGenerator } from "@bcts/rand";

/**
 * ML-DSA security levels.
 *
 * The numeric values correspond to NIST security levels:
 * - 2: NIST Level 2 (MLDSA44)
 * - 3: NIST Level 3 (MLDSA65)
 * - 5: NIST Level 5 (MLDSA87)
 */
export enum MLDSALevel {
  /** NIST Level 2 - AES-128 equivalent security */
  MLDSA44 = 2,
  /** NIST Level 3 - AES-192 equivalent security */
  MLDSA65 = 3,
  /** NIST Level 5 - AES-256 equivalent security */
  MLDSA87 = 5,
}

/**
 * Key sizes for each ML-DSA security level.
 */
export const MLDSA_KEY_SIZES = {
  [MLDSALevel.MLDSA44]: {
    privateKey: 2560,
    publicKey: 1312,
    signature: 2420,
  },
  [MLDSALevel.MLDSA65]: {
    privateKey: 4032,
    publicKey: 1952,
    signature: 3309,
  },
  [MLDSALevel.MLDSA87]: {
    privateKey: 4896,
    publicKey: 2592,
    signature: 4627,
  },
} as const;

/**
 * Get the private key size for a given ML-DSA level.
 */
export function mldsaPrivateKeySize(level: MLDSALevel): number {
  return MLDSA_KEY_SIZES[level].privateKey;
}

/**
 * Get the public key size for a given ML-DSA level.
 */
export function mldsaPublicKeySize(level: MLDSALevel): number {
  return MLDSA_KEY_SIZES[level].publicKey;
}

/**
 * Get the signature size for a given ML-DSA level.
 */
export function mldsaSignatureSize(level: MLDSALevel): number {
  return MLDSA_KEY_SIZES[level].signature;
}

/**
 * Convert an ML-DSA level to its string representation.
 */
export function mldsaLevelToString(level: MLDSALevel): string {
  switch (level) {
    case MLDSALevel.MLDSA44:
      return "MLDSA44";
    case MLDSALevel.MLDSA65:
      return "MLDSA65";
    case MLDSALevel.MLDSA87:
      return "MLDSA87";
  }
}

/**
 * Parse an ML-DSA level from its numeric value.
 */
export function mldsaLevelFromValue(value: number): MLDSALevel {
  switch (value) {
    case 2:
      return MLDSALevel.MLDSA44;
    case 3:
      return MLDSALevel.MLDSA65;
    case 5:
      return MLDSALevel.MLDSA87;
    default:
      throw new Error(`Invalid MLDSA level value: ${value}`);
  }
}

/**
 * Internal type for ML-DSA keypair generation result.
 */
export interface MLDSAKeypairData {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Generate an ML-DSA keypair for the given security level.
 *
 * @param level - The ML-DSA security level
 * @returns Object containing publicKey and secretKey bytes
 */
export function mldsaGenerateKeypair(level: MLDSALevel): MLDSAKeypairData {
  const rng = new SecureRandomNumberGenerator();
  return mldsaGenerateKeypairUsing(level, rng);
}

/**
 * Generate an ML-DSA keypair using a provided RNG.
 *
 * @param level - The ML-DSA security level
 * @param rng - Random number generator
 * @returns Object containing publicKey and secretKey bytes
 */
export function mldsaGenerateKeypairUsing(
  level: MLDSALevel,
  rng: RandomNumberGenerator,
): MLDSAKeypairData {
  // Generate random seed for keypair generation
  const seed = rng.randomData(32);

  switch (level) {
    case MLDSALevel.MLDSA44: {
      const keypair = ml_dsa44.keygen(seed);
      return { publicKey: keypair.publicKey, secretKey: keypair.secretKey };
    }
    case MLDSALevel.MLDSA65: {
      const keypair = ml_dsa65.keygen(seed);
      return { publicKey: keypair.publicKey, secretKey: keypair.secretKey };
    }
    case MLDSALevel.MLDSA87: {
      const keypair = ml_dsa87.keygen(seed);
      return { publicKey: keypair.publicKey, secretKey: keypair.secretKey };
    }
  }
}

/**
 * Sign a message using ML-DSA.
 *
 * @param level - The ML-DSA security level
 * @param secretKey - The secret key bytes
 * @param message - The message to sign
 * @returns The signature bytes
 */
export function mldsaSign(
  level: MLDSALevel,
  secretKey: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  switch (level) {
    case MLDSALevel.MLDSA44:
      return ml_dsa44.sign(message, secretKey);
    case MLDSALevel.MLDSA65:
      return ml_dsa65.sign(message, secretKey);
    case MLDSALevel.MLDSA87:
      return ml_dsa87.sign(message, secretKey);
  }
}

/**
 * Verify a signature using ML-DSA.
 *
 * @param level - The ML-DSA security level
 * @param publicKey - The public key bytes
 * @param message - The message that was signed
 * @param signature - The signature to verify
 * @returns True if the signature is valid
 */
export function mldsaVerify(
  level: MLDSALevel,
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    switch (level) {
      case MLDSALevel.MLDSA44:
        return ml_dsa44.verify(signature, message, publicKey);
      case MLDSALevel.MLDSA65:
        return ml_dsa65.verify(signature, message, publicKey);
      case MLDSALevel.MLDSA87:
        return ml_dsa87.verify(signature, message, publicKey);
    }
  } catch {
    return false;
  }
}
