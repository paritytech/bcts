/**
 * Attachment vendor command - 1:1 port of cmd/attachment/vendor.rs
 *
 * Get the vendor of the attachment.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the vendor command.
 */
export interface CommandArgs {
  /** The attachment envelope */
  attachment?: string;
}

/**
 * Vendor command implementation.
 */
export class VendorCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const attachment = readEnvelope(this.args.attachment);
    return attachment.attachmentVendor();
  }
}

/**
 * Execute the vendor command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new VendorCommand(args).exec();
}
