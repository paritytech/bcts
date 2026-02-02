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
import { Envelope } from "@bcts/envelope";

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
 *
 * Accepts verifiers as:
 * - ur:prvkeys (PrivateKeyBase)
 * - ur:crypto-pubkeys (PublicKeys)
 * - ur:signing-private-key (SigningPrivateKey)
 * - ur:signing-public-key (SigningPublicKey)
 * - ur:envelope (envelope-wrapped key, extracts subject)
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
      // Try parsing as PrivateKeyBase (derive PublicKeys for verification)
      try {
        const key = PrivateKeyBase.fromURString(v);
        verifiers.push(key.ed25519PublicKeys());
        continue;
      } catch {
        // Not a PrivateKeyBase
      }

      // Try parsing as PublicKeys
      try {
        const key = PublicKeys.fromURString(v);
        verifiers.push(key);
        continue;
      } catch {
        // Not a PublicKeys
      }

      // Try parsing as SigningPrivateKey
      try {
        const key = SigningPrivateKey.fromURString(v);
        verifiers.push(key);
        continue;
      } catch {
        // Not a SigningPrivateKey
      }

      // Try parsing as SigningPublicKey
      try {
        const key = SigningPublicKey.fromURString(v);
        verifiers.push(key);
        continue;
      } catch {
        // Not a SigningPublicKey
      }

      // Handle envelope-wrapped keys (e.g., from `xid key at`)
      // by extracting the key from the envelope's subject
      if (v.startsWith("ur:envelope")) {
        const keyEnvelope = Envelope.fromUrString(v);

        // Try extract_subject for each key type
        try {
          const key = keyEnvelope.extractSubject(
            (cbor) => PrivateKeyBase.fromTaggedCbor(cbor),
          );
          verifiers.push(key.ed25519PublicKeys());
          continue;
        } catch {
          // Not a PrivateKeyBase
        }

        try {
          const key = keyEnvelope.extractSubject(
            (cbor) => PublicKeys.fromTaggedCbor(cbor),
          );
          verifiers.push(key);
          continue;
        } catch {
          // Not a PublicKeys
        }

        try {
          const key = keyEnvelope.extractSubject(
            (cbor) => SigningPrivateKey.fromTaggedCbor(cbor),
          );
          verifiers.push(key);
          continue;
        } catch {
          // Not a SigningPrivateKey
        }

        try {
          const key = keyEnvelope.extractSubject(
            (cbor) => SigningPublicKey.fromTaggedCbor(cbor),
          );
          verifiers.push(key);
          continue;
        } catch {
          // Not a SigningPublicKey
        }

        throw new Error(`envelope does not contain a valid verifier key: ${v}`);
      }

      throw new Error(`invalid verifier: ${v}`);
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
