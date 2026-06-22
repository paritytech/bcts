/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID key count command - 1:1 port of cmd/xid/key/count.rs
 *
 * Print the count of the XID document's keys.
 */

import { KEY } from "@bcts/known-values";
import { XIDVerifySignature } from "@bcts/xid";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readXidDocument, xidDocumentEnvelope, xidFromDocumentEnvelope } from "../xid-utils.js";

/**
 * Command arguments for the key count command.
 */
export interface CommandArgs {
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Key count command implementation.
 */
export class KeyCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const verify = verifySignature(this.args.verifyArgs);
    // In no-verify mode, count KEY assertions directly off the envelope so the
    // command works on enriched documents.
    if (verify === XIDVerifySignature.None) {
      const envelope = readEnvelope(this.args.envelope);
      xidFromDocumentEnvelope(envelope);
      const inner = xidDocumentEnvelope(envelope);
      return inner.assertionsWithPredicate(KEY).length.toString();
    }

    const xidDocument = readXidDocument(this.args.envelope, verify);
    return xidDocument.keys().length.toString();
  }
}

/**
 * Execute the key count command.
 */
export function exec(args: CommandArgs): string {
  return new KeyCountCommand(args).exec();
}
