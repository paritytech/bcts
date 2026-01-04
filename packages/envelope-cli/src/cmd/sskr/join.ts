/**
 * SSKR join command - 1:1 port of cmd/sskr/join.rs
 *
 * Join a set of SSKR shares back into the original envelope.
 */

import { Envelope } from "@bcts/envelope";
import type { Exec } from "../../exec.js";
import { readStdinSync } from "../../utils.js";

/**
 * Command arguments for the join command.
 */
export interface CommandArgs {
  /** The shares to join (ur:envelope) */
  shares: string[];
}

/**
 * Join command implementation.
 */
export class JoinCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    let shares = [...this.args.shares];

    // If shares is empty, read them from stdin, one per line
    if (shares.length === 0) {
      const input = readStdinSync();
      const lines = input.split("\n").filter((line) => line.trim());
      shares = lines.map((line) => line.trim());
    }

    // Make sure we have at least one
    if (shares.length === 0) {
      throw new Error("No share envelopes provided");
    }

    const shareEnvelopes = shares.map((s) => Envelope.fromUrString(s));
    const wrapped = Envelope.sskrJoin(shareEnvelopes);
    const result = wrapped.tryUnwrap();
    return result.urString();
  }
}

/**
 * Execute the join command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new JoinCommand(args).exec();
}
