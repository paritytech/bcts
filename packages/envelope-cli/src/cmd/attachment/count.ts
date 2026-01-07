/**
 * Attachment count command - 1:1 port of cmd/attachment/count.rs
 *
 * Print the count of the envelope's attachments.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the count command.
 */
export interface CommandArgs {
  /** The envelope to count attachments from */
  envelope?: string;
}

/**
 * Count command implementation.
 */
export class CountCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    return envelope.attachments().length.toString();
  }
}

/**
 * Execute the count command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new CountCommand(args).exec();
}
