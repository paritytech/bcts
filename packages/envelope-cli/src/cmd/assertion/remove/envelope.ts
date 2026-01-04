/**
 * Assertion remove envelope command - 1:1 port of cmd/assertion/remove/envelope.rs
 *
 * Remove an assertion from the given envelope. The assertion must be a single
 * envelope containing the entire assertion.
 */

import { Envelope } from "@bcts/envelope";
import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";

/**
 * Command arguments for the remove envelope command.
 */
export interface CommandArgs {
  /** The assertion to remove (must be a single envelope containing the entire assertion) */
  assertion: string;
  /** The envelope to remove the assertion from */
  envelope?: string;
}

/**
 * Remove envelope command implementation.
 */
export class RemoveEnvelopeCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const assertion = Envelope.fromURString(this.args.assertion);
    return envelope.removeAssertion(assertion).urString();
  }
}

/**
 * Execute the remove envelope command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new RemoveEnvelopeCommand(args).exec();
}
