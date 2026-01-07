/**
 * Attachment add envelope command - 1:1 port of cmd/attachment/add/envelope.rs
 *
 * Add an attachment to the given envelope.
 * The attachment is provided as a single attachment envelope.
 */

import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";

/**
 * Command arguments for the add envelope command.
 */
export interface CommandArgs {
  /** The attachment envelope */
  attachment: string;
  /** The envelope to add the attachment to */
  envelope?: string;
}

/**
 * Add envelope command implementation.
 */
export class AddEnvelopeCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const attachment = readEnvelope(this.args.attachment);
    attachment.validateAttachment();
    return envelope.addAssertionEnvelope(attachment).urString();
  }
}

/**
 * Execute the add envelope command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AddEnvelopeCommand(args).exec();
}
