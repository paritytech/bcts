/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID edge count command - 1:1 port of cmd/xid/edge/count.rs
 *
 * Print the count of the XID document's edges.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the edge count command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Edge count command implementation.
 */
export class EdgeCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    return xidDocument.edges().len().toString();
  }
}

/**
 * Execute the edge count command.
 */
export function exec(args: CommandArgs): string {
  return new EdgeCountCommand(args).exec();
}
