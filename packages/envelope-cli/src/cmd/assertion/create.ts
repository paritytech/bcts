/**
 * Assertion create command - 1:1 port of cmd/assertion/create.rs
 *
 * Create a bare assertion with the given predicate and object.
 */

import type { Exec } from "../../exec.js";
import { assertionEnvelope, type PredObjArgsLike } from "../../pred-obj-args.js";

/**
 * Command arguments for the create command.
 */
export interface CommandArgs extends PredObjArgsLike {
  /** Whether to add salt to the assertion */
  salted: boolean;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    salted: false,
  };
}

/**
 * Create command implementation.
 */
export class CreateCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    let result = assertionEnvelope(this.args);
    if (this.args.salted) {
      result = result.addSalt();
    }
    return result.urString();
  }
}

/**
 * Execute the create command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new CreateCommand(args).exec();
}
