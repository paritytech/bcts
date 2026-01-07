// Blockchain Commons Shamir Secret Sharing
// Ported from bc-shamir-rust
//
// This is a pure TypeScript implementation of Shamir's Secret Sharing (SSS),
// a cryptographic technique in which a secret is divided into parts, called
// shares, in such a way that a threshold of several shares are needed to
// reconstruct the secret. The shares are distributed in a way that makes it
// impossible for an attacker to know anything about the secret without having
// a threshold of shares. If the number of shares is less than the threshold,
// then no information about the secret is revealed.

/**
 * The minimum length of a secret.
 */
export const MIN_SECRET_LEN = 16;

/**
 * The maximum length of a secret.
 */
export const MAX_SECRET_LEN = 32;

/**
 * The maximum number of shares that can be generated from a secret.
 */
export const MAX_SHARE_COUNT = 16;

// Error types
export { ShamirError, ShamirErrorType, type ShamirResult } from "./error.js";

// Main functions
export { splitSecret, recoverSecret } from "./shamir.js";
