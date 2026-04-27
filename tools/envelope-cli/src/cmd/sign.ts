/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Sign command - 1:1 port of cmd/sign.rs
 *
 * Sign the envelope subject with the provided signer(s). When the
 * signer is an SSH key, attaches the per-signer
 * `SigningOptions.Ssh { namespace, hashAlg }` matching Rust
 * `cmd/sign.rs:53-99`.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import { PrivateKeys, SigningPrivateKey, type Signer, type SigningOptions } from "@bcts/components";
import { SignatureMetadata, NOTE } from "@bcts/envelope";

/**
 * Hash algorithm types for SSH signatures.
 */
export enum HashType {
  Sha256 = "sha256",
  Sha512 = "sha512",
}

/**
 * Command arguments for the sign command.
 */
export interface CommandArgs {
  /** The signer(s) to sign the envelope subject with */
  signers: string[];
  /** An optional note to add to the envelope */
  note?: string;
  /** Namespace for SSH signatures */
  namespace: string;
  /** Hash algorithm for SSH signatures */
  hashType: HashType;
  /** The envelope to sign */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    signers: [],
    namespace: "envelope",
    hashType: HashType.Sha256,
  };
}

/**
 * Sign command implementation.
 */
export class SignCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.signers.length === 0) {
      throw new Error("at least one signer must be provided");
    }

    const allSigners: Signer[] = [];
    const signersWithOptions: { signer: Signer; options?: SigningOptions }[] = [];
    const sshOptions: SigningOptions = {
      type: "Ssh",
      namespace: this.args.namespace,
      hashAlg: this.args.hashType === HashType.Sha512 ? "sha512" : "sha256",
    };

    for (const s of this.args.signers) {
      // Try parsing as PrivateKeys first (most common for CLI)
      try {
        const key = PrivateKeys.fromURString(s);
        allSigners.push(key);
        if (key.signingPrivateKey().isSsh()) {
          signersWithOptions.push({ signer: key, options: sshOptions });
        } else {
          signersWithOptions.push({ signer: key });
        }
        continue;
      } catch {
        // Not a PrivateKeys
      }

      // Try as SigningPrivateKey
      try {
        const key = SigningPrivateKey.fromURString(s);
        allSigners.push(key);
        if (key.isSsh()) {
          signersWithOptions.push({ signer: key, options: sshOptions });
        } else {
          signersWithOptions.push({ signer: key });
        }
        continue;
      } catch {
        // Not a SigningPrivateKey
      }

      throw new Error(`invalid signer: ${s}`);
    }

    // If there's a note, add it to a single signature
    if (this.args.note) {
      if (signersWithOptions.length !== 1) {
        throw new Error("can only add a note on a single signature");
      }
      const { signer, options } = signersWithOptions[0]!;
      const metadata = SignatureMetadata.new().withAssertion(NOTE, this.args.note);
      return envelope.addSignatureOpt(signer, options, metadata).urString();
    }

    // Add all signatures with their per-signer options (SSH gets namespace + hashAlg).
    return envelope.addSignaturesOpt(signersWithOptions).urString();
  }
}

/**
 * Execute the sign command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SignCommand(args).exec();
}
