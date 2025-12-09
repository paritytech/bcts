// Ported from bc-sskr-rust/src/error.rs

import type { ShamirError } from "@blockchain-commons/shamir";

/**
 * Error types for SSKR operations.
 */
export enum SSKRErrorType {
  DuplicateMemberIndex = "DuplicateMemberIndex",
  GroupSpecInvalid = "GroupSpecInvalid",
  GroupCountInvalid = "GroupCountInvalid",
  GroupThresholdInvalid = "GroupThresholdInvalid",
  MemberCountInvalid = "MemberCountInvalid",
  MemberThresholdInvalid = "MemberThresholdInvalid",
  NotEnoughGroups = "NotEnoughGroups",
  SecretLengthNotEven = "SecretLengthNotEven",
  SecretTooLong = "SecretTooLong",
  SecretTooShort = "SecretTooShort",
  ShareLengthInvalid = "ShareLengthInvalid",
  ShareReservedBitsInvalid = "ShareReservedBitsInvalid",
  SharesEmpty = "SharesEmpty",
  ShareSetInvalid = "ShareSetInvalid",
  ShamirError = "ShamirError",
}

/**
 * Error class for SSKR operations.
 */
export class SSKRError extends Error {
  readonly type: SSKRErrorType;
  readonly shamirError?: ShamirError | undefined;

  constructor(type: SSKRErrorType, message?: string, shamirError?: ShamirError) {
    super(message ?? SSKRError.defaultMessage(type, shamirError));
    this.type = type;
    this.shamirError = shamirError;
    this.name = "SSKRError";
  }

  private static defaultMessage(type: SSKRErrorType, shamirError?: ShamirError): string {
    switch (type) {
      case SSKRErrorType.DuplicateMemberIndex:
        return "When combining shares, the provided shares contained a duplicate member index";
      case SSKRErrorType.GroupSpecInvalid:
        return "Invalid group specification";
      case SSKRErrorType.GroupCountInvalid:
        return "When creating a split spec, the group count is invalid";
      case SSKRErrorType.GroupThresholdInvalid:
        return "SSKR group threshold is invalid";
      case SSKRErrorType.MemberCountInvalid:
        return "SSKR member count is invalid";
      case SSKRErrorType.MemberThresholdInvalid:
        return "SSKR member threshold is invalid";
      case SSKRErrorType.NotEnoughGroups:
        return "SSKR shares did not contain enough groups";
      case SSKRErrorType.SecretLengthNotEven:
        return "SSKR secret is not of even length";
      case SSKRErrorType.SecretTooLong:
        return "SSKR secret is too long";
      case SSKRErrorType.SecretTooShort:
        return "SSKR secret is too short";
      case SSKRErrorType.ShareLengthInvalid:
        return "SSKR shares did not contain enough serialized bytes";
      case SSKRErrorType.ShareReservedBitsInvalid:
        return "SSKR shares contained invalid reserved bits";
      case SSKRErrorType.SharesEmpty:
        return "SSKR shares were empty";
      case SSKRErrorType.ShareSetInvalid:
        return "SSKR shares were invalid";
      case SSKRErrorType.ShamirError:
        return shamirError != null
          ? `SSKR Shamir error: ${shamirError.message}`
          : "SSKR Shamir error";
    }
  }

  static fromShamirError(error: ShamirError): SSKRError {
    return new SSKRError(SSKRErrorType.ShamirError, undefined, error);
  }
}

export type SSKRResult<T> = T;
