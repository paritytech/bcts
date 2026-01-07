/**
 * Import command - 1:1 port of cmd/import.rs
 *
 * Import the given object to UR form.
 *
 * NOTE: SSH key import is not yet implemented in the TypeScript version.
 * This requires OpenSSH key format parsing which is complex and depends on
 * bcrypt_pbkdf for encrypted keys.
 */

import type { ExecAsync } from "../exec.js";
import { readArgument, ASKPASS_HELP, ASKPASS_LONG_HELP } from "../utils.js";

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
  constructor(private readonly args: CommandArgs) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async exec(): Promise<string> {
    // Validate that an object was provided
    readArgument(this.args.object);

    // SSH key import is not yet implemented
    // This requires:
    // - SigningPrivateKey.fromOpenssh() - Parse OpenSSH private key format
    // - SigningPublicKey.fromOpenssh() - Parse OpenSSH public key format
    // - Signature.fromSshPem() - Parse SSH signature PEM format
    // - Encrypted key support requires bcrypt_pbkdf
    throw new Error(
      "SSH key import is not yet implemented in the TypeScript CLI. " +
        "This feature requires OpenSSH key format parsing support in @bcts/components.",
    );
  }
}

/**
 * Execute the import command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ImportCommand(args).exec();
}
