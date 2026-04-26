/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-shamir-rust/src/error.rs

/**
 * Error types for Shamir secret sharing operations.
 *
 * Each variant mirrors a corresponding `Error::*` enum in
 * `bc-shamir-rust/src/error.rs` with the same trigger conditions and the
 * same default `Display` strings.
 *
 * Note on `InterpolationFailure`: this variant is **reserved but
 * unreachable** in both the Rust and TypeScript implementations.
 * `interpolate()` in `interpolate.ts` never actually returns / throws an
 * interpolation failure today — the Lagrange-basis math always succeeds
 * for any well-formed input. The variant is kept for forward
 * compatibility (e.g. should a future revision add input validation that
 * could reject pathological cases) and to keep the TS error type a 1:1
 * mirror of Rust's `Error` enum.
 */
export enum ShamirErrorType {
  SecretTooLong = "SecretTooLong",
  TooManyShares = "TooManyShares",
  /**
   * Reserved / unreachable in both Rust and TS today. See enum doc above.
   */
  InterpolationFailure = "InterpolationFailure",
  ChecksumFailure = "ChecksumFailure",
  SecretTooShort = "SecretTooShort",
  SecretNotEvenLen = "SecretNotEvenLen",
  InvalidThreshold = "InvalidThreshold",
  SharesUnequalLength = "SharesUnequalLength",
}

/**
 * Error class for Shamir secret sharing operations.
 */
export class ShamirError extends Error {
  readonly type: ShamirErrorType;

  constructor(type: ShamirErrorType, message?: string) {
    super(message ?? ShamirError.defaultMessage(type));
    this.type = type;
    this.name = "ShamirError";
  }

  private static defaultMessage(type: ShamirErrorType): string {
    switch (type) {
      case ShamirErrorType.SecretTooLong:
        return "secret is too long";
      case ShamirErrorType.TooManyShares:
        return "too many shares";
      case ShamirErrorType.InterpolationFailure:
        return "interpolation failed";
      case ShamirErrorType.ChecksumFailure:
        return "checksum failure";
      case ShamirErrorType.SecretTooShort:
        return "secret is too short";
      case ShamirErrorType.SecretNotEvenLen:
        return "secret is not of even length";
      case ShamirErrorType.InvalidThreshold:
        return "invalid threshold";
      case ShamirErrorType.SharesUnequalLength:
        return "shares have unequal length";
    }
  }
}

/**
 * Mirrors Rust's `Result<T, Error>` for API parity.
 *
 * The TypeScript port surfaces failures by throwing `ShamirError`
 * instances rather than returning a sum type, so this alias is a no-op
 * (`ShamirResult<T>` ≡ `T`). It is kept so signatures published in
 * `@bcts/shamir` remain visually parallel to their Rust counterparts.
 */
export type ShamirResult<T> = T;
