/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID key at command - 1:1 port of cmd/xid/key/at.rs
 *
 * Retrieve the XID Document's key at the given index.
 */

import { KEY } from "@bcts/known-values";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { ReadPasswordArgs } from "../password-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { getPrivateKeyUr } from "../xid-utils.js";
import { readXidDocument, xidDocumentEnvelope, xidFromDocumentEnvelope } from "../xid-utils.js";

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
      const verify = verifySignature(this.args.verifyArgs);
      // Validation only: in no-verify mode just confirm a XID is present (works
      // on enriched docs); otherwise strict-parse to verify the signature.
      if (verify === XIDVerifySignature.None) {
        xidFromDocumentEnvelope(envelope);
      } else {
        XIDDocument.fromEnvelope(envelope, undefined, verify);
      }
      // Unwrap if signed to get at the KEY assertions
      const innerEnvelope = xidDocumentEnvelope(envelope);
      const keyAssertions = innerEnvelope.assertionsWithPredicate(KEY);
      if (this.args.index >= keyAssertions.length) {
        throw new Error("Index out of bounds");
      }
      const keyEnvelope = keyAssertions[this.args.index].tryObject();
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
