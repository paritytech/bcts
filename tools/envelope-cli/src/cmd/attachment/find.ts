/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Attachment find command - 1:1 port of cmd/attachment/find.rs
 *
 * Retrieve attachments having the specified attributes.
 * If no attributes are specified, all attachments are returned.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the find command.
 */
export interface CommandArgs {
  /** The vendor to filter by */
  vendor?: string;
  /** The conforms-to value to filter by */
  conformsTo?: string;
  /** The envelope to search */
  envelope?: string;
}

/**
 * Find command implementation.
 */
export class FindCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const attachments = envelope.attachmentsWithVendorAndConformsTo(
      this.args.vendor,
      this.args.conformsTo,
    );
    return attachments.map((a) => a.urString()).join("\n");
  }
}

/**
 * Execute the find command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new FindCommand(args).exec();
}
