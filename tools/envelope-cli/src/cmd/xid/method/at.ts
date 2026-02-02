/**
 * XID method at command - 1:1 port of cmd/xid/method/at.rs
 *
 * Retrieve the resolution method at the given index.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the method at command.
 */
export interface CommandArgs {
  index: number;
  envelope?: string;
}

/**
 * Method at command implementation.
 */
export class MethodAtCommand implements Exec {
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
 * Execute the method at command.
 */
export function exec(args: CommandArgs): string {
  return new MethodAtCommand(args).exec();
}
