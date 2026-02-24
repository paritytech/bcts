/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Ported from bc-shamir-rust/src/error.rs

/**
 * Error types for Shamir secret sharing operations.
 */
export enum ShamirErrorType {
  SecretTooLong = "SecretTooLong",
  TooManyShares = "TooManyShares",
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

export type ShamirResult<T> = T;
