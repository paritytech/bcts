// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * X25519 key pair for the Signal Protocol.
 *
 * Reference: libsignal/rust/protocol/src/curve/curve25519.rs
 */

import { x25519 } from "@noble/curves/ed25519.js";
import type { RandomNumberGenerator } from "@bcts/rand";
import { x25519RawAgreement } from "../crypto/agreement.js";

/**
 * Clamp an X25519 private key per RFC 7748.
 * libsignal clamps on creation for compatibility.
 */
function clampX25519(key: Uint8Array): Uint8Array {
  const clamped = new Uint8Array(key);
  clamped[0] &= 248;
  clamped[31] &= 127;
  clamped[31] |= 64;
  return clamped;
}

export class KeyPair {
  readonly privateKey: Uint8Array;
  readonly publicKey: Uint8Array;

  constructor(privateKey: Uint8Array, publicKey: Uint8Array) {
    this.privateKey = clampX25519(privateKey);
    this.publicKey = publicKey;
  }

  /**
   * Generate a new random X25519 key pair.
   */
  static generate(rng: RandomNumberGenerator): KeyPair {
    const privateKey = rng.randomData(32);
    const publicKey = x25519.getPublicKey(privateKey);
    return new KeyPair(privateKey, publicKey);
  }

  /**
   * Create a key pair from a private key, deriving the public key.
   */
  static fromPrivateKey(privateKey: Uint8Array): KeyPair {
    const publicKey = x25519.getPublicKey(privateKey);
    return new KeyPair(privateKey, publicKey);
  }

  /**
   * Perform raw X25519 Diffie-Hellman agreement.
   * Returns the raw 32-byte shared secret (no HKDF post-processing).
   */
  calculateAgreement(theirPublicKey: Uint8Array): Uint8Array {
    return x25519RawAgreement(this.privateKey, theirPublicKey);
  }
}
