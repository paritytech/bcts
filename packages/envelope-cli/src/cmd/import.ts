/**
 * Import command - 1:1 port of cmd/import.rs
 *
 * Import the given object to UR form.
 */

import { SigningPrivateKey, SigningPublicKey, Signature } from "@bcts/components";
import type { ExecAsync } from "../exec.js";
import { readArgument, readPassword, ASKPASS_HELP, ASKPASS_LONG_HELP } from "../utils.js";

export { ASKPASS_HELP, ASKPASS_LONG_HELP };

/**
 * Command arguments for the import command.
 */
export interface CommandArgs {
  /** The object to be imported into UR form */
  object?: string;
  /** The password to decrypt the SSH private key */
  password?: string;
  /** Use SSH_ASKPASS to read the password */
  askpass: boolean;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    askpass: false,
  };
}

/**
 * Import command implementation.
 */
export class ImportCommand implements ExecAsync {
  constructor(private args: CommandArgs) {}

  async exec(): Promise<string> {
    const object = readArgument(this.args.object);

    // Try SSH private key
    try {
      const signingPrivateKey = SigningPrivateKey.fromOpenssh(object);
      if (signingPrivateKey.isEncrypted()) {
        const password = await readPassword(
          "Key decryption password: ",
          this.args.password,
          this.args.askpass
        );
        return signingPrivateKey.decrypt(password).urString();
      }
      return signingPrivateKey.urString();
    } catch {
      // Not an SSH private key
    }

    // Try SSH public key
    try {
      const signingPublicKey = SigningPublicKey.fromOpenssh(object);
      return signingPublicKey.urString();
    } catch {
      // Not an SSH public key
    }

    // Try SSH signature
    try {
      const signature = Signature.fromSshPem(object);
      return signature.urString();
    } catch {
      // Not an SSH signature
    }

    throw new Error(
      "Invalid object for import. Supported types are SSH private key, public key, and signature."
    );
  }
}

/**
 * Execute the import command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ImportCommand(args).exec();
}
