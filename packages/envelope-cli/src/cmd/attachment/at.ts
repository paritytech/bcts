/**
 * Attachment at command - 1:1 port of cmd/attachment/at.rs
 *
 * Get the attachment at the specified index.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the at command.
 */
export interface CommandArgs {
  /** The index of the attachment to retrieve */
  index: number;
  /** The envelope to get attachment from */
  envelope?: string;
}

/**
 * At command implementation.
 */
export class AtCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const attachments = envelope.attachments();
    const attachment = attachments[this.args.index];
    if (attachment === undefined) {
      throw new Error(`No attachment at index ${this.args.index}`);
    }
    return attachment.urString();
  }
}

/**
 * Execute the at command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AtCommand(args).exec();
}
