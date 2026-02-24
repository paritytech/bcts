/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Assertion add pred-obj command - 1:1 port of cmd/assertion/add/pred_obj.rs
 *
 * Add an assertion with the given predicate and object to the given envelope.
 */

import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { assertionEnvelope, type PredObjArgsLike } from "../../../pred-obj-args.js";

/**
 * Command arguments for the add pred-obj command.
 */
export interface CommandArgs extends PredObjArgsLike {
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
 * Add pred-obj command implementation.
 */
export class AddPredObjCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const assertion = assertionEnvelope(this.args);
    return envelope.addAssertionEnvelopeSalted(assertion, this.args.salted).urString();
  }
}

/**
 * Execute the add pred-obj command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new AddPredObjCommand(args).exec();
}
