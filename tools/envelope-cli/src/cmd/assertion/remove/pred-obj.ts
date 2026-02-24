/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Assertion remove pred-obj command - 1:1 port of cmd/assertion/remove/pred_obj.rs
 *
 * Remove an assertion with the given predicate and object from the given envelope.
 */

import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { assertionEnvelope, type PredObjArgsLike } from "../../../pred-obj-args.js";

/**
 * Command arguments for the remove pred-obj command.
 */
export interface CommandArgs extends PredObjArgsLike {
  /** The envelope to remove the assertion from */
  envelope?: string;
}

/**
 * Remove pred-obj command implementation.
 */
export class RemovePredObjCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const assertion = assertionEnvelope(this.args);
    return envelope.removeAssertion(assertion).urString();
  }
}

/**
 * Execute the remove pred-obj command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new RemovePredObjCommand(args).exec();
}
