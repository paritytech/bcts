// Blockchain Commons Sharded Secret Key Reconstruction (SSKR)
// Ported from bc-sskr-rust
//
// Sharded Secret Key Reconstruction (SSKR) is a protocol for splitting a
// secret into a set of shares across one or more groups, such that the
// secret can be reconstructed from any combination of shares totaling or
// exceeding a threshold number of shares within each group and across all
// groups. SSKR is a generalization of Shamir's Secret Sharing (SSS) that
// allows for multiple groups and multiple thresholds.

import {
  MIN_SECRET_LEN as SHAMIR_MIN_SECRET_LEN,
  MAX_SECRET_LEN as SHAMIR_MAX_SECRET_LEN,
  MAX_SHARE_COUNT as SHAMIR_MAX_SHARE_COUNT,
} from "@blockchain-commons/shamir";

/**
 * The minimum length of a secret.
 */
export const MIN_SECRET_LEN = SHAMIR_MIN_SECRET_LEN;

/**
 * The maximum length of a secret.
 */
export const MAX_SECRET_LEN = SHAMIR_MAX_SECRET_LEN;

/**
 * The maximum number of shares that can be generated from a secret.
 */
export const MAX_SHARE_COUNT = SHAMIR_MAX_SHARE_COUNT;

/**
 * The maximum number of groups in a split.
 */
export const MAX_GROUPS_COUNT = MAX_SHARE_COUNT;

/**
 * The number of bytes used to encode the metadata for a share.
 */
export const METADATA_SIZE_BYTES = 5;

/**
 * The minimum number of bytes required to encode a share.
 */
export const MIN_SERIALIZE_SIZE_BYTES = METADATA_SIZE_BYTES + MIN_SECRET_LEN;

// Error types
export { SSKRError, SSKRErrorType, type SSKRResult } from "./error.js";

// Secret
export { Secret } from "./secret.js";

// Specifications
export { GroupSpec, Spec } from "./spec.js";

// Share
export { SSKRShare } from "./share.js";

// Encoding/Decoding
export { sskrGenerate, sskrGenerateUsing, sskrCombine } from "./encoding.js";
