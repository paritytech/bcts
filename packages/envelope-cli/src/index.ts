/**
 * @bcts/envelope-cli - Gordian Envelope command line tool
 *
 * 1:1 port of bc-envelope-cli-rust
 *
 * @packageDocumentation
 */

export const VERSION = "1.0.0-alpha.13";

// Core types
export type { Exec, ExecAsync } from "./exec.js";
export type { DataType } from "./data-types.js";
export type { EnvelopeArgsLike } from "./envelope-args.js";
export type { SubjectArgsLike } from "./subject-args.js";
export type { PredObjArgsLike } from "./pred-obj-args.js";

// Data type utilities
export { parseDataTypeToEnvelope, parseUrToCbor, bytesToHex } from "./data-types.js";

// Utility functions
export {
  readEnvelope,
  readStdinBytes,
  readStdinSync,
  readStdinLine,
  readArgument,
  readPassword,
  parseDigests,
  parseDigestFromUr,
  envelopeFromUr,
  ASKPASS_HELP,
  ASKPASS_LONG_HELP,
} from "./utils.js";

// Argument helpers
export { readSubjectValue } from "./subject-args.js";
export { assertionEnvelope } from "./pred-obj-args.js";

// All commands
export * as cmd from "./cmd/index.js";
