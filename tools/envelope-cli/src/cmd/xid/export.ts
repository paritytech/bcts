/**
 * XID export command - 1:1 port of cmd/xid/export.rs
 *
 * Export a XID document in various formats.
 */

import { XIDDocument } from "@bcts/xid";
import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";
import type { VerifyArgs } from "./verify-args.js";
import { verifySignature } from "./verify-args.js";

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
  /** Signature verification arguments */
  verifyArgs: VerifyArgs;
  /** The XID document envelope */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    format: ExportFormat.Envelope,
  };
}

/**
 * Export command implementation.
 */
export class ExportCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const verify = verifySignature(this.args.verifyArgs);
    const xidDocument = XIDDocument.fromEnvelope(envelope, undefined, verify);

    switch (this.args.format) {
      case ExportFormat.Envelope:
        return xidDocument.toEnvelope().urString();
      case ExportFormat.Xid:
        return xidDocument.xid().urString();
      case ExportFormat.Json:
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
