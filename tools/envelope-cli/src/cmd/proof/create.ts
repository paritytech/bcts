/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Proof create command - 1:1 port of cmd/proof/create.rs
 *
 * Create an inclusion proof for the target set of digests.
 */

import type { Exec } from "../../exec.js";
import { readEnvelope, parseDigests } from "../../utils.js";

/**
 * Command arguments for the create command.
 */
export interface CommandArgs {
  /** The target set of digests (ur:digest or ur:envelope separated by space) */
  target: string;
  /** The envelope to create the proof from */
  envelope?: string;
}

/**
 * Create command implementation.
 */
export class CreateCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const digests = parseDigests(this.args.target);
    const proof = envelope.proofContainsSet(digests);
    if (proof === undefined) {
      throw new Error("No proof found for target set");
    }
    return proof.urString();
  }
}

/**
 * Execute the create command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new CreateCommand(args).exec();
}
