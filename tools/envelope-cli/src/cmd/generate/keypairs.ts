/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Generate keypairs command - 1:1 port of cmd/generate/keypairs.rs
 *
 * Generate keypairs.
 * Generates random keypairs, outputting both the private keys
 * (ur:crypto-prvkeys) and public keys (ur:crypto-pubkeys) on the same line
 * separated by a space. Supports post-quantum algorithms (ML-DSA, ML-KEM)
 * that don't support deterministic key derivation.
 *
 * NOTE: Some signature schemes are not yet fully implemented:
 * - SSH key variants (ssh-ed25519, ssh-dsa, ssh-ecdsa-*)
 * - MLDSA variants (mldsa44, mldsa65, mldsa87)
 * - MLKEM variants (mlkem512, mlkem768, mlkem1024)
 */

import {
  PrivateKeys,
  PublicKeys,
  SigningPrivateKey,
  EncapsulationPrivateKey,
  type EncapsulationPublicKey,
} from "@bcts/components";
import type { Exec } from "../../exec.js";

/**
 * Supported signature schemes for keypair generation.
 */
export enum SigningScheme {
  Schnorr = "schnorr",
  Ecdsa = "ecdsa",
  Ed25519 = "ed25519",
  SshEd25519 = "ssh-ed25519",
  SshDsa = "ssh-dsa",
  SshEcdsaP256 = "ssh-ecdsa-p256",
  SshEcdsaP384 = "ssh-ecdsa-p384",
  Mldsa44 = "mldsa44",
  Mldsa65 = "mldsa65",
  Mldsa87 = "mldsa87",
}

/**
 * Supported encapsulation schemes for keypair generation.
 */
export enum EncryptionScheme {
  X25519 = "x25519",
  Mlkem512 = "mlkem512",
  Mlkem768 = "mlkem768",
  Mlkem1024 = "mlkem1024",
}

/**
 * Command arguments for the keypairs command.
 */
export interface CommandArgs {
  /** The signature scheme to use for the signing key */
  signing: SigningScheme;
  /** The encapsulation scheme to use for the encryption key */
  encryption: EncryptionScheme;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    signing: SigningScheme.Ed25519,
    encryption: EncryptionScheme.X25519,
  };
}

/**
 * Generate a signing keypair for the given scheme.
 */
function generateSigningKeypair(
  scheme: SigningScheme,
): [SigningPrivateKey, SigningPrivateKey["publicKey"] extends () => infer R ? R : never] {
  switch (scheme) {
    case SigningScheme.Ed25519:
    case SigningScheme.SshEd25519: {
      // SigningPrivateKey.random() generates an Ed25519 key by default
      const signingPrivate = SigningPrivateKey.random();
      const signingPublic = signingPrivate.publicKey();
      return [signingPrivate, signingPublic];
    }
    case SigningScheme.Schnorr: {
      const signingPrivate = SigningPrivateKey.randomSchnorr();
      const signingPublic = signingPrivate.publicKey();
      return [signingPrivate, signingPublic];
    }
    case SigningScheme.Ecdsa: {
      const signingPrivate = SigningPrivateKey.randomEcdsa();
      const signingPublic = signingPrivate.publicKey();
      return [signingPrivate, signingPublic];
    }
    case SigningScheme.SshDsa:
    case SigningScheme.SshEcdsaP256:
    case SigningScheme.SshEcdsaP384:
    case SigningScheme.Mldsa44:
    case SigningScheme.Mldsa65:
    case SigningScheme.Mldsa87:
      throw new Error(`Signing scheme '${scheme}' is not yet implemented for keypair generation.`);
  }
}

/**
 * Generate an encapsulation keypair for the given scheme.
 */
function generateEncapsulationKeypair(
  scheme: EncryptionScheme,
): [EncapsulationPrivateKey, EncapsulationPublicKey] {
  switch (scheme) {
    case EncryptionScheme.X25519: {
      // EncapsulationPrivateKey.new() generates an X25519 key
      const encapsPrivate = EncapsulationPrivateKey.new();
      const encapsPublic = encapsPrivate.publicKey();
      return [encapsPrivate, encapsPublic];
    }
    case EncryptionScheme.Mlkem512:
    case EncryptionScheme.Mlkem768:
    case EncryptionScheme.Mlkem1024:
      throw new Error(
        `Encryption scheme '${scheme}' is not yet implemented for keypair generation.`,
      );
  }
}

/**
 * Keypairs command implementation.
 */
export class KeypairsCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const [signingPrivateKey, signingPublicKey] = generateSigningKeypair(this.args.signing);
    const [encapsulationPrivateKey, encapsulationPublicKey] = generateEncapsulationKeypair(
      this.args.encryption,
    );

    const privateKeys = PrivateKeys.withKeys(signingPrivateKey, encapsulationPrivateKey);
    const publicKeys = PublicKeys.new(signingPublicKey, encapsulationPublicKey);

    return `${privateKeys.urString()} ${publicKeys.urString()}`;
  }
}

/**
 * Execute the keypairs command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new KeypairsCommand(args).exec();
}
