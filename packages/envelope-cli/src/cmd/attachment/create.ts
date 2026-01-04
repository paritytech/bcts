/**
 * Attachment create command - 1:1 port of cmd/attachment/create.rs
 *
 * Create an attachment.
 */

import { Envelope } from "@bcts/envelope";
import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the create command.
 */
export interface CommandArgs {
  /** The vendor of the attachment. Usually a reverse domain name. */
  vendor: string;
  /** An optional conforms-to value of the attachment. Usually a URI. */
  conformsTo?: string;
  /** The payload of the attachment. Entirely defined by the vendor. */
  payload?: string;
}

/**
 * Create command implementation.
 */
export class CreateCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const payload = readEnvelope(this.args.payload);
    const assertion = Envelope.newAttachment(payload, this.args.vendor, this.args.conformsTo);
    return assertion.urString();
  }
}

/**
 * Execute the create command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new CreateCommand(args).exec();
}
