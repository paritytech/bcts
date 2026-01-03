/**
 * Salt command - 1:1 port of cmd/salt.rs
 *
 * Add random salt to the envelope.
 */

import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";

/**
 * Command arguments for the salt command.
 */
export interface CommandArgs {
  /** The size of the salt to add to the envelope */
  size?: number;
  /** The envelope to add salt to */
  envelope?: string;
}

/**
 * Salt command implementation.
 */
export class SaltCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    if (this.args.size !== undefined) {
      return envelope.addSaltWithLen(this.args.size).urString();
    } else {
      return envelope.addSalt().urString();
    }
  }
}

/**
 * Execute the salt command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new SaltCommand(args).exec();
}
