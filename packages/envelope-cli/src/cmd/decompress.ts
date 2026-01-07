/**
 * Decompress command - 1:1 port of cmd/decompress.rs
 *
 * Decompress the envelope or its subject.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";

/**
 * Command arguments for the decompress command.
 */
export interface CommandArgs {
  /** Decompress only the envelope's subject */
  subject: boolean;
  /** The envelope to decompress */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): CommandArgs {
  return {
    subject: false,
  };
}

/**
 * Decompress command implementation.
 */
export class DecompressCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.subject) {
      return envelope.decompressSubject().urString();
    } else {
      return envelope.decompress().urString();
    }
  }
}

/**
 * Execute the decompress command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new DecompressCommand(args).exec();
}
