/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID delegate all command - 1:1 port of cmd/xid/delegate/all.rs
 *
 * Retrieve all the XID document's delegates.
 */

import { DELEGATE } from "@bcts/known-values";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { envelopeToXidUrString } from "../xid-utils.js";

/**
 * Command arguments for the delegate all command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Delegate all command implementation.
 */
export class DelegateAllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.None); // Validation only
    const delegateAssertions = envelope.assertionsWithPredicate(DELEGATE);
    const delegates = delegateAssertions.map((d) => envelopeToXidUrString(d.object()));
    return delegates.join("\n");
  }
}

/**
 * Execute the delegate all command.
 */
export function exec(args: CommandArgs): string {
  return new DelegateAllCommand(args).exec();
}
