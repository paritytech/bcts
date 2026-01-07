/**
 * Generate public keys command - 1:1 port of cmd/generate/pub_keys.rs
 *
 * Convert private keys to public keys.
 * Takes a ur:crypto-prvkeys or ur:signing-private-key and converts it to
 * ur:crypto-pubkeys or ur:signing-public-key.
 *
 * NOTE: SSH key comment support is not yet implemented in the TypeScript version.
 */

import { PrivateKeys, SigningPrivateKey } from "@bcts/components";
import type { Exec } from "../../exec.js";
import { readStdinLine } from "../../utils.js";

/**
 * Command arguments for the pub-keys command.
 */
export interface CommandArgs {
  /** The private keys to convert (ur:crypto-prvkeys or ur:signing-private-key) */
  prvKeys?: string;
  /** The comment for SSH public keys (not yet implemented) */
  comment: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    comment: "",
  };
}

/**
 * Public keys command implementation.
 */
export class PubKeysCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    let urString: string;
    if (this.args.prvKeys === undefined) {
      const line = readStdinLine();
      if (!line) {
        throw new Error("No private keys provided");
      }
      urString = line.trim();
    } else {
      urString = this.args.prvKeys.trim();
    }

    if (!urString) {
      throw new Error("No private keys provided");
    }

    // Try to parse as PrivateKeys first
    try {
      const privateKeys = PrivateKeys.fromURString(urString);
      const publicKeys = privateKeys.publicKeys();

      // Note: SSH comment support requires isSsh()/asSsh() methods
      // which are not yet implemented in @bcts/components
      if (this.args.comment) {
        console.warn("Warning: SSH key comment support is not yet implemented");
      }

      return publicKeys.urString();
    } catch {
      // Not PrivateKeys
    }

    // Try to parse as SigningPrivateKey
    try {
      const signingPrivateKey = SigningPrivateKey.fromURString(urString);
      const signingPublicKey = signingPrivateKey.publicKey();

      // Note: SSH comment support requires isSsh()/asSsh() methods
      if (this.args.comment) {
        console.warn("Warning: SSH key comment support is not yet implemented");
      }

      return signingPublicKey.urString();
    } catch {
      // Not SigningPrivateKey
    }

    throw new Error("invalid private key: must be ur:crypto-prvkeys or ur:signing-private-key");
  }
}

/**
 * Execute the pub-keys command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new PubKeysCommand(args).exec();
}
