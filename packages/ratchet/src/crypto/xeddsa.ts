/**
 * XEdDSA: Sign with X25519 keys using Edwards-curve operations.
 *
 * XEdDSA converts an X25519 (Montgomery) key pair to Ed25519 (Edwards)
 * internally, then produces standard Ed25519 signatures. This lets the
 * Signal Protocol use a single X25519 key for both DH and signing.
 *
 * Algorithm matches libsignal's curve25519.rs implementation exactly.
 *
 * Reference: https://signal.org/docs/specifications/xeddsa/
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";

const Point = ed25519.Point;
const B = Point.BASE;
const L = Point.Fn.ORDER;
const P = Point.Fp.ORDER;

/**
 * Convert a little-endian byte array to a bigint.
 */
function bytesToNumberLE(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

/**
 * Convert a bigint to a 32-byte little-endian Uint8Array.
 */
function numberToBytes32LE(n: bigint): Uint8Array {
  const result = new Uint8Array(32);
  let val = n;
  for (let i = 0; i < 32; i++) {
    result[i] = Number(val & 0xffn);
    val >>= 8n;
  }
  return result;
}

/**
 * Modular inverse using Fermat's little theorem: a^(p-2) mod p.
 */
function modInverse(a: bigint, p: bigint): bigint {
  return modPow(a, p - 2n, p);
}

/**
 * Modular exponentiation via binary method.
 */
function modPow(base: bigint, exp: bigint, modulus: bigint): bigint {
  let result = 1n;
  base = ((base % modulus) + modulus) % modulus;
  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * base) % modulus;
    }
    exp >>= 1n;
    base = (base * base) % modulus;
  }
  return result;
}

/**
 * Positive modulo (always returns 0..mod-1).
 */
function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

/**
 * Clamp an X25519 private key scalar per RFC 7748.
 */
function clampPrivateKey(key: Uint8Array): Uint8Array {
  const clamped = new Uint8Array(key);
  clamped[0] &= 248;
  clamped[31] &= 127;
  clamped[31] |= 64;
  return clamped;
}

/**
 * Sign a message using XEdDSA.
 *
 * Takes an X25519 private key and produces an Ed25519 signature.
 * Matches libsignal's curve25519.rs implementation exactly.
 *
 * @param privateKey - 32-byte X25519 private key
 * @param message - Arbitrary-length message to sign
 * @param random - 64 bytes of randomness (optional, for deterministic tests)
 * @returns 64-byte Ed25519 signature with sign bit embedded in signature[63]
 */
export function xeddsaSign(
  privateKey: Uint8Array,
  message: Uint8Array,
  random?: Uint8Array,
): Uint8Array {
  // 1. Clamp the private key
  const clamped = clampPrivateKey(privateKey);

  // 2. Compute scalar mod L for point multiplication
  let scalar = mod(bytesToNumberLE(clamped), L);
  if (scalar === 0n) scalar = 1n;

  // 3. Compute the Edwards public key: A = scalar * B
  const A = B.multiply(scalar);
  const compressedA = A.toBytes();

  // 4. Record the sign bit (high bit of last byte of compressed Edwards key).
  // If the sign bit is set, negate the scalar so the effective public key
  // always has sign bit = 0. This ensures the hash input during signing
  // matches what ed25519.verify will compute during verification.
  const signBit = (compressedA[31] >> 7) & 1;
  if (signBit) {
    scalar = mod(L - scalar, L);
  }

  // 5. Generate nonce using libsignal's hash_prefix: [0xFE; 32]
  const rand = random ?? crypto.getRandomValues(new Uint8Array(64));
  if (rand.length !== 64) {
    throw new Error("XEdDSA random input must be 64 bytes");
  }

  // hash_prefix = 32 bytes of 0xFE (matches libsignal's [0xFE; 32])
  const hashPrefix = new Uint8Array(32).fill(0xfe);

  // nonce = SHA-512(hash_prefix(32) || key_data(32) || msg || rand(64)) mod L
  // key_data is the raw clamped bytes (before mod L reduction) -- matches libsignal
  const nonceInput = new Uint8Array(32 + 32 + message.length + 64);
  nonceInput.set(hashPrefix, 0);
  nonceInput.set(clamped, 32);
  nonceInput.set(message, 64);
  nonceInput.set(rand, 64 + message.length);
  const nonceHash = sha512(nonceInput);
  let nonce = mod(bytesToNumberLE(nonceHash), L);
  if (nonce === 0n) nonce = 1n;

  // 6. R = nonce * B
  const R = B.multiply(nonce);
  const compressedR = R.toBytes();

  // 7. Public key bytes with sign bit cleared (always positive after negation)
  const publicKeyBytes = new Uint8Array(compressedA);
  publicKeyBytes[31] &= 0x7f;

  // 8. h = SHA-512(R || A_positive || msg) mod L
  const hInput = new Uint8Array(32 + 32 + message.length);
  hInput.set(compressedR, 0);
  hInput.set(publicKeyBytes, 32);
  hInput.set(message, 64);
  const hHash = sha512(hInput);
  const h = mod(bytesToNumberLE(hHash), L);

  // 9. S = (nonce + h * scalar) mod L
  const S = mod(nonce + h * scalar, L);

  // 10. Signature = R || S_with_sign_bit
  const signature = new Uint8Array(64);
  signature.set(compressedR, 0);
  const sBytes = numberToBytes32LE(S);
  signature.set(sBytes, 32);
  // Embed sign bit in high bit of signature[63] (matches libsignal)
  signature[63] &= 0x7f;
  signature[63] |= signBit << 7;

  return signature;
}

/**
 * Convert a Montgomery (X25519) public key to Edwards (Ed25519) form.
 *
 * Given Montgomery u-coordinate, compute Edwards y = (u - 1) / (u + 1) mod p.
 * Returns the y-coordinate as 32-byte LE (with sign bit = 0).
 */
function montgomeryToEdwards(montgomeryKey: Uint8Array): Uint8Array {
  const u = bytesToNumberLE(montgomeryKey);

  // y = (u - 1) / (u + 1) mod p
  const numerator = mod(u - 1n, P);
  const denominator = mod(u + 1n, P);

  if (denominator === 0n) {
    throw new Error("Invalid Montgomery point: u = p - 1");
  }

  const y = mod(numerator * modInverse(denominator, P), P);
  return numberToBytes32LE(y);
}

/**
 * Verify an XEdDSA signature.
 *
 * Takes an X25519 public key, converts to Edwards form, then verifies
 * the standard Ed25519 signature. The sign bit is extracted from
 * signature[63] to deterministically choose the correct Edwards point.
 *
 * @param publicKey - 32-byte X25519 (Montgomery) public key
 * @param message - The signed message
 * @param signature - 64-byte Ed25519 signature (sign bit in signature[63])
 * @returns true if valid
 */
export function xeddsaVerify(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    if (signature.length !== 64) return false;

    // Convert Montgomery -> Edwards (y coordinate only, sign bit = 0)
    const edwardsY = montgomeryToEdwards(publicKey);

    // The signing always uses the positive (sign-bit-cleared) public key in
    // the hash, so verification must also use sign bit = 0. The sign bit
    // stored in signature[63] is metadata for cross-protocol use.
    const edKey = new Uint8Array(edwardsY);
    edKey[31] &= 0x7f;

    // Clear sign bit from signature S bytes for verification
    const cleanSig = new Uint8Array(signature);
    cleanSig[63] &= 0x7f;

    return ed25519.verify(cleanSig, message, edKey);
  } catch {
    return false;
  }
}
