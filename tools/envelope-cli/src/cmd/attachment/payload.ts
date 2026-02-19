/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Attachment payload command - 1:1 port of cmd/attachment/payload.rs
 *
 * Get the payload of the attachment.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the payload command.
 */
export interface CommandArgs {
  /** The attachment envelope */
  attachment?: string;
}

/**
 * Payload command implementation.
 */
export class PayloadCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const attachment = readEnvelope(this.args.attachment);
    return attachment.attachmentPayload().urString();
  }
}

/**
 * Execute the payload command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new PayloadCommand(args).exec();
}
