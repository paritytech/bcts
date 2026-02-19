/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID attachment find command - 1:1 port of cmd/xid/attachment/find.rs
 *
 * Find attachments by vendor and/or conformsTo.
 */

import type { Exec } from "../../../exec.js";
import { readXidDocument } from "../xid-utils.js";

/**
 * Command arguments for the attachment find command.
 */
export interface CommandArgs {
  vendor?: string;
  conformsTo?: string;
  envelope?: string;
}

/**
 * Attachment find command implementation.
 */
export class AttachmentFindCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const xidDocument = readXidDocument(this.args.envelope);
    const envelope = xidDocument.toEnvelope();
    const found = envelope.attachmentsWithVendorAndConformsTo(
      this.args.vendor,
      this.args.conformsTo,
    );
    return [...found].map((a) => a.urString()).join("\n");
  }
}

/**
 * Execute the attachment find command.
 */
export function exec(args: CommandArgs): string {
  return new AttachmentFindCommand(args).exec();
}
