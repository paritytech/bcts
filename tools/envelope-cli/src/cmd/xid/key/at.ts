/**
 * XID key at command - 1:1 port of cmd/xid/key/at.rs
 *
 * Retrieve the XID Document's key at the given index.
 */

import { KEY } from "@bcts/known-values";
import { XIDDocument } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { ReadPasswordArgs } from "../password-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { getPrivateKeyUr } from "../xid-utils.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the key at command.
 */
export interface CommandArgs {
  index: number;
  private: boolean;
  passwordArgs: ReadPasswordArgs;
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Key at command implementation.
 */
export class KeyAtCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    if (this.args.private) {
      // Return private key
      const xidDocument = readXidDocument(
        this.args.envelope,
        verifySignature(this.args.verifyArgs),
      );
      const keys = xidDocument.keys();
      if (this.args.index >= keys.length) {
        throw new Error("Index out of bounds");
      }
      const key = keys[this.args.index];
      return getPrivateKeyUr(key, this.args.passwordArgs);
    } else {
      // Return public key (original behavior)
      const envelope = readEnvelope(this.args.envelope);
      XIDDocument.fromEnvelope(
        envelope,
        undefined,
        verifySignature(this.args.verifyArgs),
      ); // Validation only
      // Unwrap if signed to get at the KEY assertions
      const innerEnvelope = envelope.subject().isWrapped()
        ? envelope.subject().unwrap()
        : envelope;
      const keyAssertions = innerEnvelope.assertionsWithPredicate(KEY);
      if (this.args.index >= keyAssertions.length) {
        throw new Error("Index out of bounds");
      }
      const keyEnvelope = keyAssertions[this.args.index].object();
      return keyEnvelope.urString();
    }
  }
}

/**
 * Execute the key at command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyAtCommand(args).exec();
}
