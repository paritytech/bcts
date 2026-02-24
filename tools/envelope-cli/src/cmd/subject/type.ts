/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Subject type command - 1:1 port of cmd/subject/type.rs
 *
 * Create an envelope with the given subject.
 */

import type { Exec } from "../../exec.js";
import { DataType, parseDataTypeToEnvelope } from "../../data-types.js";
import { readSubjectValue, type SubjectArgsLike } from "../../subject-args.js";

/**
 * Command arguments for the type command.
 */
export type CommandArgs = SubjectArgsLike;

/**
 * Type command implementation.
 */
export class TypeCommand implements Exec {
  constructor(private readonly args: CommandArgs) {}

  exec(): string {
    // Unit type takes no value - handle it specially
    const subjectValue =
      this.args.subjectType === DataType.Unit ? undefined : readSubjectValue(this.args);
    return parseDataTypeToEnvelope(this.args.subjectType, subjectValue, this.args.urTag).urString();
  }
}

/**
 * Execute the type command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new TypeCommand(args).exec();
}
