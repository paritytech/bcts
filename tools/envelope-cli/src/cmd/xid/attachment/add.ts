/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * XID attachment add command - 1:1 port of cmd/xid/attachment/add.rs
 *
 * Add an attachment to the XID document.
 */

import type { ExecAsync } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import type { OutputOptions } from "../output-options.js";
import type { ReadWritePasswordArgs } from "../password-args.js";
import type { SigningArgs } from "../signing-args.js";
import { signingOptions } from "../signing-args.js";
import type { VerifyArgs } from "../verify-args.js";
import { verifySignature } from "../verify-args.js";
import { readXidDocumentWithPassword, xidDocumentToUrString } from "../xid-utils.js";

/**
 * Command arguments for the attachment add command.
 */
export interface CommandArgs {
  /** Pre-made attachment envelope */
  attachment?: string;
  /** Vendor string for constructing attachment */
  vendor?: string;
  /** Payload data for constructing attachment */
  payload?: string;
  /** Conforms-to URI */
  conformsTo?: string;
  outputOpts: OutputOptions;
  passwordArgs: ReadWritePasswordArgs;
  verifyArgs: VerifyArgs;
  signingArgs: SigningArgs;
  envelope?: string;
}

/**
 * Attachment add command implementation.
 */
export class AttachmentAddCommand implements ExecAsync {
  constructor(private readonly args: CommandArgs) {}

  async exec(): Promise<string> {
    const xidDocument = await readXidDocumentWithPassword(
      this.args.envelope,
      this.args.passwordArgs.read,
      verifySignature(this.args.verifyArgs),
    );

    if (this.args.attachment !== undefined) {
      // Pre-made attachment envelope
      const attachmentEnvelope = readEnvelope(this.args.attachment);
      xidDocument.addAttachment(attachmentEnvelope, this.args.vendor ?? "", this.args.conformsTo);
    } else if (this.args.vendor !== undefined && this.args.payload !== undefined) {
      // Construct from parts
      const payloadEnvelope = readEnvelope(this.args.payload);
      xidDocument.addAttachment(payloadEnvelope, this.args.vendor, this.args.conformsTo);
    } else {
      throw new Error("Either --attachment or --vendor and --payload must be specified");
    }

    const signing = await signingOptions(this.args.signingArgs, this.args.passwordArgs.read);

    return xidDocumentToUrString(
      xidDocument,
      this.args.outputOpts,
      this.args.passwordArgs.write,
      undefined,
      signing,
    );
  }
}

/**
 * Execute the attachment add command.
 */
export async function exec(args: CommandArgs): Promise<string> {
  return new AttachmentAddCommand(args).exec();
}
