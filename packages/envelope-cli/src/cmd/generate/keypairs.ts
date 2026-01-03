/**
 * Generate keypairs command - 1:1 port of cmd/generate/keypairs.rs
 *
 * Generate keypairs.
 * Generates random keypairs, outputting both the private keys
 * (ur:crypto-prvkeys) and public keys (ur:crypto-pubkeys) on the same line
 * separated by a space. Supports post-quantum algorithms (ML-DSA, ML-KEM)
 * that don't support deterministic key derivation.
 */

import { SignatureScheme, EncapsulationScheme, PrivateKeys, PublicKeys } from "@bcts/components";
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
    signing: SigningScheme.Schnorr,
    encryption: EncryptionScheme.X25519,
  };
}

/**
 * Map signing scheme arg to SignatureScheme.
 */
function getSignatureScheme(scheme: SigningScheme): SignatureScheme {
  switch (scheme) {
    case SigningScheme.Schnorr:
      return SignatureScheme.Schnorr;
    case SigningScheme.Ecdsa:
      return SignatureScheme.Ecdsa;
    case SigningScheme.Ed25519:
      return SignatureScheme.Ed25519;
    case SigningScheme.SshEd25519:
      return SignatureScheme.SshEd25519;
    case SigningScheme.SshDsa:
      return SignatureScheme.SshDsa;
    case SigningScheme.SshEcdsaP256:
      return SignatureScheme.SshEcdsaP256;
    case SigningScheme.SshEcdsaP384:
      return SignatureScheme.SshEcdsaP384;
    case SigningScheme.Mldsa44:
      return SignatureScheme.MLDSA44;
    case SigningScheme.Mldsa65:
      return SignatureScheme.MLDSA65;
    case SigningScheme.Mldsa87:
      return SignatureScheme.MLDSA87;
  }
}

/**
 * Map encryption scheme arg to EncapsulationScheme.
 */
function getEncapsulationScheme(scheme: EncryptionScheme): EncapsulationScheme {
  switch (scheme) {
    case EncryptionScheme.X25519:
      return EncapsulationScheme.X25519;
    case EncryptionScheme.Mlkem512:
      return EncapsulationScheme.MLKEM512;
    case EncryptionScheme.Mlkem768:
      return EncapsulationScheme.MLKEM768;
    case EncryptionScheme.Mlkem1024:
      return EncapsulationScheme.MLKEM1024;
  }
}

/**
 * Keypairs command implementation.
 */
export class KeypairsCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const sigScheme = getSignatureScheme(this.args.signing);
    const encScheme = getEncapsulationScheme(this.args.encryption);

    const [signingPrivateKey, signingPublicKey] = sigScheme.keypair();
    const [encapsulationPrivateKey, encapsulationPublicKey] = encScheme.keypair();

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
