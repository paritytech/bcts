/**
 * Identity key types for the Signal Protocol.
 *
 * Signal serializes public keys as [0x05, ...32_byte_key] (33 bytes).
 * Identity keys use X25519 natively -- XEdDSA for signing, raw DH for agreement.
 *
 * Reference: libsignal/rust/protocol/src/identity_key.rs
 */

import { x25519 } from "@noble/curves/ed25519.js";
import type { RandomNumberGenerator } from "@bcts/rand";
import { InvalidKeyError } from "../error.js";
import { KEY_TYPE_DJB } from "../constants.js";
import { KeyPair } from "./key-pair.js";
import { xeddsaSign, xeddsaVerify } from "../crypto/xeddsa.js";
import { constantTimeEqual } from "../crypto/constant-time.js";

/**
 * Known X25519 low-order / torsion points (Montgomery form).
 * These points are rejected during key construction to match
 * libsignal's is_torsion_free() check.
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
 * Check if a key is a known low-order / torsion point.
 * Checks against all known Montgomery-form torsion points.
 */
function isLowOrderPoint(key: Uint8Array): boolean {
  for (const lowOrder of LOW_ORDER_POINTS) {
    if (key.length === lowOrder.length) {
      let equal = true;
      for (let i = 0; i < key.length; i++) {
        if (key[i] !== lowOrder[i]) {
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
 * Domain separation prefixes for alternate identity (PNI) signatures.
 * Matches libsignal's ALTERNATE_IDENTITY_SIGNATURE_PREFIX_1 and _2.
 *
 * Reference: libsignal/rust/protocol/src/identity_key.rs
 */
const ALTERNATE_IDENTITY_SIGNATURE_PREFIX_1 = new Uint8Array(32).fill(0xff);
const ALTERNATE_IDENTITY_SIGNATURE_PREFIX_2 = new TextEncoder().encode("Signal_PNI_Signature");

export class IdentityKey {
  readonly publicKey: Uint8Array;

  constructor(publicKey: Uint8Array) {
    if (publicKey.length !== 32) {
      throw new InvalidKeyError("Identity public key must be 32 bytes");
    }
    if (isLowOrderPoint(publicKey)) {
      throw new InvalidKeyError("Identity public key is a low-order point");
    }
    this.publicKey = publicKey;
  }

  /**
   * Serialize with 0x05 type prefix (33 bytes) -- Signal wire format.
   */
  serialize(): Uint8Array {
    const result = new Uint8Array(33);
    result[0] = KEY_TYPE_DJB;
    result.set(this.publicKey, 1);
    return result;
  }

  /**
   * Deserialize from 33-byte wire format (0x05 prefix + 32-byte key).
   * Strict: only accepts 33-byte format with 0x05 prefix.
   */
  static deserialize(data: Uint8Array): IdentityKey {
    if (data.length === 33 && data[0] === KEY_TYPE_DJB) {
      return new IdentityKey(data.slice(1));
    }
    throw new InvalidKeyError(
      `Invalid identity key: expected 33 bytes with 0x05 prefix, got ${data.length} bytes`,
    );
  }

  equals(other: IdentityKey): boolean {
    return constantTimeEqual(this.publicKey, other.publicKey);
  }

  /**
   * Verify an XEdDSA signature against this X25519 identity key.
   */
  verifySignature(message: Uint8Array, signature: Uint8Array): boolean {
    try {
      return xeddsaVerify(this.publicKey, message, signature);
    } catch {
      return false;
    }
  }

  /**
   * Verify that `other` represents an alternate identity for this user.
   *
   * The signature must have been created by `signAlternateIdentity()` on
   * the corresponding IdentityKeyPair.
   *
   * Reference: libsignal IdentityKey::verify_alternate_identity
   */
  verifyAlternateIdentity(other: IdentityKey, signature: Uint8Array): boolean {
    const message = buildAlternateIdentityMessage(other);
    return this.verifySignature(message, signature);
  }
}

export class IdentityKeyPair {
  readonly identityKey: IdentityKey;
  readonly privateKey: Uint8Array;

  constructor(identityKey: IdentityKey, privateKey: Uint8Array) {
    this.identityKey = identityKey;
    this.privateKey = privateKey;
  }

  /**
   * Generate a new random X25519 identity key pair.
   */
  static generate(rng: RandomNumberGenerator): IdentityKeyPair {
    const privateKey = rng.randomData(32);
    const publicKey = x25519.getPublicKey(privateKey);
    return new IdentityKeyPair(new IdentityKey(publicKey), privateKey);
  }

  /**
   * Sign data with XEdDSA (X25519 key used for Ed25519 signing).
   */
  sign(message: Uint8Array): Uint8Array {
    return xeddsaSign(this.privateKey, message);
  }

  /**
   * Generate a signature claiming that `other` represents the same user as `self`.
   *
   * Reference: libsignal IdentityKeyPair::sign_alternate_identity
   */
  signAlternateIdentity(other: IdentityKey): Uint8Array {
    const message = buildAlternateIdentityMessage(other);
    return this.sign(message);
  }

  /**
   * Create a KeyPair for X25519 agreement from this identity key pair.
   * Since identity keys are already X25519, this is a direct conversion.
   */
  toKeyPair(): KeyPair {
    return new KeyPair(this.privateKey, this.identityKey.publicKey);
  }
}

/**
 * Build the message that is signed / verified for alternate identity signatures.
 *
 * Message format: prefix1 (32x 0xFF) || prefix2 ("Signal_PNI_Signature") || other.serialize()
 *
 * Note: other.serialize() includes the 0x05 type prefix byte (33 bytes), matching
 * libsignal's behavior exactly.
 */
function buildAlternateIdentityMessage(other: IdentityKey): Uint8Array {
  const serialized = other.serialize(); // 33 bytes (0x05 + 32-byte key)
  const message = new Uint8Array(
    ALTERNATE_IDENTITY_SIGNATURE_PREFIX_1.length +
      ALTERNATE_IDENTITY_SIGNATURE_PREFIX_2.length +
      serialized.length,
  );
  let offset = 0;
  message.set(ALTERNATE_IDENTITY_SIGNATURE_PREFIX_1, offset);
  offset += ALTERNATE_IDENTITY_SIGNATURE_PREFIX_1.length;
  message.set(ALTERNATE_IDENTITY_SIGNATURE_PREFIX_2, offset);
  offset += ALTERNATE_IDENTITY_SIGNATURE_PREFIX_2.length;
  message.set(serialized, offset);
  return message;
}

/**
 * Create an alternate identity signature (PNI signature).
 *
 * Signs a claim that `otherIdentityPublicKey` is an alternate identity
 * for the holder of `primaryKeyPair`.
 *
 * @param primaryKeyPair - The primary X25519 key pair (private + public, 32 bytes each)
 * @param otherIdentityPublicKey - The other identity's raw X25519 public key (32 bytes)
 * @returns 64-byte XEdDSA signature
 */
export function createAlternateIdentitySignature(
  primaryKeyPair: { privateKey: Uint8Array; publicKey: Uint8Array },
  otherIdentityPublicKey: Uint8Array,
): Uint8Array {
  const primary = new IdentityKeyPair(
    new IdentityKey(primaryKeyPair.publicKey),
    primaryKeyPair.privateKey,
  );
  const other = new IdentityKey(otherIdentityPublicKey);
  return primary.signAlternateIdentity(other);
}

/**
 * Verify an alternate identity signature (PNI signature).
 *
 * Verifies that `otherIdentityPublicKey` is claimed as an alternate identity
 * for the holder of `primaryIdentityPublicKey`.
 *
 * @param primaryIdentityPublicKey - The primary identity's raw X25519 public key (32 bytes)
 * @param otherIdentityPublicKey - The other identity's raw X25519 public key (32 bytes)
 * @param signature - 64-byte XEdDSA signature from createAlternateIdentitySignature
 * @returns true if the signature is valid
 */
export function verifyAlternateIdentitySignature(
  primaryIdentityPublicKey: Uint8Array,
  otherIdentityPublicKey: Uint8Array,
  signature: Uint8Array,
): boolean {
  try {
    const primary = new IdentityKey(primaryIdentityPublicKey);
    const other = new IdentityKey(otherIdentityPublicKey);
    return primary.verifyAlternateIdentity(other, signature);
  } catch {
    return false;
  }
}
