/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Attachment conforms-to command - 1:1 port of cmd/attachment/conforms_to.rs
 *
 * Get the optional conformance of the attachment.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the conforms-to command.
 */
export interface CommandArgs {
  /** The attachment envelope */
  attachment?: string;
}

/**
 * ConformsTo command implementation.
 */
export class ConformsToCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const attachment = readEnvelope(this.args.attachment);
    return attachment.attachmentConformsTo() ?? "";
  }
}

/**
 * Execute the conforms-to command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new ConformsToCommand(args).exec();
}
