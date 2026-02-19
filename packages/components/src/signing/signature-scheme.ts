/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Supported digital signature schemes.
 *
 * This enum represents the various signature schemes supported in this crate,
 * including Ed25519, SR25519, ECDSA, Schnorr, post-quantum ML-DSA, and SSH-based signatures.
 *
 * Ported from bc-components-rust/src/signing/signature_scheme.rs
 */

import { type SecureRandomNumberGenerator, type RandomNumberGenerator } from "@bcts/rand";
import { Ed25519PrivateKey } from "../ed25519/ed25519-private-key.js";
import { Sr25519PrivateKey } from "../sr25519/sr25519-private-key.js";
import { ECPrivateKey } from "../ec-key/ec-private-key.js";
import { MLDSAPrivateKey } from "../mldsa/mldsa-private-key.js";
import { MLDSALevel } from "../mldsa/mldsa-level.js";
import { SigningPrivateKey } from "./signing-private-key.js";
import type { SigningPublicKey } from "./signing-public-key.js";
import { CryptoError } from "../error.js";

/**
 * Supported digital signature schemes.
 *
 * This enum represents the various signature schemes supported in this package.
 * - Schnorr: BIP-340 Schnorr signature scheme (secp256k1) - DEFAULT
 * - ECDSA: ECDSA signature scheme (secp256k1)
 * - Ed25519: RFC 8032 signatures
 * - Sr25519: Schnorr over Ristretto25519, used by Polkadot/Substrate
 * - MLDSA44: ML-DSA44 post-quantum signature scheme (NIST level 2)
 * - MLDSA65: ML-DSA65 post-quantum signature scheme (NIST level 3)
 * - MLDSA87: ML-DSA87 post-quantum signature scheme (NIST level 5)
 * - SshEd25519: Ed25519 via SSH agent
 * - SshDsa: DSA via SSH agent
 * - SshEcdsaP256: ECDSA P-256 via SSH agent
 * - SshEcdsaP384: ECDSA P-384 via SSH agent
 */
export enum SignatureScheme {
  /**
   * BIP-340 Schnorr signature scheme (secp256k1)
   * Default scheme (matching Rust bc-components default when secp256k1 is enabled)
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
   * ML-DSA44 post-quantum signature scheme (NIST level 2)
   */
  MLDSA44 = "MLDSA44",

  /**
   * ML-DSA65 post-quantum signature scheme (NIST level 3)
   */
  MLDSA65 = "MLDSA65",

  /**
   * ML-DSA87 post-quantum signature scheme (NIST level 5)
   */
  MLDSA87 = "MLDSA87",

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
 * Defaults to Schnorr (matching Rust bc-components default when secp256k1 is enabled).
 */
export function defaultSignatureScheme(): SignatureScheme {
  return SignatureScheme.Schnorr;
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
 * Check if a signature scheme is a post-quantum ML-DSA scheme.
 *
 * @param scheme - The signature scheme to check
 * @returns true if the scheme is an ML-DSA scheme
 */
export function isMldsaScheme(scheme: SignatureScheme): boolean {
  return (
    scheme === SignatureScheme.MLDSA44 ||
    scheme === SignatureScheme.MLDSA65 ||
    scheme === SignatureScheme.MLDSA87
  );
}

/**
 * Options for configuring signature creation.
 *
 * Different signature schemes may require specific options:
 * - Schnorr: Optionally accepts a custom random number generator
 * - Ssh: Requires a namespace and hash algorithm
 *
 * Other signature types like ECDSA, Ed25519, Sr25519, and ML-DSA don't require options.
 */
export type SigningOptions =
  | {
      type: "Schnorr";
      /** Custom random number generator for signature creation */
      rng: RandomNumberGenerator;
    }
  | {
      type: "Ssh";
      /** The namespace used for SSH signatures */
      namespace: string;
      /** The hash algorithm used for SSH signatures */
      hashAlg: "sha256" | "sha512";
    };

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
    case SignatureScheme.MLDSA44: {
      const mldsaKey = MLDSAPrivateKey.new(MLDSALevel.MLDSA44);
      const privateKey = SigningPrivateKey.newMldsa(mldsaKey);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.MLDSA65: {
      const mldsaKey = MLDSAPrivateKey.new(MLDSALevel.MLDSA65);
      const privateKey = SigningPrivateKey.newMldsa(mldsaKey);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.MLDSA87: {
      const mldsaKey = MLDSAPrivateKey.new(MLDSALevel.MLDSA87);
      const privateKey = SigningPrivateKey.newMldsa(mldsaKey);
      const publicKey = privateKey.publicKey();
      return [privateKey, publicKey];
    }
    case SignatureScheme.SshEd25519:
    case SignatureScheme.SshDsa:
    case SignatureScheme.SshEcdsaP256:
    case SignatureScheme.SshEcdsaP384:
      throw CryptoError.sshAgent(
        `SSH signature scheme ${scheme} requires SSH agent support which is not yet implemented. ` +
          "Use Ed25519, Sr25519, Schnorr, ECDSA, or MLDSA variants instead.",
      );
  }
}

/**
 * Creates a new key pair for the signature scheme using a provided RNG.
 *
 * @param scheme - The signature scheme to use
 * @param rng - The random number generator to use
 * @returns A tuple containing a signing private key and its corresponding public key
 * @throws CryptoError for SSH-based schemes or MLDSA (which doesn't support deterministic generation)
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
    case SignatureScheme.MLDSA44:
    case SignatureScheme.MLDSA65:
    case SignatureScheme.MLDSA87:
      // ML-DSA doesn't support deterministic generation with custom RNG (matching Rust behavior)
      throw CryptoError.general(
        `Deterministic keypair generation not supported for ${scheme}. Use createKeypair() instead.`,
      );
    case SignatureScheme.SshEd25519:
    case SignatureScheme.SshDsa:
    case SignatureScheme.SshEcdsaP256:
    case SignatureScheme.SshEcdsaP384:
      throw CryptoError.sshAgent(
        `SSH signature scheme ${scheme} requires SSH agent support which is not yet implemented. ` +
          "Use Ed25519, Sr25519, Schnorr, ECDSA, or MLDSA variants instead.",
      );
  }
}
