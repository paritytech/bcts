/**
 * Encrypt command - 1:1 port of cmd/encrypt.rs
 *
 * Encrypt the envelope's subject.
 */

import type { ExecAsync } from "../exec.js";
import { readEnvelope, readPassword, ASKPASS_HELP, ASKPASS_LONG_HELP } from "../utils.js";
import { SymmetricKey, PublicKeys, KeyDerivationMethod } from "@bcts/components";
import { PublicKeyBase as EnvelopePublicKeyBase } from "@bcts/envelope";

/**
 * Convert a PublicKeys to envelope's PublicKeyBase.
 * Extracts the X25519 encapsulation key and creates envelope-compatible type.
 */
function publicKeysToEnvelopeKey(pk: PublicKeys): EnvelopePublicKeyBase {
  const encKey = pk.encapsulationPublicKey();
  const publicData = encKey.x25519PublicKey().data();
  return new EnvelopePublicKeyBase(publicData);
}

export { ASKPASS_HELP, ASKPASS_LONG_HELP };

/**
 * Password-based key derivation algorithms supported for encryption.
 */
export enum PasswordDerivationType {
  /** Argon2id key derivation (default) */
  Argon2id = "argon2id",
  /** PBKDF2 key derivation */
  PBKDF2 = "pbkdf2",
  /** Scrypt key derivation */
  Scrypt = "scrypt",
}

/**
 * Convert PasswordDerivationType to KeyDerivationMethod.
 */
function toKeyDerivationMethod(derivation: PasswordDerivationType): KeyDerivationMethod {
  switch (derivation) {
    case PasswordDerivationType.Argon2id:
      return KeyDerivationMethod.Argon2id;
    case PasswordDerivationType.PBKDF2:
      return KeyDerivationMethod.PBKDF2;
    case PasswordDerivationType.Scrypt:
      return KeyDerivationMethod.Scrypt;
  }
}

/**
 * Command arguments for the encrypt command.
 */
export interface CommandArgs {
  /** The content key to use to encrypt the envelope's subject (ur:crypto-key) */
  key?: string;
  /** A password used to lock the content key */
  password?: string;
  /** Use SSH_ASKPASS to read the password */
  askpass: boolean;
  /** The password-based key derivation algorithm */
  passwordDerivation: PasswordDerivationType;
  /** The SSH agent key identity used to lock the content key */
  sshId?: string;
  /** The recipients to whom the envelope's subject should be encrypted (ur:crypto-pubkeys) */
  recipients: string[];
  /** The envelope to encrypt */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    askpass: false,
    passwordDerivation: PasswordDerivationType.Argon2id,
    recipients: [],
  };
}

/**
 * Encrypt command implementation.
 */
export class EncryptCommand implements ExecAsync {
  constructor(private args: CommandArgs) {}

  async exec(): Promise<string> {
    const envelope = readEnvelope(this.args.envelope);

    // Get the content key
    let contentKey: SymmetricKey;
    if (this.args.key) {
      contentKey = SymmetricKey.fromURString(this.args.key);
    } else {
      contentKey = SymmetricKey.new();
    }

    // Encrypt the subject using the content key
    let encryptedEnvelope = envelope.encryptSubject(contentKey);

    // Convert recipients to PublicKeys and add them
    for (const recipientUr of this.args.recipients) {
      const recipient = PublicKeys.fromURString(recipientUr);
      const envelopeKey = publicKeysToEnvelopeKey(recipient);
      encryptedEnvelope = encryptedEnvelope.addRecipient(envelopeKey, contentKey);
    }

    // If there is a password, add it
    if (this.args.password !== undefined) {
      const password = await readPassword(
        "Encryption password:",
        this.args.password || undefined,
        this.args.askpass,
      );
      const derivationMethod = toKeyDerivationMethod(this.args.passwordDerivation);
      encryptedEnvelope = encryptedEnvelope.addSecret(
        derivationMethod,
        new TextEncoder().encode(password),
        contentKey,
      );
    }

    // If there is an SSH ID, add it
    if (this.args.sshId !== undefined) {
      encryptedEnvelope = encryptedEnvelope.addSecret(
        KeyDerivationMethod.SSHAgent,
        new TextEncoder().encode(this.args.sshId),
        contentKey,
      );
    }

    // Return the encrypted envelope as a UR string
    return encryptedEnvelope.urString();
  }
}

/**
 * Execute the encrypt command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new EncryptCommand(args).exec();
}
