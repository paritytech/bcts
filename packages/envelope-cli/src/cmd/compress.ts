/**
 * Compress command - 1:1 port of cmd/compress.rs
 *
 * Compress the envelope or its subject.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";

/**
 * Command arguments for the compress command.
 */
export interface CommandArgs {
  /** Compress only the envelope's subject */
  subject: boolean;
  /** The envelope to compress */
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
 * Compress command implementation.
 */
export class CompressCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.subject) {
      return envelope.compressSubject().urString();
    } else {
      return envelope.compress().urString();
    }
  }
}

/**
 * Execute the compress command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new CompressCommand(args).exec();
}
