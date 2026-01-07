/**
 * Assertion add envelope command - 1:1 port of cmd/assertion/add/envelope.rs
 *
 * Add an assertion envelope to the given envelope.
 */

import { Envelope } from "@bcts/envelope";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";

/**
 * Command arguments for the add envelope command.
 */
export interface CommandArgs {
  /** The assertion to add (must be a single envelope containing the entire assertion) */
  assertion: string;
  /** Whether to add salt to the assertion */
  salted: boolean;
  /** The envelope to add the assertion to */
  envelope?: string;
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
 * Add envelope command implementation.
 */
export class AddEnvelopeCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const assertion = Envelope.fromUrString(this.args.assertion);
    return envelope.addAssertionEnvelopeSalted(assertion, this.args.salted).urString();
  }
}

/**
 * Execute the add envelope command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AddEnvelopeCommand(args).exec();
}
