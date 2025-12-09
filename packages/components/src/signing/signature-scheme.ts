/**
 * Supported digital signature schemes.
 *
 * This enum represents the various signature schemes supported in this crate,
 * currently limited to Ed25519 signatures.
 *
 * Ported from bc-components-rust/src/signing/signature_scheme.rs
 */

import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";
import { Ed25519PrivateKey } from "../ed25519/ed25519-private-key.js";
import type { SigningPrivateKey } from "./signing-private-key.js";
import type { SigningPublicKey } from "./signing-public-key.js";

/**
 * Supported digital signature schemes.
 *
 * This enum represents the various signature schemes supported in this package.
 * Currently, only Ed25519 is implemented.
 */
export enum SignatureScheme {
  /**
   * Ed25519 signature scheme (RFC 8032)
   */
  Ed25519 = "Ed25519",
}

/**
 * Get the default signature scheme.
 */
export function defaultSignatureScheme(): SignatureScheme {
  return SignatureScheme.Ed25519;
}

/**
 * Creates a new key pair for the signature scheme.
 *
 * @param scheme - The signature scheme to use
 * @returns A tuple containing a signing private key and its corresponding public key
 */
export function createKeypair(
  scheme: SignatureScheme,
): [SigningPrivateKey, SigningPublicKey] {
  // Import dynamically to avoid circular dependency
  const { SigningPrivateKey } = require("./signing-private-key.js");

  switch (scheme) {
    case SignatureScheme.Ed25519: {
      const ed25519Key = Ed25519PrivateKey.random();
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
  }
}

/**
 * Creates a new key pair for the signature scheme using a provided RNG.
 *
 * @param scheme - The signature scheme to use
 * @param rng - The random number generator to use
 * @returns A tuple containing a signing private key and its corresponding public key
 */
export function createKeypairUsing(
  scheme: SignatureScheme,
  rng: SecureRandomNumberGenerator,
): [SigningPrivateKey, SigningPublicKey] {
  // Import dynamically to avoid circular dependency
  const { SigningPrivateKey } = require("./signing-private-key.js");

  switch (scheme) {
    case SignatureScheme.Ed25519: {
      const ed25519Key = Ed25519PrivateKey.randomUsing(rng);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
  }
}
