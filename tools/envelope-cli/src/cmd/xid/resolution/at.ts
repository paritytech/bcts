/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID resolution at command - 1:1 port of cmd/xid/resolution/at.rs
 *
 * Retrieve the resolution method at the given index.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the resolution at command.
 */
export interface CommandArgs {
  index: number;
  envelope?: string;
}

/**
 * Resolution at command implementation.
 */
export class ResolutionAtCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const methods = [...xidDocument.resolutionMethods()];
    if (this.args.index >= methods.length) {
      throw new Error("Index out of bounds");
    }
    return methods[this.args.index];
  }
}

/**
 * Execute the resolution at command.
 */
export function exec(args: CommandArgs): string {
  return new ResolutionAtCommand(args).exec();
}
