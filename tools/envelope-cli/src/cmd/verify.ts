/**
 * Verify command - 1:1 port of cmd/verify.rs
 *
 * Verify a signature on the envelope using the provided verifiers.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import { PublicKeys, SigningPublicKey, type Verifier } from "@bcts/components";

/**
 * Command arguments for the verify command.
 */
export interface CommandArgs {
  /** Don't output the envelope's UR on success */
  silent: boolean;
  /** The minimum number of required valid signatures */
  threshold: number;
  /** The verifier(s) */
  verifiers: string[];
  /** The envelope to verify */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    silent: false,
    threshold: 1,
    verifiers: [],
  };
}

/**
 * Verify command implementation.
 */
export class VerifyCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.verifiers.length === 0) {
      throw new Error("at least one verifier must be provided");
    }

    const verifiers: Verifier[] = [];

    for (const v of this.args.verifiers) {
      // Try parsing as PublicKeys (most common for CLI)
      try {
        const key = PublicKeys.fromURString(v);
        verifiers.push(key);
        continue;
      } catch {
        // Not a PublicKeys
      }

      // Try parsing as SigningPublicKey
      try {
        const key = SigningPublicKey.fromURString(v);
        verifiers.push(key);
        continue;
      } catch {
        // Not a SigningPublicKey
      }

      throw new Error(`invalid verifier: ${v}. Must be ur:crypto-pubkeys or ur:signing-public-key`);
    }

    // Verify signatures
    envelope.verifySignaturesFromThreshold(verifiers, this.args.threshold);

    if (this.args.silent) {
      return "";
    }
    return envelope.urString();
  }
}

/**
 * Execute the verify command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new VerifyCommand(args).exec();
}
