/**
 * XID resolution count command - 1:1 port of cmd/xid/resolution/count.rs
 *
 * Print the count of the XID document's resolution methods.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the resolution count command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Resolution count command implementation.
 */
export class ResolutionCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    return xidDocument.resolutionMethods().size.toString();
  }
}

/**
 * Execute the resolution count command.
 */
export function exec(args: CommandArgs): string {
  return new ResolutionCountCommand(args).exec();
}
