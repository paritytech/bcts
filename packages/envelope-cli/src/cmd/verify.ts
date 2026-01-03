/**
 * Verify command - 1:1 port of cmd/verify.rs
 *
 * Verify a signature on the envelope using the provided verifiers.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import {
  PrivateKeyBase,
  PublicKeys,
  SigningPrivateKey,
  SigningPublicKey,
  type Verifier,
} from "@bcts/components";

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
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.verifiers.length === 0) {
      throw new Error("at least one verifier must be provided");
    }

    const privateKeyBases: PrivateKeyBase[] = [];
    const publicKeysVec: PublicKeys[] = [];
    const signingPrivateKeys: SigningPrivateKey[] = [];
    const signingPublicKeys: SigningPublicKey[] = [];

    for (const v of this.args.verifiers) {
      // Try parsing as different key types
      try {
        const key = PrivateKeyBase.fromUrString(v);
        privateKeyBases.push(key);
        continue;
      } catch {
        // Not a PrivateKeyBase
      }

      try {
        const key = PublicKeys.fromUrString(v);
        publicKeysVec.push(key);
        continue;
      } catch {
        // Not a PublicKeys
      }

      try {
        const key = SigningPrivateKey.fromUrString(v);
        signingPrivateKeys.push(key);
        continue;
      } catch {
        // Not a SigningPrivateKey
      }

      try {
        const key = SigningPublicKey.fromUrString(v);
        signingPublicKeys.push(key);
        continue;
      } catch {
        // Not a SigningPublicKey
      }

      throw new Error(`invalid verifier: ${v}`);
    }

    // Build verifiers array
    const verifiers: Verifier[] = [
      ...privateKeyBases,
      ...publicKeysVec,
      ...signingPrivateKeys,
      ...signingPublicKeys,
    ];

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
