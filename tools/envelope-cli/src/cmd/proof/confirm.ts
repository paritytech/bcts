/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Proof confirm command - 1:1 port of cmd/proof/confirm.rs
 *
 * Confirm that an elided envelope contains a target digest using a proof.
 * On success, print the original envelope so it can be piped to the next
 * operation. On failure, exit with an error condition.
 */

import { Envelope } from "@bcts/envelope";
import type { Exec } from "../../exec.js";
import { readEnvelope, parseDigests } from "../../utils.js";

/**
 * Command arguments for the confirm command.
 */
export interface CommandArgs {
  /** The proof envelope to use */
  proof: string;
  /** The target set of digests (ur:digest or ur:envelope separated by space) */
  target: string;
  /** Don't output the envelope on success */
  silent: boolean;
  /** The envelope to confirm */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    silent: false,
  };
}

/**
 * Confirm command implementation.
 */
export class ConfirmCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const proof = Envelope.fromUrString(this.args.proof);
    const digests = parseDigests(this.args.target);

    if (!envelope.confirmContainsSet(digests, proof)) {
      throw new Error("Proof does not confirm target");
    }

    if (this.args.silent) {
      return "";
    }
    return envelope.urString();
  }
}

/**
 * Execute the confirm command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new ConfirmCommand(args).exec();
}
