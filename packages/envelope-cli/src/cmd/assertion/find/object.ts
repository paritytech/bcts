/**
 * Assertion find object command - 1:1 port of cmd/assertion/find/object.rs
 *
 * Find all assertions having the given object.
 */

import type { Exec } from "../../../exec.js";
import { readEnvelope } from "../../../utils.js";
import { parseDataTypeToEnvelope, type DataType } from "../../../data-types.js";

/**
 * Command arguments for the find object command.
 */
export interface CommandArgs {
  /** Subject type for the object to find */
  subjectType: DataType;
  /** Subject value for the object to find */
  subjectValue?: string;
  /** Optional integer tag for an enclosed UR */
  urTag?: number | bigint;
  /** The envelope to search */
  envelope?: string;
}

/**
 * Find object command implementation.
 */
export class FindObjectCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);
    const object = parseDataTypeToEnvelope(
      this.args.subjectType,
      this.args.subjectValue,
      this.args.urTag,
    );
    const assertions = envelope.assertions();
    const result = assertions
      .filter((a) => {
        const obj = a.object();
        return obj !== undefined && obj.digest().equals(object.digest());
      })
      .map((a) => a.urString())
      .join("\n");
    return result;
  }
}

/**
 * Execute the find object command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new FindObjectCommand(args).exec();
}
