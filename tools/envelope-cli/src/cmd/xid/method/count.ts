/**
 * XID method count command - 1:1 port of cmd/xid/method/count.rs
 *
 * Print the count of the XID document's resolution methods.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the method count command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Method count command implementation.
 */
export class MethodCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    return xidDocument.resolutionMethods().size.toString();
  }
}

/**
 * Execute the method count command.
 */
export function exec(args: CommandArgs): string {
  return new MethodCountCommand(args).exec();
}
