/**
 * Supported digital signature schemes.
 *
 * This enum represents the various signature schemes supported in this crate,
 * including Ed25519, SR25519, ECDSA, Schnorr, and SSH-based signatures.
 *
 * Ported from bc-components-rust/src/signing/signature_scheme.rs
 */

import { type SecureRandomNumberGenerator } from "@bcts/rand";
import { Ed25519PrivateKey } from "../ed25519/ed25519-private-key.js";
import { Sr25519PrivateKey } from "../sr25519/sr25519-private-key.js";
import { ECPrivateKey } from "../ec-key/ec-private-key.js";
import { SigningPrivateKey } from "./signing-private-key.js";
import type { SigningPublicKey } from "./signing-public-key.js";
import { CryptoError } from "../error.js";

/**
 * Supported digital signature schemes.
 *
 * This enum represents the various signature schemes supported in this package.
 * - Schnorr: BIP-340 Schnorr signature scheme (secp256k1) - discriminator 0
 * - ECDSA: ECDSA signature scheme (secp256k1) - discriminator 1
 * - Ed25519: RFC 8032 signatures - discriminator 2
 * - Sr25519: Schnorr over Ristretto25519, used by Polkadot/Substrate - discriminator 3
 * - SshEd25519: Ed25519 via SSH agent
 * - SshDsa: DSA via SSH agent
 * - SshEcdsaP256: ECDSA P-256 via SSH agent
 * - SshEcdsaP384: ECDSA P-384 via SSH agent
 */
export enum SignatureScheme {
  /**
   * BIP-340 Schnorr signature scheme (secp256k1)
   * Default scheme for secp256k1 keys
   */
  Schnorr = "Schnorr",

  /**
   * ECDSA signature scheme (secp256k1)
   */
  Ecdsa = "Ecdsa",

  /**
   * Ed25519 signature scheme (RFC 8032)
   */
  Ed25519 = "Ed25519",

  /**
   * SR25519 signature scheme (Schnorr over Ristretto25519)
   * Used by Polkadot/Substrate
   */
  Sr25519 = "Sr25519",

  /**
   * Ed25519 signature via SSH agent.
   * Requires SSH agent daemon support.
   */
  SshEd25519 = "SshEd25519",

  /**
   * DSA signature via SSH agent.
   * Requires SSH agent daemon support.
   */
  SshDsa = "SshDsa",

  /**
   * ECDSA P-256 signature via SSH agent.
   * Requires SSH agent daemon support.
   */
  SshEcdsaP256 = "SshEcdsaP256",

  /**
   * ECDSA P-384 signature via SSH agent.
   * Requires SSH agent daemon support.
   */
  SshEcdsaP384 = "SshEcdsaP384",
}

/**
 * Get the default signature scheme.
 * Defaults to Ed25519 for maximum compatibility.
 */
export function defaultSignatureScheme(): SignatureScheme {
  return SignatureScheme.Ed25519;
}

/**
 * Check if a signature scheme requires SSH agent support.
 *
 * @param scheme - The signature scheme to check
 * @returns true if the scheme requires SSH agent
 */
export function isSshScheme(scheme: SignatureScheme): boolean {
  return (
    scheme === SignatureScheme.SshEd25519 ||
    scheme === SignatureScheme.SshDsa ||
    scheme === SignatureScheme.SshEcdsaP256 ||
    scheme === SignatureScheme.SshEcdsaP384
  );
}

/**
 * Creates a new key pair for the signature scheme.
 *
 * @param scheme - The signature scheme to use
 * @returns A tuple containing a signing private key and its corresponding public key
 * @throws CryptoError for SSH-based schemes which require SSH agent support
 */
export function createKeypair(scheme: SignatureScheme): [SigningPrivateKey, SigningPublicKey] {
  switch (scheme) {
    case SignatureScheme.Schnorr: {
      const ecKey = ECPrivateKey.random();
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.Ecdsa: {
      const ecKey = ECPrivateKey.random();
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.Ed25519: {
      const ed25519Key = Ed25519PrivateKey.random();
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.Sr25519: {
      const sr25519Key = Sr25519PrivateKey.random();
      const privateKey = SigningPrivateKey.newSr25519(sr25519Key);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.SshEd25519:
    case SignatureScheme.SshDsa:
    case SignatureScheme.SshEcdsaP256:
    case SignatureScheme.SshEcdsaP384:
      throw CryptoError.sshAgent(
        `SSH signature scheme ${scheme} requires SSH agent support which is not yet implemented. ` +
          "Use Ed25519, Sr25519, Schnorr, or ECDSA instead.",
      );
  }
}

/**
 * Creates a new key pair for the signature scheme using a provided RNG.
 *
 * @param scheme - The signature scheme to use
 * @param rng - The random number generator to use
 * @returns A tuple containing a signing private key and its corresponding public key
 * @throws CryptoError for SSH-based schemes which require SSH agent support
 */
export function createKeypairUsing(
  scheme: SignatureScheme,
  rng: SecureRandomNumberGenerator,
): [SigningPrivateKey, SigningPublicKey] {
  switch (scheme) {
    case SignatureScheme.Schnorr: {
      const ecKey = ECPrivateKey.newUsing(rng);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.Ecdsa: {
      const ecKey = ECPrivateKey.newUsing(rng);
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.Ed25519: {
      const ed25519Key = Ed25519PrivateKey.randomUsing(rng);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.Sr25519: {
      const sr25519Key = Sr25519PrivateKey.randomUsing(rng);
      const privateKey = SigningPrivateKey.newSr25519(sr25519Key);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.SshEd25519:
    case SignatureScheme.SshDsa:
    case SignatureScheme.SshEcdsaP256:
    case SignatureScheme.SshEcdsaP384:
      throw CryptoError.sshAgent(
        `SSH signature scheme ${scheme} requires SSH agent support which is not yet implemented. ` +
          "Use Ed25519, Sr25519, Schnorr, or ECDSA instead.",
      );
  }
}
