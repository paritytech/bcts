/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Generate public keys command - 1:1 port of cmd/generate/pub_keys.rs
 *
 * Convert private keys to public keys.
 * Takes a ur:crypto-prvkeys or ur:signing-private-key and converts it to
 * ur:crypto-pubkeys or ur:signing-public-key.
 */

import { PrivateKeys, PublicKeys, SigningPrivateKey } from "@bcts/components";
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
  constructor(private readonly args: CommandArgs) {}

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

      // Mirror Rust `pub_keys.rs:49-60`: replace the SSH key with one
      // carrying the requested comment.
      const signingPub = publicKeys.signingPublicKey();
      if (this.args.comment.length > 0 && signingPub.isSsh()) {
        publicKeys = PublicKeys.new(
          signingPub.withSshComment(this.args.comment),
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
      let signingPublicKey = signingPrivateKey.publicKey();

      // Mirror Rust `pub_keys.rs:69-76` for the SigningPrivateKey path.
      if (this.args.comment.length > 0 && signingPublicKey.isSsh()) {
        signingPublicKey = signingPublicKey.withSshComment(this.args.comment);
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
