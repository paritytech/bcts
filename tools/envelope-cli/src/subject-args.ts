/**
 * Subject arguments module - 1:1 port of subject_args.rs
 *
 * Handles subject arguments with stdin support.
 */

import { type DataType } from "./data-types.js";
import { readStdinLine } from "./utils.js";

/**
 * Interface for arguments that include a subject.
 */
export interface SubjectArgsLike {
  /** Subject type */
  subjectType: DataType;
  /** Subject value (optional - can be read from stdin) */
  subjectValue?: string;
  /** Optional integer tag for an enclosed UR */
  urTag?: number | bigint;
}

/**
 * Read the subject value from args or stdin.
 */
export function readSubjectValue(args: SubjectArgsLike): string {
  if (args.subjectValue !== undefined && args.subjectValue !== "") {
    return args.subjectValue.trim();
  }

  const line = readStdinLine();
  if (!line) {
    throw new Error("No value provided");
  }
  return line.trim();
}

/**
 * Subject arguments structure.
 */
export interface SubjectArgs extends SubjectArgsLike {
  /** Subject type */
  subjectType: DataType;
  /** Subject value */
  subjectValue?: string;
  /** The integer tag for an enclosed UR */
  urTag?: number | bigint;
}
