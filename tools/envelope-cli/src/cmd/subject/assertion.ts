/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Subject assertion command - 1:1 port of cmd/subject/assertion.rs
 *
 * Create an envelope with the given assertion (predicate and object).
 */

import type { Exec } from "../../exec.js";
import { assertionEnvelope, type PredObjArgsLike } from "../../pred-obj-args.js";

/**
 * Command arguments for the assertion command.
 */
export type CommandArgs = PredObjArgsLike;

/**
 * Assertion command implementation.
 */
export class AssertionCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

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
