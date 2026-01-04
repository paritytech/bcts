/**
 * Sign command - 1:1 port of cmd/sign.rs
 *
 * Sign the envelope subject with the provided signer(s).
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";
import {
  PrivateKeyBase,
  PrivateKeys,
  SigningPrivateKey,
  SigningOptions,
  SignatureMetadata,
  type Signer,
} from "@bcts/components";
import { NOTE } from "@bcts/known-values";

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
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.signers.length === 0) {
      throw new Error("at least one signer must be provided");
    }

    const privateKeyBases: PrivateKeyBase[] = [];
    const privateKeysVec: PrivateKeys[] = [];
    const signingPrivateKeys: SigningPrivateKey[] = [];
    const signingOptions: (SigningOptions | undefined)[] = [];

    for (const s of this.args.signers) {
      // Try parsing as different key types
      try {
        const key = PrivateKeyBase.fromURString(s);
        privateKeyBases.push(key);
        continue;
      } catch {
        // Not a PrivateKeyBase
      }

      try {
        const key = PrivateKeys.fromURString(s);
        privateKeysVec.push(key);
        continue;
      } catch {
        // Not a PrivateKeys
      }

      try {
        const key = SigningPrivateKey.fromURString(s);
        if (key.isSsh()) {
          signingOptions.push({
            type: "ssh",
            namespace: this.args.namespace,
            hashAlg: this.args.hashType === HashType.Sha512 ? "sha512" : "sha256",
          });
        } else {
          signingOptions.push(undefined);
        }
        signingPrivateKeys.push(key);
        continue;
      } catch {
        // Not a SigningPrivateKey
      }

      throw new Error(`invalid signer: ${s}`);
    }

    // Build signers array
    type SignerEntry = {
      signer: Signer;
      options?: SigningOptions;
      metadata?: SignatureMetadata;
    };

    const signers: SignerEntry[] = [];

    for (const key of privateKeyBases) {
      signers.push({ signer: key });
    }

    for (const key of privateKeysVec) {
      const options = key.signingPrivateKey().isSsh()
        ? {
            type: "ssh" as const,
            namespace: this.args.namespace,
            hashAlg:
              this.args.hashType === HashType.Sha512 ? ("sha512" as const) : ("sha256" as const),
          }
        : undefined;
      signers.push({ signer: key, options });
    }

    for (let i = 0; i < signingPrivateKeys.length; i++) {
      signers.push({
        signer: signingPrivateKeys[i],
        options: signingOptions[i],
      });
    }

    // If there's a note, add it to a single signature
    if (this.args.note) {
      if (signers.length !== 1) {
        throw new Error("can only add a note on a single signature");
      }
      const metadata = SignatureMetadata.new().withAssertion(NOTE, this.args.note);
      return envelope.addSignatureOpt(signers[0].signer, signers[0].options, metadata).urString();
    }

    // Add all signatures
    return envelope.addSignaturesOpt(signers).urString();
  }
}

/**
 * Execute the sign command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SignCommand(args).exec();
}
