/**
 * Assertion at command - 1:1 port of cmd/assertion/at.rs
 *
 * Retrieve the assertion at the given index.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope } from "../../utils.js";

/**
 * Command arguments for the at command.
 */
export interface CommandArgs {
  /** The index of the assertion to retrieve */
  index: number;
  /** The envelope to get assertion from */
  envelope?: string;
}

/**
 * At command implementation.
 */
export class AtCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const assertions = envelope.assertions();
    const assertion = assertions[this.args.index];
    if (assertion === undefined) {
      throw new Error("Index out of bounds");
    }
    return assertion.urString();
  }
}

/**
 * Execute the at command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AtCommand(args).exec();
}
