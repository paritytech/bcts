/**
 * XEdDSA: Sign with X25519 keys using Edwards-curve operations.
 *
 * XEdDSA converts an X25519 (Montgomery) key pair to Ed25519 (Edwards)
 * internally, then produces standard Ed25519 signatures. This lets the
 * Signal Protocol use a single X25519 key for both DH and signing.
 *
 * This implementation matches libsignal's curve25519.rs EXACTLY, including
 * the deviation from the XEdDSA paper where the scalar is NOT negated and
 * the full compressed Edwards key (with native sign bit) is used in the hash.
 *
 * Reference: libsignal/rust/core/src/curve/curve25519.rs
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
 * Hash prefix for XEdDSA nonce generation.
 *
 * libsignal uses [0xFE, 0xFF, 0xFF, ..., 0xFF] (1 byte 0xFE + 31 bytes 0xFF).
 * Reference: libsignal/rust/core/src/curve/curve25519.rs lines 76-79
 */
const HASH_PREFIX = new Uint8Array([
  0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
]);

/**
 * Sign a message using XEdDSA.
 *
 * Takes an X25519 private key and produces an Ed25519 signature.
 * Matches libsignal's curve25519.rs calculate_signature() exactly.
 *
 * Key difference from the XEdDSA paper: the scalar is NOT negated when the
 * sign bit is set. Instead, the full compressed Edwards key (with its native
 * sign bit) is used in the challenge hash, and the sign bit is stored in
 * signature[63] for the verifier. This matches libsignal-protocol-java's
 * behavior.
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
  // 1. Clamp the private key (matches libsignal's scalar::clamp_integer)
  const clamped = clampPrivateKey(privateKey);

  // 2. Compute scalar mod L (matches Scalar::from_bytes_mod_order(key_data))
  let scalar = mod(bytesToNumberLE(clamped), L);
  if (scalar === 0n) scalar = 1n;

  // 3. Compute the Edwards public key: A = scalar * B
  const A = B.multiply(scalar);
  const compressedA = A.toBytes();

  // 4. Record the sign bit. Unlike the XEdDSA paper, we do NOT negate the
  //    scalar. The sign bit is just stored in the signature for the verifier.
  //    This matches libsignal's implementation.
  const signBit = (compressedA[31] >> 7) & 1;

  // 5. Generate nonce: SHA-512(hash_prefix || key_data || message || random)
  const rand = random ?? crypto.getRandomValues(new Uint8Array(64));
  if (rand.length !== 64) {
    throw new Error("XEdDSA random input must be 64 bytes");
  }

  const nonceInput = new Uint8Array(32 + 32 + message.length + 64);
  nonceInput.set(HASH_PREFIX, 0);
  nonceInput.set(clamped, 32);
  nonceInput.set(message, 64);
  nonceInput.set(rand, 64 + message.length);
  const nonceHash = sha512(nonceInput);
  let nonce = mod(bytesToNumberLE(nonceHash), L);
  if (nonce === 0n) nonce = 1n;

  // 6. R = nonce * B
  const R = B.multiply(nonce);
  const compressedR = R.toBytes();

  // 7. h = SHA-512(R || A || msg) mod L
  //    Uses the FULL compressed A (with native sign bit), NOT sign-cleared.
  //    This matches libsignal exactly.
  const hInput = new Uint8Array(32 + 32 + message.length);
  hInput.set(compressedR, 0);
  hInput.set(compressedA, 32);
  hInput.set(message, 64);
  const hHash = sha512(hInput);
  const h = mod(bytesToNumberLE(hHash), L);

  // 8. s = (h * a) + r mod L — matches libsignal's `let s = (h * a) + r`
  const S = mod(h * scalar + nonce, L);

  // 9. Signature = R || S, with sign bit embedded in signature[63]
  const signature = new Uint8Array(64);
  signature.set(compressedR, 0);
  const sBytes = numberToBytes32LE(S);
  signature.set(sBytes, 32);
  signature[63] &= 0x7f;
  signature[63] |= signBit << 7;

  return signature;
}

/**
 * Convert a Montgomery (X25519) public key to Edwards (Ed25519) y-coordinate.
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
 * Takes an X25519 public key, converts to Edwards form using the sign bit
 * embedded in signature[63], then verifies the standard Ed25519 signature.
 *
 * Matches libsignal's verify_signature() which uses:
 *   mont_point.to_edwards(sign_bit_from_signature)
 * to recover the correct Edwards point, then delegates to standard Ed25519
 * verification.
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

    // 1. Extract sign bit from signature[63] (matches libsignal)
    const signBit = (signature[63] >> 7) & 1;

    // 2. Convert Montgomery -> Edwards y-coordinate
    const edwardsY = montgomeryToEdwards(publicKey);

    // 3. Set the sign bit on the Edwards key from the signature.
    //    libsignal uses mont_point.to_edwards(sign_bit) which returns the
    //    Edwards point with the specified x-parity. We achieve the same by
    //    setting bit 255 of the compressed y-coordinate.
    const edKey = new Uint8Array(edwardsY);
    edKey[31] = (edKey[31] & 0x7f) | (signBit << 7);

    // 4. Clear sign bit from signature S bytes for verification
    const cleanSig = new Uint8Array(signature);
    cleanSig[63] &= 0x7f;

    // 5. Verify using standard Ed25519.
    //    ed25519.verify computes h = SHA-512(R || edKey || msg), which matches
    //    the hash computed during signing (both use the full compressed A
    //    with the correct sign bit).
    return ed25519.verify(cleanSig, message, edKey);
  } catch {
    return false;
  }
}
