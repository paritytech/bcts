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

import { PrivateKeyBase, Seed, type PrivateKeys } from "@bcts/components";
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
    signing: SigningScheme.Schnorr,
    encryption: EncryptionScheme.X25519,
  };
}

/**
 * Parse input as PrivateKeyBase.
 * Matches Rust's parse_input() in cmd/generate/prv_keys.rs:
 * 1. Try PrivateKeyBase UR
 * 2. Try Seed UR -> derive PrivateKeyBase via PrivateKeyDataProvider
 */
function parseInput(input: string): PrivateKeyBase {
  // Try parsing as PrivateKeyBase
  try {
    return PrivateKeyBase.fromURString(input);
  } catch {
    // Not a PrivateKeyBase
  }

  // Try parsing as Seed, then derive PrivateKeyBase
  try {
    const seed = Seed.fromURString(input);
    return PrivateKeyBase.fromData(seed.privateKeyData());
  } catch {
    // Not a Seed
  }

  throw new Error(
    "Input must be ur:crypto-prvkey-base or ur:seed.",
  );
}

/**
 * Private keys command implementation.
 */
export class PrvKeysCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const privateKeyBase = this.args.input ? parseInput(this.args.input) : PrivateKeyBase.new();

    let privateKeys: PrivateKeys;
    switch (this.args.signing) {
      case SigningScheme.Ed25519:
        // Ed25519 with X25519 encapsulation - the only fully supported scheme
        privateKeys = privateKeyBase.ed25519PrivateKeys();
        break;

      case SigningScheme.Schnorr:
        privateKeys = privateKeyBase.schnorrPrivateKeys();
        break;

      case SigningScheme.Ecdsa:
        privateKeys = privateKeyBase.ecdsaPrivateKeys();
        break;

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
