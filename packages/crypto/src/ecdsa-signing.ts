/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from bc-crypto-rust/src/ecdsa_signing.rs

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { doubleSha256 } from "./hash.js";
import {
  ECDSA_PRIVATE_KEY_SIZE,
  ECDSA_PUBLIC_KEY_SIZE,
  ECDSA_SIGNATURE_SIZE,
} from "./ecdsa-keys.js";

/**
 * Sign a message using ECDSA with secp256k1.
 *
 * The message is hashed with double SHA-256 before signing (Bitcoin standard).
 *
 * **Security Note**: The private key must be kept secret. ECDSA requires
 * cryptographically secure random nonces internally; this is handled by
 * the underlying library using RFC 6979 deterministic nonces.
 *
 * @param privateKey - 32-byte secp256k1 private key
 * @param message - Message to sign (any length, will be double-SHA256 hashed)
 * @returns 64-byte compact signature (r || s format)
 * @throws {Error} If private key is not 32 bytes
 */
export function ecdsaSign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  if (privateKey.length !== ECDSA_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${ECDSA_PRIVATE_KEY_SIZE} bytes`);
  }

  const messageHash = doubleSha256(message);
  // prehash: false because we already hashed the message with doubleSha256
  return secp256k1.sign(messageHash, privateKey, { prehash: false });
}

/**
 * Verify an ECDSA signature with secp256k1.
 *
 * The message is hashed with double SHA-256 before verification (Bitcoin standard).
 *
 * @param publicKey - 33-byte compressed secp256k1 public key
 * @param signature - 64-byte compact signature (r || s format)
 * @param message - Original message that was signed
 * @returns `true` if signature is valid, `false` if signature verification fails
 * @throws {Error} If public key is not 33 bytes or signature is not 64 bytes
 */
export function ecdsaVerify(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array,
): boolean {
  if (publicKey.length !== ECDSA_PUBLIC_KEY_SIZE) {
    throw new Error(`Public key must be ${ECDSA_PUBLIC_KEY_SIZE} bytes`);
  }
  if (signature.length !== ECDSA_SIGNATURE_SIZE) {
    throw new Error(`Signature must be ${ECDSA_SIGNATURE_SIZE} bytes`);
  }

  try {
    const messageHash = doubleSha256(message);
    // prehash: false because we already hashed the message with doubleSha256
    return secp256k1.verify(signature, messageHash, publicKey, { prehash: false });
  } catch {
    return false;
  }
}
