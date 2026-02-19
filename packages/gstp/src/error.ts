/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * GSTP Error Types
 *
 * Error types returned when operating on GSTP messages.
 * Ported from gstp-rust/src/error.rs
 */

/**
 * Error codes for GSTP operations.
 */
export enum GstpErrorCode {
  /** Sender must have an encryption key. */
  SENDER_MISSING_ENCRYPTION_KEY = "SENDER_MISSING_ENCRYPTION_KEY",

  /** Recipient must have an encryption key. */
  RECIPIENT_MISSING_ENCRYPTION_KEY = "RECIPIENT_MISSING_ENCRYPTION_KEY",

  /** Sender must have a verification key. */
  SENDER_MISSING_VERIFICATION_KEY = "SENDER_MISSING_VERIFICATION_KEY",

  /** Continuation has expired. */
  CONTINUATION_EXPIRED = "CONTINUATION_EXPIRED",

  /** Continuation ID is invalid. */
  CONTINUATION_ID_INVALID = "CONTINUATION_ID_INVALID",

  /** Peer continuation must be encrypted. */
  PEER_CONTINUATION_NOT_ENCRYPTED = "PEER_CONTINUATION_NOT_ENCRYPTED",

  /** Requests must contain a peer continuation. */
  MISSING_PEER_CONTINUATION = "MISSING_PEER_CONTINUATION",

  /** Error from envelope operations. */
  ENVELOPE = "ENVELOPE",

  /** Error from XID operations. */
  XID = "XID",
}

/**
 * Error class for GSTP operations.
 *
 * Provides specific error types that can occur during GSTP message
 * creation, sealing, and parsing operations.
 */
export class GstpError extends Error {
  readonly code: GstpErrorCode;
  declare readonly cause?: Error;

  constructor(code: GstpErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = "GstpError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ("captureStackTrace" in Error) {
      (
        Error as {
          captureStackTrace(target: object, constructor: typeof GstpError): void;
        }
      ).captureStackTrace(this, GstpError);
    }
  }

  /**
   * Returned when the sender is missing an encryption key.
   */
  static senderMissingEncryptionKey(): GstpError {
    return new GstpError(
      GstpErrorCode.SENDER_MISSING_ENCRYPTION_KEY,
      "sender must have an encryption key",
    );
  }

  /**
   * Returned when the recipient is missing an encryption key.
   */
  static recipientMissingEncryptionKey(): GstpError {
    return new GstpError(
      GstpErrorCode.RECIPIENT_MISSING_ENCRYPTION_KEY,
      "recipient must have an encryption key",
    );
  }

  /**
   * Returned when the sender is missing a verification key.
   */
  static senderMissingVerificationKey(): GstpError {
    return new GstpError(
      GstpErrorCode.SENDER_MISSING_VERIFICATION_KEY,
      "sender must have a verification key",
    );
  }

  /**
   * Returned when the continuation has expired.
   */
  static continuationExpired(): GstpError {
    return new GstpError(GstpErrorCode.CONTINUATION_EXPIRED, "continuation expired");
  }

  /**
   * Returned when the continuation ID is invalid.
   */
  static continuationIdInvalid(): GstpError {
    return new GstpError(GstpErrorCode.CONTINUATION_ID_INVALID, "continuation ID invalid");
  }

  /**
   * Returned when the peer continuation is not encrypted.
   */
  static peerContinuationNotEncrypted(): GstpError {
    return new GstpError(
      GstpErrorCode.PEER_CONTINUATION_NOT_ENCRYPTED,
      "peer continuation must be encrypted",
    );
  }

  /**
   * Returned when a request is missing the peer continuation.
   */
  static missingPeerContinuation(): GstpError {
    return new GstpError(
      GstpErrorCode.MISSING_PEER_CONTINUATION,
      "requests must contain a peer continuation",
    );
  }

  /**
   * Envelope error wrapper.
   */
  static envelope(cause?: Error): GstpError {
    return new GstpError(GstpErrorCode.ENVELOPE, "envelope error", cause);
  }

  /**
   * XID error wrapper.
   */
  static xid(cause?: Error): GstpError {
    return new GstpError(GstpErrorCode.XID, "XID error", cause);
  }
}
