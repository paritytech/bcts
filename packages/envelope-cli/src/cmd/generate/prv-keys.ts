/**
 * Generate private keys command - 1:1 port of cmd/generate/prv_keys.rs
 *
 * Generate private keys.
 * Derives private keys from a seed, private key base, or generates them randomly.
 * The input can be a ur:seed, ur:envelope, or ur:crypto-prvkey-base.
 *
 * NOTE: Only Ed25519 signing scheme is currently supported in the TypeScript version.
 * Schnorr, ECDSA, and SSH key schemes require additional implementation in @bcts/components.
 */

import { PrivateKeyBase, type PrivateKeys } from "@bcts/components";
import type { Exec } from "../../exec.js";

/**
 * Supported signature schemes for private key generation.
 */
export enum SigningScheme {
  Schnorr = "schnorr",
  Ecdsa = "ecdsa",
  Ed25519 = "ed25519",
  SshEd25519 = "ssh-ed25519",
  SshDsa = "ssh-dsa",
  SshEcdsaP256 = "ssh-ecdsa-p256",
  SshEcdsaP384 = "ssh-ecdsa-p384",
}

/**
 * Supported encapsulation schemes for private key generation.
 */
export enum EncryptionScheme {
  X25519 = "x25519",
}

/**
 * Command arguments for the prv-keys command.
 */
export interface CommandArgs {
  /** Optional input from which to derive the private keys */
  input?: string;
  /** The signature scheme to use for the signing key */
  signing: SigningScheme;
  /** The encapsulation scheme to use for the encryption key */
  encryption: EncryptionScheme;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    signing: SigningScheme.Ed25519,
    encryption: EncryptionScheme.X25519,
  };
}

/**
 * Parse input as PrivateKeyBase.
 */
function parseInput(input: string): PrivateKeyBase {
  // Try parsing as PrivateKeyBase
  try {
    return PrivateKeyBase.fromURString(input);
  } catch {
    // Not a PrivateKeyBase
  }

  // Note: Seed derivation is not yet implemented
  // The Rust version supports:
  // - ur:seed input with PrivateKeyBase.newWithProvider(seed)
  // - ur:envelope containing a seed
  throw new Error(
    "Only ur:crypto-prvkey-base input is currently supported. " +
      "Seed derivation is not yet implemented in the TypeScript version.",
  );
}

/**
 * Private keys command implementation.
 */
export class PrvKeysCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const privateKeyBase = this.args.input ? parseInput(this.args.input) : PrivateKeyBase.new();

    let privateKeys: PrivateKeys;
    switch (this.args.signing) {
      case SigningScheme.Ed25519:
        // Ed25519 with X25519 encapsulation - the only fully supported scheme
        privateKeys = privateKeyBase.ed25519PrivateKeys();
        break;

      case SigningScheme.Schnorr:
      case SigningScheme.Ecdsa:
        // Not yet implemented - requires schnorrPrivateKeys()/ecdsaPrivateKeys() on PrivateKeyBase
        throw new Error(
          `${this.args.signing} signing scheme is not yet implemented in the TypeScript version. ` +
            "Use --signing ed25519 instead.",
        );

      case SigningScheme.SshEd25519:
      case SigningScheme.SshDsa:
      case SigningScheme.SshEcdsaP256:
      case SigningScheme.SshEcdsaP384:
        // SSH key generation not yet implemented
        throw new Error(
          `SSH ${this.args.signing} key generation is not yet implemented in the TypeScript version. ` +
            "Use --signing ed25519 instead.",
        );
    }

    return privateKeys.urString();
  }
}

/**
 * Execute the prv-keys command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new PrvKeysCommand(args).exec();
}
