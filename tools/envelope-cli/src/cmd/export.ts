/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Export command - 1:1 port of cmd/export.rs
 *
 * Export a UR to its native format.
 *
 * NOTE: SSH export functionality is partially implemented.
 * Some SSH features require additional methods in @bcts/components:
 * - Encrypted SSH private key export (toOpensshEncrypted)
 * - SSH signature PEM export
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
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const object = readArgument(this.args.urString);

    // Try SSH signing private key
    try {
      const signingPrivateKey = SigningPrivateKey.fromURString(object);

      // Check if this is an SSH-compatible key type (Ed25519)
      if (signingPrivateKey.keyType() !== "Ed25519") {
        throw new Error("UR is not an SSH private key.");
      }

      if (this.args.encrypt) {
        // Read the password (for future use when encrypted export is implemented)
        await readPassword("Key encryption password: ", this.args.password, this.args.askpass);
        // TODO: Implement encrypted SSH private key export
        // This requires bcrypt_pbkdf which is not yet available in @bcts/crypto
        throw new Error("Encrypted SSH private key export is not yet implemented.");
      }

      // toSsh() returns the OpenSSH format string directly
      return signingPrivateKey.toSsh();
    } catch (e) {
      const msg = (e as Error).message;
      if (
        msg === "UR is not an SSH private key." ||
        msg === "Encrypted SSH private key export is not yet implemented."
      ) {
        throw e;
      }
      // Not a SigningPrivateKey, try next
    }

    // Try SSH signing public key
    try {
      const signingPublicKey = SigningPublicKey.fromURString(object);

      // Check if this is an SSH-compatible key type (Ed25519)
      if (signingPublicKey.keyType() !== "Ed25519") {
        throw new Error("UR is not an SSH public key.");
      }

      // toSsh() returns the OpenSSH format string directly
      return signingPublicKey.toSsh();
    } catch (e) {
      if ((e as Error).message === "UR is not an SSH public key.") {
        throw e;
      }
      // Not a SigningPublicKey, try next
    }

    // Try PublicKeys with SSH public key
    try {
      const publicKeys = PublicKeys.fromURString(object);
      const signingPublicKey = publicKeys.signingPublicKey();

      // Check if this is an SSH-compatible key type (Ed25519)
      if (signingPublicKey.keyType() !== "Ed25519") {
        throw new Error("UR is not a PublicKeys with an SSH public key.");
      }

      // toSsh() returns the OpenSSH format string directly
      return signingPublicKey.toSsh();
    } catch (e) {
      if ((e as Error).message === "UR is not a PublicKeys with an SSH public key.") {
        throw e;
      }
      // Not PublicKeys, try next
    }

    // Try SSH signature
    try {
      // Parse the signature to validate it (result used for future SSH signature export)
      Signature.fromURString(object);
      // TODO: Implement SSH signature PEM export
      // This requires additional SSH signature format support
      throw new Error("SSH signature export is not yet implemented.");
    } catch (e) {
      const msg = (e as Error).message;
      if (
        msg === "UR is not an SSH signature." ||
        msg === "SSH signature export is not yet implemented."
      ) {
        throw e;
      }
      // Not a Signature
    }

    throw new Error(
      "Invalid object for export. Supported types are SSH ur:signing-private-key, SSH ur:signing-public-key, SSH ur:crypto-pubkeys, and ur:signature.",
    );
  }
}

/**
 * Execute the export command with the given arguments.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new ExportCommand(args).exec();
}
