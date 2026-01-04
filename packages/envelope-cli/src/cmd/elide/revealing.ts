/**
 * Elide revealing command - 1:1 port of cmd/elide/revealing.rs
 *
 * Elide all objects not in the target (reveal only the target elements).
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";
import { runElide, type ElideArgsLike, Action } from "./elide-args.js";

/**
 * Command arguments for the revealing command.
 */
export interface CommandArgs extends ElideArgsLike {
  /** The envelope to elide */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    action: Action.Elide,
  };
}

/**
 * Revealing command implementation.
 */
export class RevealingCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const result = runElide(this.args, envelope, true);
    return result.urString();
  }
}

/**
 * Execute the revealing command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new RevealingCommand(args).exec();
}
