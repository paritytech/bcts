/**
 * Export command - 1:1 port of cmd/export.rs
 *
 * Export a UR to its native format.
 */

import { SigningPrivateKey, SigningPublicKey, PublicKeys, Signature } from "@bcts/components";
import type { ExecAsync } from "../exec.js";
import { readArgument, readPassword, ASKPASS_HELP, ASKPASS_LONG_HELP } from "../utils.js";

export { ASKPASS_HELP, ASKPASS_LONG_HELP };

/**
 * Command arguments for the export command.
 */
export interface CommandArgs {
  /** The UR to be exported */
  urString?: string;
  /** Whether to encrypt the SSH private key */
  encrypt: boolean;
  /** The password to encrypt an SSH private key */
  password?: string;
  /** Use SSH_ASKPASS to read the password */
  askpass: boolean;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    encrypt: false,
    askpass: false,
  };
}

/**
 * Export command implementation.
 */
export class ExportCommand implements ExecAsync {
  constructor(private args: CommandArgs) {}

  async exec(): Promise<string> {
    const object = readArgument(this.args.urString);

    // Try SSH signing private key
    try {
      const signingPrivateKey = SigningPrivateKey.fromURString(object);
      const sshPrivateKey = signingPrivateKey.toSsh();
      if (!sshPrivateKey) {
        throw new Error("UR is not an SSH private key.");
      }

      if (this.args.encrypt) {
        const password = await readPassword(
          "Key encryption password: ",
          this.args.password,
          this.args.askpass
        );
        return sshPrivateKey.toOpensshEncrypted(password);
      }
      return sshPrivateKey.toOpenssh();
    } catch (e) {
      if ((e as Error).message === "UR is not an SSH private key.") {
        throw e;
      }
      // Not a SigningPrivateKey, try next
    }

    // Try SSH signing public key
    try {
      const signingPublicKey = SigningPublicKey.fromURString(object);
      const sshPublicKey = signingPublicKey.toSsh();
      if (!sshPublicKey) {
        throw new Error("UR is not an SSH public key.");
      }
      return sshPublicKey.toOpenssh();
    } catch (e) {
      if ((e as Error).message === "UR is not an SSH public key.") {
        throw e;
      }
      // Not a SigningPublicKey, try next
    }

    // Try PublicKeys with SSH public key
    try {
      const publicKeys = PublicKeys.fromURString(object);
      const sshPublicKey = publicKeys.signingPublicKey().toSsh();
      if (!sshPublicKey) {
        throw new Error("UR is not a PublicKeys with an SSH public key.");
      }
      return sshPublicKey.toOpenssh();
    } catch (e) {
      if (
        (e as Error).message === "UR is not a PublicKeys with an SSH public key."
      ) {
        throw e;
      }
      // Not PublicKeys, try next
    }

    // Try SSH signature
    try {
      const signature = Signature.fromURString(object);
      const sshSignature = signature.toSsh();
      if (!sshSignature) {
        throw new Error("UR is not an SSH signature.");
      }
      return sshSignature.toPem();
    } catch (e) {
      if ((e as Error).message === "UR is not an SSH signature.") {
        throw e;
      }
      // Not a Signature
    }

    throw new Error(
      "Invalid object for export. Supported types are SSH ur:signing-private-key, SSH ur:signing-public-key, SSH ur:crypto-pubkeys, and ur:signature."
    );
  }
}

/**
 * Execute the export command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ExportCommand(args).exec();
}
