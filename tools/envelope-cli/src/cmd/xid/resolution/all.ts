/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID resolution all command - 1:1 port of cmd/xid/resolution/all.rs
 *
 * Retrieve all the XID document's resolution methods.
 */

import { URI } from "@bcts/components";
import { DEREFERENCE_VIA } from "@bcts/known-values";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { xidDocumentEnvelope, xidFromDocumentEnvelope } from "../xid-utils.js";

/**
 * Command arguments for the resolution all command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Resolution all command implementation.
 */
export class ResolutionAllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    // Read the dereferenceVia URIs directly off the envelope (no strict parse),
    // so the command works on enriched/signed documents.
    const envelope = readEnvelope(this.args.envelope);
    xidFromDocumentEnvelope(envelope);
    const inner = xidDocumentEnvelope(envelope);
    const methods = inner.assertionsWithPredicate(DEREFERENCE_VIA).map((a) => {
      const uri = URI.fromTaggedCbor(a.tryObject().tryLeaf());
      return uri.toString();
    });
    return methods.join("\n");
  }
}

/**
 * Execute the resolution all command.
 */
export function exec(args: CommandArgs): string {
  return new ResolutionAllCommand(args).exec();
}
