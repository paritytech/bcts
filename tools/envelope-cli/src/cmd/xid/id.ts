/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID id command - 1:1 port of cmd/xid/id.rs
 *
 * Validate the XID document and return its XID identifier.
 */

import { XIDDocument } from "@bcts/xid";
import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";
import type { VerifyArgs } from "./verify-args.js";
import { verifySignature } from "./verify-args.js";

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
    format: [IDFormat.Ur],
  };
}

/**
 * ID command implementation.
 */
export class IdCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const verify = verifySignature(this.args.verifyArgs);
    const xidDocument = XIDDocument.fromEnvelope(envelope, undefined, verify);

    const results = this.args.format.map((format) => {
      switch (format) {
        case IDFormat.Ur:
          return xidDocument.xid().urString();
        case IDFormat.Hex:
          return xidDocument.xid().toString();
        case IDFormat.Bytewords:
          return xidDocument.xid().bytewordsIdentifier(true);
        case IDFormat.Bytemoji:
          return xidDocument.xid().bytemojisIdentifier(true);
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
