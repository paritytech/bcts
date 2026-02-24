/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID edge all command - 1:1 port of cmd/xid/edge/all.rs
 *
 * Retrieve all the XID document's edges.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the edge all command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Edge all command implementation.
 */
export class EdgeAllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const edges = [...xidDocument.edges().iter()].map(([, e]) => e);
    return edges.map((e) => e.urString()).join("\n");
  }
}

/**
 * Execute the edge all command.
 */
export function exec(args: CommandArgs): string {
  return new EdgeAllCommand(args).exec();
}
