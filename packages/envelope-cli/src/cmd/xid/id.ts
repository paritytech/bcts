/**
 * XID id command - 1:1 port of cmd/xid/id.rs
 *
 * Validate the XID document and return its XID identifier.
 */

import { XIDDocument } from "@bcts/xid";
import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Output format for the XID identifier.
 */
export enum IDFormat {
  /** XID Identifier UR */
  Ur = "ur",
  /** Hexadecimal */
  Hex = "hex",
  /** Bytewords */
  Bytewords = "bytewords",
  /** Bytemoji */
  Bytemoji = "bytemoji",
}

/**
 * Command arguments for the id command.
 */
export interface CommandArgs {
  /** Output format(s) of the XID identifier */
  format: IDFormat[];
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
    format: [IDFormat.Ur],
    verifySignature: true,
  };
}

/**
 * ID command implementation.
 */
export class IdCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const xidDocument = XIDDocument.fromEnvelope(envelope);

    if (this.args.verifySignature) {
      xidDocument.verifySignature();
    }

    const results = this.args.format.map((format) => {
      switch (format) {
        case IDFormat.Ur:
          return xidDocument.xid().urString();
        case IDFormat.Hex:
          return xidDocument.xid().toString();
        case IDFormat.Bytewords:
          return xidDocument.xid().bytewordsIdentifier(true);
        case IDFormat.Bytemoji:
          return xidDocument.xid().bytemojiIdentifier(true);
      }
    });

    return results.join("\n");
  }
}

/**
 * Execute the id command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new IdCommand(args).exec();
}
