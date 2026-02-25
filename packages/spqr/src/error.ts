/**
 * Copyright © 2025 Signal Messenger, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Error types for the SPQR protocol.
 */

export class SpqrError extends Error {
  constructor(
    message: string,
    public readonly code: SpqrErrorCode,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "SpqrError";
  }
}

export enum SpqrErrorCode {
  StateDecode = "STATE_DECODE",
  NotImplemented = "NOT_IMPLEMENTED",
  MsgDecode = "MSG_DECODE",
  MacVerifyFailed = "MAC_VERIFY_FAILED",
  EpochOutOfRange = "EPOCH_OUT_OF_RANGE",
  EncodingDecoding = "ENCODING_DECODING",
  Serialization = "SERIALIZATION",
  VersionMismatch = "VERSION_MISMATCH",
  MinimumVersion = "MINIMUM_VERSION",
  KeyJump = "KEY_JUMP",
  KeyTrimmed = "KEY_TRIMMED",
  KeyAlreadyRequested = "KEY_ALREADY_REQUESTED",
  ErroneousDataReceived = "ERRONEOUS_DATA_RECEIVED",
  SendKeyEpochDecreased = "SEND_KEY_EPOCH_DECREASED",
  InvalidParams = "INVALID_PARAMS",
  ChainNotAvailable = "CHAIN_NOT_AVAILABLE",
}

export class EncodingError extends Error {
  constructor(
    message: string,
    public readonly inner?: PolynomialError,
  ) {
    super(message);
    this.name = "EncodingError";
  }
}

export class PolynomialError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MESSAGE_LENGTH_EVEN"
      | "MESSAGE_LENGTH_TOO_LONG"
      | "SERIALIZATION_INVALID",
  ) {
    super(message);
    this.name = "PolynomialError";
  }
}

export class AuthenticatorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_CT_MAC"
      | "INVALID_HDR_MAC"
      | "ROOT_KEY_PRESENT"
      | "ROOT_KEY_MISSING"
      | "MAC_KEY_PRESENT"
      | "MAC_KEY_MISSING",
  ) {
    super(message);
    this.name = "AuthenticatorError";
  }
}
