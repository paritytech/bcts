/**
 * XID attachment all command - 1:1 port of cmd/xid/attachment/all.rs
 *
 * Retrieve all the XID document's attachments.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the attachment all command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Attachment all command implementation.
 */
export class AttachmentAllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const envelope = xidDocument.toEnvelope();
    const attachments = [...envelope.attachments()];
    return attachments.map((a) => a.urString()).join("\n");
  }
}

/**
 * Execute the attachment all command.
 */
export function exec(args: CommandArgs): string {
  return new AttachmentAllCommand(args).exec();
}
