/**
 * ML-KEM Module - Post-Quantum Key Encapsulation Mechanism
 *
 * This module provides ML-KEM (Module-Lattice-Based Key Encapsulation Mechanism)
 * implementation for post-quantum key agreement.
 *
 * ML-KEM is standardized by NIST as part of FIPS 203.
 *
 * Security levels:
 * - MLKEM512: NIST Level 1 (AES-128 equivalent)
 * - MLKEM768: NIST Level 3 (AES-192 equivalent)
 * - MLKEM1024: NIST Level 5 (AES-256 equivalent)
 */

// Security level enum and utilities
export {
  MLKEMLevel,
  MLKEM_KEY_SIZES,
  mlkemPrivateKeySize,
  mlkemPublicKeySize,
  mlkemCiphertextSize,
  mlkemSharedSecretSize,
  mlkemLevelToString,
  mlkemLevelFromValue,
  mlkemGenerateKeypair,
  mlkemGenerateKeypairUsing,
  mlkemEncapsulate,
  mlkemDecapsulate,
} from "./mlkem-level.js";
export type { MLKEMKeypairData, MLKEMEncapsulationResult } from "./mlkem-level.js";

// Key and ciphertext types
export { MLKEMPrivateKey } from "./mlkem-private-key.js";
export { MLKEMPublicKey } from "./mlkem-public-key.js";
export type { MLKEMEncapsulationPair } from "./mlkem-public-key.js";
export { MLKEMCiphertext } from "./mlkem-ciphertext.js";
