/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID key all command - 1:1 port of cmd/xid/key/all.rs
 *
 * Retrieve all the XID document's keys.
 */

import { KEY } from "@bcts/known-values";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";
import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { ReadPasswordArgs } from "../password-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import {
  getPrivateKeyUr,
  readXidDocument,
  xidDocumentEnvelope,
  xidFromDocumentEnvelope,
} from "../xid-utils.js";

/**
 * Command arguments for the key all command.
 */
export interface CommandArgs {
  private: boolean;
  passwordArgs: ReadPasswordArgs;
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Key all command implementation.
 */
export class KeyAllCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    if (this.args.private) {
      // Return private keys
      const xidDocument = readXidDocument(
        this.args.envelope,
        verifySignature(this.args.verifyArgs),
      );
      const results: string[] = [];
      for (const key of xidDocument.keys()) {
        results.push(await getPrivateKeyUr(key, this.args.passwordArgs));
      }
      return results.join("\n");
    } else {
      // Return public keys (original behavior)
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
      const keys = keyAssertions.map((k) => k.tryObject().urString());
      return keys.join("\n");
    }
  }
}

/**
 * Execute the key all command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new KeyAllCommand(args).exec();
}
