// Ported from provenance-mark-rust

// Error types
export {
  ProvenanceMarkError,
  ProvenanceMarkErrorType,
  type ProvenanceMarkResult,
} from "./error.js";

// Resolution types and utilities
export {
  ProvenanceMarkResolution,
  resolutionToNumber,
  resolutionFromNumber,
  linkLength,
  seqBytesLength,
  dateBytesLength,
  fixedLength,
  keyRange,
  chainIdRange,
  hashRange,
  seqBytesRange,
  dateBytesRange,
  infoRangeStart,
  serializeDate,
  deserializeDate,
  serializeSeq,
  deserializeSeq,
  resolutionToString,
  resolutionToCbor,
  resolutionFromCbor,
} from "./resolution.js";

// Date utilities
export {
  type SerializableDate,
  serialize2Bytes,
  deserialize2Bytes,
  serialize4Bytes,
  deserialize4Bytes,
  serialize6Bytes,
  deserialize6Bytes,
  rangeOfDaysInMonth,
  dateToIso8601,
  dateFromIso8601,
  dateToDateString,
} from "./date.js";

// Crypto utilities
export {
  SHA256_SIZE,
  sha256,
  sha256Prefix,
  extendKey,
  hkdfHmacSha256,
  obfuscate,
} from "./crypto-utils.js";

// PRNG
export { Xoshiro256StarStar } from "./xoshiro256starstar.js";

// RNG State
export { RngState, RNG_STATE_LENGTH } from "./rng-state.js";

// Seed
export { ProvenanceSeed, PROVENANCE_SEED_LENGTH } from "./seed.js";

// Mark
export { ProvenanceMark } from "./mark.js";

// Generator
export { ProvenanceMarkGenerator } from "./generator.js";

// Validation
export {
  ValidationReportFormat,
  type ValidationIssue,
  type FlaggedMark,
  type SequenceReport,
  type ChainReport,
  type ValidationReport,
  formatValidationIssue,
  chainIdHex,
  hasIssues,
  formatReport,
  validate,
} from "./validate.js";

// Mark Info
export { ProvenanceMarkInfo } from "./mark-info.js";

// Envelope support
export {
  registerTags,
  registerTagsIn,
  provenanceMarkToEnvelope,
  provenanceMarkFromEnvelope,
  provenanceMarkGeneratorToEnvelope,
  provenanceMarkGeneratorFromEnvelope,
} from "./envelope.js";

// Re-export FormatContext for registerTagsIn callers
export { FormatContext } from "@bcts/envelope";
