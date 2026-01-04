/**
 * XID export command - 1:1 port of cmd/xid/export.rs
 *
 * Export a XID document in various formats.
 */

import { XIDDocument } from "@bcts/xid";
import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Export format options.
 */
export enum ExportFormat {
  /** Envelope UR format */
  Envelope = "envelope",
  /** XID UR format */
  Xid = "xid",
  /** JSON format */
  Json = "json",
}

/**
 * Command arguments for the export command.
 */
export interface CommandArgs {
  /** Output format */
  format: ExportFormat;
  /** Whether to verify the signature */
  verifySignature: boolean;
  /** The XID document envelope */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    format: ExportFormat.Envelope,
    verifySignature: true,
  };
}

/**
 * Export command implementation.
 */
export class ExportCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const xidDocument = XIDDocument.fromEnvelope(envelope);

    if (this.args.verifySignature) {
      xidDocument.verifySignature();
    }

    switch (this.args.format) {
      case ExportFormat.Envelope:
        return xidDocument.toEnvelope().urString();
      case ExportFormat.Xid:
        return xidDocument.xid().urString();
      case ExportFormat.Json:
        return JSON.stringify(xidDocument.toJson(), null, 2);
    }
  }
}

/**
 * Execute the export command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new ExportCommand(args).exec();
}
