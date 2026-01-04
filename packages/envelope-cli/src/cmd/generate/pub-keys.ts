/**
 * Generate public keys command - 1:1 port of cmd/generate/pub_keys.rs
 *
 * Convert private keys to public keys.
 * Takes a ur:crypto-prvkeys or ur:signing-private-key and converts it to
 * ur:crypto-pubkeys or ur:signing-public-key.
 */

import { PrivateKeys, SigningPrivateKey, PublicKeys, SigningPublicKey } from "@bcts/components";
import type { Exec } from "../../exec.js";
import { readStdinLine } from "../../utils.js";

/**
 * Command arguments for the pub-keys command.
 */
export interface CommandArgs {
  /** The private keys to convert (ur:crypto-prvkeys or ur:signing-private-key) */
  prvKeys?: string;
  /** The comment for SSH public keys */
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
      let publicKeys = privateKeys.publicKeys();

      // If a comment is provided and the signing key is SSH, update the comment
      if (this.args.comment && publicKeys.signingPublicKey().isSsh()) {
        const sshKey = publicKeys.signingPublicKey().asSsh()!;
        sshKey.setComment(this.args.comment);
        publicKeys = PublicKeys.new(
          SigningPublicKey.ssh(sshKey),
          publicKeys.encapsulationPublicKey(),
        );
      }

      return publicKeys.urString();
    } catch {
      // Not PrivateKeys
    }

    // Try to parse as SigningPrivateKey
    try {
      const signingPrivateKey = SigningPrivateKey.fromURString(urString);
      const signingPublicKey = signingPrivateKey.publicKey();

      // If a comment is provided and the signing key is SSH, update the comment
      if (this.args.comment && signingPublicKey.isSsh()) {
        const sshKey = signingPublicKey.asSsh()!;
        sshKey.setComment(this.args.comment);
        return SigningPublicKey.ssh(sshKey).urString();
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
