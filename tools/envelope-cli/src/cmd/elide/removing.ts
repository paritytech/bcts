/**
 * Elide removing command - 1:1 port of cmd/elide/removing.rs
 *
 * Elide all objects in the target (remove them from the envelope).
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";
import { runElide, type ElideArgsLike, Action } from "./elide-args.js";

/**
 * Command arguments for the removing command.
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
 * Removing command implementation.
 */
export class RemovingCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const result = runElide(this.args, envelope, false);
    return result.urString();
  }
}

/**
 * Execute the removing command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new RemovingCommand(args).exec();
}
