/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID edge at command - 1:1 port of cmd/xid/edge/at.rs
 *
 * Retrieve the edge at the given index.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the edge at command.
 */
export interface CommandArgs {
  index: number;
  envelope?: string;
}

/**
 * Edge at command implementation.
 */
export class EdgeAtCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const entries = [...xidDocument.edges().iter()];
    if (this.args.index >= entries.length) {
      throw new Error("Index out of bounds");
    }
    return entries[this.args.index][1].urString();
  }
}

/**
 * Execute the edge at command.
 */
export function exec(args: CommandArgs): string {
  return new EdgeAtCommand(args).exec();
}
