/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Assertion all command - 1:1 port of cmd/assertion/all.rs
 *
 * Retrieve all the envelope's assertions.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the all command.
 */
export interface CommandArgs {
  /** The envelope to get assertions from */
  envelope?: string;
}

/**
 * All assertions command implementation.
 */
export class AllCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const assertions = envelope.assertions();
    return assertions.map((a) => a.urString()).join("\n");
  }
}

/**
 * Execute the all command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AllCommand(args).exec();
}
