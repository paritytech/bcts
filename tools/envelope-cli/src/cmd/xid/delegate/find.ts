/**
 * XID delegate find command - 1:1 port of cmd/xid/delegate/find.rs
 *
 * Find a delegate in the XID document by XID.
 */

import { XIDDocument } from "@bcts/xid";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { readXidDocument, envelopeToXidUrString } from "../xid-utils.js";

/**
 * Command arguments for the delegate find command.
 */
export interface CommandArgs {
  delegate: string;
  envelope?: string;
}

/**
 * Delegate find command implementation.
 */
export class DelegateFindCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);

    // Parse the delegate XID
    const delegateEnvelope = readEnvelope(this.args.delegate);
    const delegateDoc = XIDDocument.fromEnvelope(delegateEnvelope);
    const xid = delegateDoc.xid();

    const found = xidDocument.findDelegateByXid(xid);
    if (found === undefined) {
      return "";
    }
    return envelopeToXidUrString(found.intoEnvelope());
  }
}

/**
 * Execute the delegate find command.
 */
export function exec(args: CommandArgs): string {
  return new DelegateFindCommand(args).exec();
}
