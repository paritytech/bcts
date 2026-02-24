/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID method all command - 1:1 port of cmd/xid/method/all.rs
 *
 * Retrieve all the XID document's resolution methods.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the method all command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Method all command implementation.
 */
export class MethodAllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    return [...xidDocument.resolutionMethods()].join("\n");
  }
}

/**
 * Execute the method all command.
 */
export function exec(args: CommandArgs): string {
  return new MethodAllCommand(args).exec();
}
