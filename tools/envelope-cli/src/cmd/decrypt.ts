/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Decrypt command - 1:1 port of cmd/decrypt.rs
 *
 * Decrypt the envelope's subject.
 */

import type { ExecAsync } from "../exec.js";
import { readEnvelope, readPassword, ASKPASS_HELP, ASKPASS_LONG_HELP } from "../utils.js";
import { PrivateKeyBase, PrivateKeys, SymmetricKey } from "@bcts/components";
import { PrivateKeyBase as EnvelopePrivateKeyBase } from "@bcts/envelope";

export { ASKPASS_HELP, ASKPASS_LONG_HELP };

/**
 * Convert a PrivateKeys to envelope's PrivateKeyBase.
 * Extracts the X25519 encapsulation key and creates envelope-compatible type.
 */
function privateKeysToEnvelopeKey(pk: PrivateKeys): EnvelopePrivateKeyBase {
  const encKey = pk.encapsulationPrivateKey();
  const x25519Key = encKey.x25519PrivateKey();
  const privateData = x25519Key.data();
  const publicData = x25519Key.publicKey().data();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  return (EnvelopePrivateKeyBase as any).fromBytes(privateData, publicData);
}

/**
 * Convert a components PrivateKeyBase to envelope's PrivateKeyBase.
 * Derives the X25519 key and creates envelope-compatible type.
 */
function privateKeyBaseToEnvelopeKey(pkb: PrivateKeyBase): EnvelopePrivateKeyBase {
  const x25519Key = pkb.x25519PrivateKey();
  const privateData = x25519Key.data();
  const publicData = x25519Key.publicKey().data();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  return (EnvelopePrivateKeyBase as any).fromBytes(privateData, publicData);
}

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
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.key) {
      // If a content key is provided, decrypt the subject using it
      const key = SymmetricKey.fromURString(this.args.key);
      const decrypted = envelope.decryptSubject(key);
      return decrypted.urString();
    }

    if (this.args.password !== undefined) {
      const password = await readPassword(
        "Decryption password:",
        this.args.password || undefined,
        this.args.askpass,
      );
      const decrypted = envelope.unlockSubject(new TextEncoder().encode(password));
      return decrypted.urString();
    }

    if (this.args.recipient) {
      // If a recipient's private key is provided, decrypt the subject using it
      // Try to parse as PrivateKeys first, then PrivateKeyBase
      try {
        const recipient = PrivateKeys.fromURString(this.args.recipient);
        const envelopeKey = privateKeysToEnvelopeKey(recipient);
        const decrypted = envelope.decryptSubjectToRecipient(envelopeKey);
        return decrypted.urString();
      } catch {
        try {
          const recipient = PrivateKeyBase.fromURString(this.args.recipient);
          const envelopeKey = privateKeyBaseToEnvelopeKey(recipient);
          const decrypted = envelope.decryptSubjectToRecipient(envelopeKey);
          return decrypted.urString();
        } catch {
          throw new Error(
            "invalid recipient private key: must be ur:crypto-prvkeys or ur:crypto-prvkey-base",
          );
        }
      }
    }

    if (this.args.sshId !== undefined) {
      // SSH agent decryption is not yet implemented
      throw new Error("SSH agent decryption is not yet implemented in the TypeScript version.");
    }

    throw new Error(
      "missing unlock method: either a symmetric key, password, recipient's private key, or SSH identity must be provided",
    );
  }
}

/**
 * Execute the decrypt command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new DecryptCommand(args).exec();
}
