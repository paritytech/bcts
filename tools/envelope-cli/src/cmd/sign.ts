/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Sign command - 1:1 port of cmd/sign.rs
 *
 * Sign the envelope subject with the provided signer(s).
 *
 * NOTE: SSH signature options are not currently supported in the TypeScript
 * implementation. All keys are signed using their default algorithm.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import { PrivateKeys, SigningPrivateKey, type Signer } from "@bcts/components";
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

    for (const s of this.args.signers) {
      // Try parsing as PrivateKeys first (most common for CLI)
      try {
        const key = PrivateKeys.fromURString(s);
        allSigners.push(key);
        continue;
      } catch {
        // Not a PrivateKeys
      }

      // Try as SigningPrivateKey
      try {
        const key = SigningPrivateKey.fromURString(s);
        allSigners.push(key);
        continue;
      } catch {
        // Not a SigningPrivateKey
      }

      throw new Error(`invalid signer: ${s}`);
    }

    // If there's a note, add it to a single signature
    if (this.args.note) {
      if (allSigners.length !== 1) {
        throw new Error("can only add a note on a single signature");
      }
      const signer = allSigners[0];
      if (signer === undefined) {
        throw new Error("no signer found");
      }
      const metadata = SignatureMetadata.new().withAssertion(NOTE, this.args.note);
      return envelope.addSignatureWithMetadata(signer, metadata).urString();
    }

    // Add all signatures
    return envelope.addSignatures(allSigners).urString();
  }
}

/**
 * Execute the sign command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SignCommand(args).exec();
}
