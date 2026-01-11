/**
 * XID export command - 1:1 port of cmd/xid/export.rs
 *
 * Export a XID document in various formats.
 *
 * NOTE: Signature verification and JSON export are not yet fully implemented
 * in the TypeScript version.
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
  /** Whether to verify the signature (not yet implemented) */
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
    verifySignature: false,
  };
}

/**
 * Export command implementation.
 */
export class ExportCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const xidDocument = XIDDocument.fromEnvelope(envelope);

    if (this.args.verifySignature) {
      // verifySignature() method doesn't exist on XIDDocument in TS
      console.warn("Warning: Signature verification is not yet implemented in TypeScript XID");
    }

    switch (this.args.format) {
      case ExportFormat.Envelope:
        return xidDocument.toEnvelope().urString();
      case ExportFormat.Xid:
        return xidDocument.xid().urString();
      case ExportFormat.Json:
        // toJson() method doesn't exist on XIDDocument in TS
        throw new Error(
          "JSON export is not yet implemented in the TypeScript XID library. " +
            "Use --format envelope or --format xid instead.",
        );
    }
  }
}

/**
 * Execute the export command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new ExportCommand(args).exec();
}
