/**
 * Decrypt command - 1:1 port of cmd/decrypt.rs
 *
 * Decrypt the envelope's subject.
 */

import type { ExecAsync } from "../exec.js";
import { readEnvelope, readPassword, ASKPASS_HELP, ASKPASS_LONG_HELP } from "../utils.js";
import { SymmetricKey, PrivateKeyBase, PrivateKeys } from "@bcts/components";

export { ASKPASS_HELP, ASKPASS_LONG_HELP };

/**
 * Command arguments for the decrypt command.
 */
export interface CommandArgs {
  /** The symmetric key to use to decrypt the envelope's subject (ur:crypto-key) */
  key?: string;
  /** The password to derive the symmetric key */
  password?: string;
  /** Use SSH_ASKPASS to read the password */
  askpass: boolean;
  /** The recipient's private key (ur:crypto-prvkey-base or ur:crypto-prvkeys) */
  recipient?: string;
  /** The SSH identity to use to decrypt the envelope's subject */
  sshId?: string;
  /** The envelope to decrypt */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    askpass: false,
  };
}

/**
 * Decrypt command implementation.
 */
export class DecryptCommand implements ExecAsync {
  constructor(private args: CommandArgs) {}

  async exec(): Promise<string> {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.key) {
      // If a content key is provided, decrypt the subject using it
      const key = SymmetricKey.fromUrString(this.args.key);
      try {
        const decrypted = envelope.decryptSubject(key);
        return decrypted.urString();
      } catch {
        throw new Error("decrypt failed");
      }
    }

    if (this.args.password !== undefined) {
      // If a password is provided, unlock the subject using it
      if (!envelope.isLockedWithPassword()) {
        throw new Error("envelope is not locked with a password");
      }
      const password = await readPassword(
        "Decryption password:",
        this.args.password || undefined,
        this.args.askpass
      );
      const unlocked = envelope.unlockSubject(new TextEncoder().encode(password));
      return unlocked.urString();
    }

    if (this.args.recipient) {
      // If a recipient's private key is provided, decrypt the subject using it
      // Try to parse as PrivateKeys first, then PrivateKeyBase
      try {
        const recipient = PrivateKeys.fromUrString(this.args.recipient);
        const decrypted = envelope.decryptSubjectToRecipient(recipient);
        return decrypted.urString();
      } catch {
        try {
          const recipient = PrivateKeyBase.fromUrString(this.args.recipient);
          const decrypted = envelope.decryptSubjectToRecipient(recipient);
          return decrypted.urString();
        } catch {
          throw new Error(
            "invalid recipient private key: must be ur:crypto-prvkeys or ur:crypto-prvkey-base"
          );
        }
      }
    }

    if (this.args.sshId !== undefined) {
      // If an SSH identity is provided, decrypt the subject using the SSH agent
      if (!envelope.isLockedWithSshAgent()) {
        throw new Error("envelope is not locked with an SSH agent");
      }
      const unlocked = envelope.unlockSubject(this.args.sshId);
      return unlocked.urString();
    }

    throw new Error(
      "missing unlock method: either a symmetric key, password, recipient's private key, or SSH identity must be provided"
    );
  }
}

/**
 * Execute the decrypt command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new DecryptCommand(args).exec();
}
