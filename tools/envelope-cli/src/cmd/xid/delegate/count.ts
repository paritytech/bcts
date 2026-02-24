/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID delegate count command - 1:1 port of cmd/xid/delegate/count.rs
 *
 * Print the count of the XID document's delegates.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the delegate count command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Delegate count command implementation.
 */
export class DelegateCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    return xidDocument.delegates().length.toString();
  }
}

/**
 * Execute the delegate count command.
 */
export function exec(args: CommandArgs): string {
  return new DelegateCountCommand(args).exec();
}
