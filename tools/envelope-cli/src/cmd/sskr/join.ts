/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * SSKR join command - 1:1 port of cmd/sskr/join.rs
 *
 * Join a set of SSKR shares back into the original envelope.
 */

import { Envelope } from "@bcts/envelope";
import type { Exec } from "../../exec.js";
import { readStdinSync } from "../../utils.js";

// SSKR extension methods are added to Envelope at import time
// but the module augmentation uses relative paths that don't resolve across packages.
const EnvelopeWithSskr = Envelope as typeof Envelope & {
  sskrJoin(envelopes: Envelope[]): Envelope;
};

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
  constructor(private readonly args: CommandArgs) {}

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

    // Parse each share string into an Envelope
    const shareEnvelopes = shares.map((s) => Envelope.fromURString(s));

    // Join the SSKR shares to recover the wrapped envelope
    const wrapped = EnvelopeWithSskr.sskrJoin(shareEnvelopes);

    // Unwrap to get the original envelope
    const result = wrapped.unwrap();

    return result.urString();
  }
}

/**
 * Execute the join command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new JoinCommand(args).exec();
}
