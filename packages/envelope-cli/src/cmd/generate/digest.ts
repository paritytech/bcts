/**
 * Generate digest command - 1:1 port of cmd/generate/digest.rs
 *
 * Generate a digest from the input data.
 * If the data argument is given on the command line, it is taken as a UTF-8
 * string. If it is omitted on the command line, then all available data is
 * read from stdin and treated as a binary blob.
 */

import { Digest } from "@bcts/components";
import type { Exec } from "../../exec.js";
import { readStdinBytes } from "../../utils.js";

/**
 * Command arguments for the digest command.
 */
export interface CommandArgs {
  /** The data to digest */
  data?: string;
}

/**
 * Digest command implementation.
 */
export class DigestCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    let data: Uint8Array;
    if (this.args.data !== undefined) {
      data = new TextEncoder().encode(this.args.data);
    } else {
      data = readStdinBytes();
    }
    const digest = Digest.fromImage(data);
    return digest.urString();
  }
}

/**
 * Execute the digest command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new DigestCommand(args).exec();
}
