/**
 * Generate private keys command - 1:1 port of cmd/generate/prv_keys.rs
 *
 * Generate private keys.
 * Derives private keys from a seed, private key base, or generates them randomly.
 * The input can be a ur:seed, ur:envelope, or ur:crypto-prvkey-base.
 */

import { Envelope } from "@bcts/envelope";
import { PrivateKeyBase, Seed, PrivateKeys, EncapsulationPrivateKey } from "@bcts/components";
import { NAME, NOTE, DATE, SEED_TYPE } from "@bcts/known-values";
import { CborDate } from "@bcts/dcbor";
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
 * Parse input as PrivateKeyBase, Seed, or Envelope containing Seed.
 */
function parseInput(input: string): PrivateKeyBase {
  // Try parsing as PrivateKeyBase first
  try {
    return PrivateKeyBase.fromUrString(input);
  } catch {
    // Not a PrivateKeyBase
  }

  // Try parsing as Seed
  try {
    const seed = Seed.fromUrString(input);
    return PrivateKeyBase.newWithProvider(seed);
  } catch {
    // Not a Seed
  }

  // Try parsing as Envelope containing a Seed
  return PrivateKeyBase.newWithProvider(seedFromEnvelope(input));
}

/**
 * Extract Seed from an Envelope.
 */
function seedFromEnvelope(input: string): Seed {
  const envelope = Envelope.fromUrString(input);
  envelope.checkTypeValue(SEED_TYPE);

  const data = envelope.subject().expectLeaf().expectByteString();
  const name = envelope.extractOptionalObjectForPredicate<string>(NAME) ?? "";
  const note = envelope.extractOptionalObjectForPredicate<string>(NOTE) ?? "";
  const creationDate = envelope.extractOptionalObjectForPredicate<CborDate>(DATE);

  return Seed.newOpt(data, name || undefined, note || undefined, creationDate);
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
      case SigningScheme.Schnorr:
        privateKeys = privateKeyBase.schnorrPrivateKeys();
        break;
      case SigningScheme.Ecdsa:
        privateKeys = privateKeyBase.ecdsaPrivateKeys();
        break;
      case SigningScheme.Ed25519:
        privateKeys = PrivateKeys.withKeys(
          privateKeyBase.ed25519SigningPrivateKey(),
          EncapsulationPrivateKey.x25519(privateKeyBase.x25519PrivateKey()),
        );
        break;
      case SigningScheme.SshEd25519:
        privateKeys = privateKeyBase.sshPrivateKeys("ed25519", "");
        break;
      case SigningScheme.SshDsa:
        privateKeys = privateKeyBase.sshPrivateKeys("dsa", "");
        break;
      case SigningScheme.SshEcdsaP256:
        privateKeys = privateKeyBase.sshPrivateKeys("ecdsa-p256", "");
        break;
      case SigningScheme.SshEcdsaP384:
        privateKeys = privateKeyBase.sshPrivateKeys("ecdsa-p384", "");
        break;
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
