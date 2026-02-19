/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Attachment all command - 1:1 port of cmd/attachment/all.rs
 *
 * Retrieve all the envelope's attachments.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the all command.
 */
export interface CommandArgs {
  /** The envelope to get attachments from */
  envelope?: string;
}

/**
 * All attachments command implementation.
 */
export class AllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const attachments = envelope.attachments();
    return attachments.map((a) => a.urString()).join("\n");
  }
}

/**
 * Execute the all command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AllCommand(args).exec();
}
