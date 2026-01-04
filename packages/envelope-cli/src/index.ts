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
export type { DataType, DataTypeConfig } from "./data-types.js";
export type { EnvelopeArgsLike } from "./envelope-args.js";
export type { SubjectArgsLike } from "./subject-args.js";
export type { PredObjArgsLike } from "./pred-obj-args.js";

// Data type utilities
export { parseDataType, parseDataTypeToEnvelope, DATA_TYPE_HELP } from "./data-types.js";

// Utility functions
export {
  readEnvelope,
  readFromStdin,
  readStdinBytes,
  parsePrivateKeyBase,
  parsePublicKeyBase,
  parseRecipient,
  parseSigner,
  parseDigests,
  parseDigestFromUr,
  STDIN_SENTINEL,
} from "./utils.js";

// Argument helpers
export { readSubjectValue } from "./subject-args.js";
export { assertionEnvelope } from "./pred-obj-args.js";

// All commands
export * as cmd from "./cmd/index.js";
