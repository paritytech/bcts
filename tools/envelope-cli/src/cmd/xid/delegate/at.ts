/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID delegate at command - 1:1 port of cmd/xid/delegate/at.rs
 *
 * Retrieve the delegate at the given index.
 */

import { DELEGATE } from "@bcts/known-values";
import { XIDDocument, XIDVerifySignature } from "@bcts/xid";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { envelopeToXidUrString } from "../xid-utils.js";

/**
 * Command arguments for the delegate at command.
 */
export interface CommandArgs {
  index: number;
  envelope?: string;
}

/**
 * Delegate at command implementation.
 */
export class DelegateAtCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.None); // Validation only
    const delegateAssertions = envelope.assertionsWithPredicate(DELEGATE);
    if (this.args.index >= delegateAssertions.length) {
      throw new Error("Index out of bounds");
    }
    const delegateEnvelope = delegateAssertions[this.args.index].object();
    return envelopeToXidUrString(delegateEnvelope);
  }
}

/**
 * Execute the delegate at command.
 */
export function exec(args: CommandArgs): string {
  return new DelegateAtCommand(args).exec();
}
