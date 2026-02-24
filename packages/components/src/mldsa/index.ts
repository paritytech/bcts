/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * ML-DSA Module - Post-Quantum Digital Signatures
 *
 * This module provides ML-DSA (Module-Lattice-Based Digital Signature Algorithm)
 * implementation for post-quantum cryptographic signatures.
 *
 * ML-DSA is standardized by NIST as part of FIPS 204.
 *
 * Security levels:
 * - MLDSA44: NIST Level 2 (AES-128 equivalent)
 * - MLDSA65: NIST Level 3 (AES-192 equivalent)
 * - MLDSA87: NIST Level 5 (AES-256 equivalent)
 */

// Security level enum and utilities
export {
  MLDSALevel,
  MLDSA_KEY_SIZES,
  mldsaPrivateKeySize,
  mldsaPublicKeySize,
  mldsaSignatureSize,
  mldsaLevelToString,
  mldsaLevelFromValue,
  mldsaGenerateKeypair,
  mldsaGenerateKeypairUsing,
  mldsaSign,
  mldsaVerify,
} from "./mldsa-level.js";
export type { MLDSAKeypairData } from "./mldsa-level.js";

// Key and signature types
export { MLDSAPrivateKey } from "./mldsa-private-key.js";
export { MLDSAPublicKey } from "./mldsa-public-key.js";
export { MLDSASignature } from "./mldsa-signature.js";
