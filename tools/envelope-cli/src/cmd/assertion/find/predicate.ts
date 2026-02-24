/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Assertion find predicate command - 1:1 port of cmd/assertion/find/predicate.rs
 *
 * Find all assertions having the given predicate.
 */

import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { parseDataTypeToEnvelope, type DataType } from "../../../data-types.js";

/**
 * Command arguments for the find predicate command.
 */
export interface CommandArgs {
  /** Subject type for the predicate to find */
  subjectType: DataType;
  /** Subject value for the predicate to find */
  subjectValue?: string;
  /** Optional integer tag for an enclosed UR */
  urTag?: number | bigint;
  /** The envelope to search */
  envelope?: string;
}

/**
 * Find predicate command implementation.
 */
export class FindPredicateCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const predicate = parseDataTypeToEnvelope(
      this.args.subjectType,
      this.args.subjectValue,
      this.args.urTag,
    );
    const assertions = envelope.assertions();
    const result = assertions
      .filter((a) => {
        const pred = a.predicate();
        return pred?.digest().equals(predicate.digest()) ?? false;
      })
      .map((a) => a.urString())
      .join("\n");
    return result;
  }
}

/**
 * Execute the find predicate command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new FindPredicateCommand(args).exec();
}
