/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Attachment add components command - 1:1 port of cmd/attachment/add/components.rs
 *
 * Add an attachment to the given envelope by specifying its components.
 * The components of the attachment are provided as separate arguments.
 */

import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";

/**
 * Command arguments for the add components command.
 */
export interface CommandArgs {
  /** The vendor of the attachment. Usually a reverse domain name. */
  vendor: string;
  /** An optional conforms-to value of the attachment. Usually a URI. */
  conformsTo?: string;
  /** The payload of the attachment. Entirely defined by the vendor. */
  payload: string;
  /** The envelope to add the attachment to */
  envelope?: string;
}

/**
 * Add components command implementation.
 */
export class AddComponentsCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const payload = readEnvelope(this.args.payload);
    return envelope.addAttachment(payload, this.args.vendor, this.args.conformsTo).urString();
  }
}

/**
 * Execute the add components command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AddComponentsCommand(args).exec();
}
