// Ported from bc-crypto-rust/src/ecdsa_signing.rs

import { secp256k1 } from "@noble/curves/secp256k1";
import { doubleSha256 } from "./hash.js";
import {
  ECDSA_PRIVATE_KEY_SIZE,
  ECDSA_PUBLIC_KEY_SIZE,
  ECDSA_SIGNATURE_SIZE,
} from "./ecdsa-keys.js";

/**
 * Sign a message using ECDSA with secp256k1.
 * The message is hashed with double SHA-256 before signing.
 *
 * @param privateKey - 32-byte private key
 * @param message - Message to sign
 * @returns 64-byte signature (r || s in compact format)
 */
export function ecdsaSign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  if (privateKey.length !== ECDSA_PRIVATE_KEY_SIZE) {
    throw new Error(`Private key must be ${ECDSA_PRIVATE_KEY_SIZE} bytes`);
  }

  const messageHash = doubleSha256(message);
  const signature = secp256k1.sign(messageHash, privateKey);

  // Return compact signature (r || s)
  return signature.toCompactRawBytes();
}

/**
 * Verify an ECDSA signature.
 *
 * @param publicKey - 33-byte compressed public key
 * @param signature - 64-byte signature
 * @param message - Original message
 * @returns true if signature is valid
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
    const sig = secp256k1.Signature.fromCompact(signature);
    return secp256k1.verify(sig, messageHash, publicKey);
  } catch {
    return false;
  }
}
