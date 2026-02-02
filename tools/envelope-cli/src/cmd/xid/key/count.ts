/**
 * XID key count command - 1:1 port of cmd/xid/key/count.rs
 *
 * Print the count of the XID document's keys.
 */

import type { Exec } from "../../../exec.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the key count command.
 */
export interface CommandArgs {
  verifyArgs: VerifyArgs;
  envelope?: string;
}

/**
 * Key count command implementation.
 */
export class KeyCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(
      this.args.envelope,
      verifySignature(this.args.verifyArgs),
    );
    return xidDocument.keys().length.toString();
  }
}

/**
 * Execute the key count command.
 */
export function exec(args: CommandArgs): string {
  return new KeyCountCommand(args).exec();
}
