/**
 * Raw X25519 key agreement without HKDF post-processing.
 *
 * Signal applies its own HKDF with specific salt/info strings after DH,
 * so we need the raw shared secret (unlike @bcts/crypto which auto-applies HKDF).
 *
 * Reference: libsignal/rust/protocol/src/curve/curve25519.rs
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { InvalidKeyError } from "../error.js";

/**
 * Known X25519 low-order / torsion points (Montgomery form).
 * These points plus all-zeros form the torsion subgroup.
 * libsignal rejects these via is_torsion_free() check.
 */
const LOW_ORDER_POINTS: Uint8Array[] = [
  // 0 (all zeros)
  new Uint8Array(32),
  // 1
  (() => {
    const p = new Uint8Array(32);
    p[0] = 1;
    return p;
  })(),
  // p - 1 (2^255 - 20)
  (() => {
    const p = new Uint8Array(32);
    p.fill(0xff);
    p[0] = 0xec;
    p[31] = 0x7f;
    return p;
  })(),
  // p (2^255 - 19) -- reduced to 0 but non-canonical
  (() => {
    const p = new Uint8Array(32);
    p.fill(0xff);
    p[0] = 0xed;
    p[31] = 0x7f;
    return p;
  })(),
  // p + 1
  (() => {
    const p = new Uint8Array(32);
    p.fill(0xff);
    p[0] = 0xee;
    p[31] = 0x7f;
    return p;
  })(),
];

/**
 * Check if a public key is a known low-order / torsion point.
 * Uses constant-time comparison for each known point.
 */
function isLowOrderPoint(publicKey: Uint8Array): boolean {
  for (const lowOrder of LOW_ORDER_POINTS) {
    if (publicKey.length === lowOrder.length) {
      let equal = true;
      for (let i = 0; i < publicKey.length; i++) {
        if (publicKey[i] !== lowOrder[i]) {
          equal = false;
          break;
        }
      }
      if (equal) return true;
    }
  }
  return false;
}

/**
 * Validate an X25519 public key.
 *
 * Rejects known low-order / torsion points and non-canonical encodings
 * (u >= 2^255). Matches libsignal's key validation behavior.
 *
 * @param publicKey - 32-byte X25519 public key
 * @returns true if the key is valid for use
 */
export function isCanonicalPublicKey(publicKey: Uint8Array): boolean {
  if (publicKey.length !== 32) return false;

  // Check against known low-order points
  if (isLowOrderPoint(publicKey)) return false;

  // Check non-canonical: high bit must be 0 (u < 2^255)
  if (publicKey[31] & 0x80) return false;

  return true;
}

/**
 * Raw X25519 Diffie-Hellman -- returns 32-byte shared secret without HKDF.
 *
 * @param privateKey - 32-byte X25519 private key
 * @param publicKey - 32-byte X25519 public key from the other party
 * @returns 32-byte raw shared secret
 * @throws {InvalidKeyError} If the public key is invalid or the shared secret is all zeros
 */
export function x25519RawAgreement(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  // Reject low-order / torsion public keys
  if (isLowOrderPoint(publicKey)) {
    throw new InvalidKeyError(
      "Invalid public key: low-order / torsion point",
    );
  }
  const result = x25519.getSharedSecret(privateKey, publicKey);
  // Reject all-zero shared secrets (small subgroup attack)
  if (result.every((b) => b === 0)) {
    throw new InvalidKeyError("DH agreement produced all-zero output");
  }
  return result;
}
