/**
 * Subject assertion command - 1:1 port of cmd/subject/assertion.rs
 *
 * Create an envelope with the given assertion (predicate and object).
 */

import type { Exec } from "../../exec.js";
import { assertionEnvelope, type PredObjArgsLike } from "../../pred-obj-args.js";

/**
 * Command arguments for the assertion command.
 */
export interface CommandArgs extends PredObjArgsLike {}

/**
 * Assertion command implementation.
 */
export class AssertionCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    return assertionEnvelope(this.args).urString();
  }
}

/**
 * Execute the assertion command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AssertionCommand(args).exec();
}
