// Ported from bc-crypto-rust/src/ecdsa_keys.rs

import { secp256k1 } from "@noble/curves/secp256k1";
import type { RandomNumberGenerator } from "@blockchain-commons/rand";
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
 */
export function ecdsaNewPrivateKeyUsing(rng: RandomNumberGenerator): Uint8Array {
  // Generate random bytes and ensure they're valid for secp256k1
  let privateKey: Uint8Array;
  do {
    privateKey = rng.randomData(ECDSA_PRIVATE_KEY_SIZE);
  } while (!isValidPrivateKey(privateKey));
  return privateKey;
}

/**
 * Check if a private key is valid for secp256k1.
 */
function isValidPrivateKey(key: Uint8Array): boolean {
  try {
    secp256k1.getPublicKey(key);
    return true;
  } catch {
    return false;
  }
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
  const point = secp256k1.ProjectivePoint.fromHex(compressed);
  return point.toRawBytes(false); // false = uncompressed
}

/**
 * Compress an uncompressed public key.
 */
export function ecdsaCompressPublicKey(uncompressed: Uint8Array): Uint8Array {
  if (uncompressed.length !== ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE) {
    throw new Error(`Uncompressed public key must be ${ECDSA_UNCOMPRESSED_PUBLIC_KEY_SIZE} bytes`);
  }
  const point = secp256k1.ProjectivePoint.fromHex(uncompressed);
  return point.toRawBytes(true); // true = compressed
}

/**
 * Derive an ECDSA private key from key material using HKDF.
 */
export function ecdsaDerivePrivateKey(keyMaterial: Uint8Array): Uint8Array {
  const salt = new TextEncoder().encode("signing");
  let derivedKey: Uint8Array;
  let counter = 0;

  // Keep deriving until we get a valid key
  do {
    const saltWithCounter =
      counter === 0
        ? salt
        : new Uint8Array([...salt, ...new TextEncoder().encode(counter.toString())]);
    derivedKey = hkdfHmacSha256(keyMaterial, saltWithCounter, ECDSA_PRIVATE_KEY_SIZE);
    counter++;
  } while (!isValidPrivateKey(derivedKey));

  return derivedKey;
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
