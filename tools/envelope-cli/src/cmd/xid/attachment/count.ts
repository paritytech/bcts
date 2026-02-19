/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID attachment count command - 1:1 port of cmd/xid/attachment/count.rs
 *
 * Print the count of the XID document's attachments.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the attachment count command.
 */
export interface CommandArgs {
  envelope?: string;
}

/**
 * Attachment count command implementation.
 */
export class AttachmentCountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const envelope = xidDocument.toEnvelope();
    return [...envelope.attachments()].length.toString();
  }
}

/**
 * Execute the attachment count command.
 */
export function exec(args: CommandArgs): string {
  return new AttachmentCountCommand(args).exec();
}
