/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID attachment at command - 1:1 port of cmd/xid/attachment/at.rs
 *
 * Retrieve the attachment at the given index.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the attachment at command.
 */
export interface CommandArgs {
  index: number;
  envelope?: string;
}

/**
 * Attachment at command implementation.
 */
export class AttachmentAtCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const envelope = xidDocument.toEnvelope();
    const attachments = envelope.attachments();
    const items = [...attachments];
    if (this.args.index >= items.length) {
      throw new Error("Index out of bounds");
    }
    return items[this.args.index].urString();
  }
}

/**
 * Execute the attachment at command.
 */
export function exec(args: CommandArgs): string {
  return new AttachmentAtCommand(args).exec();
}
