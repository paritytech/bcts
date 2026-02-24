/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

/// Error types returned when operating on Gordian Envelopes.
///
/// These errors capture various conditions that can occur when working with
/// envelopes, including structure validation, operation constraints, and
/// extension-specific errors.
///
/// The errors are organized by category, reflecting the base envelope
/// specification and various extensions defined in the Gordian Envelope
/// Internet Draft and Blockchain Commons Research (BCR) documents.

export enum ErrorCode {
  // Base Specification
  ALREADY_ELIDED = "ALREADY_ELIDED",
  AMBIGUOUS_PREDICATE = "AMBIGUOUS_PREDICATE",
  INVALID_DIGEST = "INVALID_DIGEST",
  INVALID_FORMAT = "INVALID_FORMAT",
  MISSING_DIGEST = "MISSING_DIGEST",
  NONEXISTENT_PREDICATE = "NONEXISTENT_PREDICATE",
  NOT_WRAPPED = "NOT_WRAPPED",
  NOT_LEAF = "NOT_LEAF",
  NOT_ASSERTION = "NOT_ASSERTION",
  INVALID_ASSERTION = "INVALID_ASSERTION",

  // Attachments Extension
  INVALID_ATTACHMENT = "INVALID_ATTACHMENT",
  NONEXISTENT_ATTACHMENT = "NONEXISTENT_ATTACHMENT",
  AMBIGUOUS_ATTACHMENT = "AMBIGUOUS_ATTACHMENT",

  // Edges Extension
  EDGE_MISSING_IS_A = "EDGE_MISSING_IS_A",
  EDGE_MISSING_SOURCE = "EDGE_MISSING_SOURCE",
  EDGE_MISSING_TARGET = "EDGE_MISSING_TARGET",
  EDGE_DUPLICATE_IS_A = "EDGE_DUPLICATE_IS_A",
  EDGE_DUPLICATE_SOURCE = "EDGE_DUPLICATE_SOURCE",
  EDGE_DUPLICATE_TARGET = "EDGE_DUPLICATE_TARGET",
  EDGE_UNEXPECTED_ASSERTION = "EDGE_UNEXPECTED_ASSERTION",
  NONEXISTENT_EDGE = "NONEXISTENT_EDGE",
  AMBIGUOUS_EDGE = "AMBIGUOUS_EDGE",

  // Compression Extension
  ALREADY_COMPRESSED = "ALREADY_COMPRESSED",
  NOT_COMPRESSED = "NOT_COMPRESSED",

  // Symmetric Encryption Extension
  ALREADY_ENCRYPTED = "ALREADY_ENCRYPTED",
  NOT_ENCRYPTED = "NOT_ENCRYPTED",

  // Known Values Extension
  NOT_KNOWN_VALUE = "NOT_KNOWN_VALUE",

  // Public Key Encryption Extension
  UNKNOWN_RECIPIENT = "UNKNOWN_RECIPIENT",

  // Encrypted Key Extension
  UNKNOWN_SECRET = "UNKNOWN_SECRET",

  // Public Key Signing Extension
  UNVERIFIED_SIGNATURE = "UNVERIFIED_SIGNATURE",
  INVALID_OUTER_SIGNATURE_TYPE = "INVALID_OUTER_SIGNATURE_TYPE",
  INVALID_INNER_SIGNATURE_TYPE = "INVALID_INNER_SIGNATURE_TYPE",
  UNVERIFIED_INNER_SIGNATURE = "UNVERIFIED_INNER_SIGNATURE",
  INVALID_SIGNATURE_TYPE = "INVALID_SIGNATURE_TYPE",

  // SSKR Extension
  INVALID_SHARES = "INVALID_SHARES",
  SSKR = "SSKR",

  // Types Extension
  INVALID_TYPE = "INVALID_TYPE",
  AMBIGUOUS_TYPE = "AMBIGUOUS_TYPE",

  // Known Value Extension
  SUBJECT_NOT_UNIT = "SUBJECT_NOT_UNIT",

  // Expressions Extension
  UNEXPECTED_RESPONSE_ID = "UNEXPECTED_RESPONSE_ID",
  INVALID_RESPONSE = "INVALID_RESPONSE",

  // External errors
  CBOR = "CBOR",
  COMPONENTS = "COMPONENTS",
  GENERAL = "GENERAL",
}

export class EnvelopeError extends Error {
  readonly code: ErrorCode;
  declare readonly cause?: Error;

  constructor(code: ErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = "EnvelopeError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ("captureStackTrace" in Error) {
      (
        Error as {
          captureStackTrace(target: object, constructor: typeof EnvelopeError): void;
        }
      ).captureStackTrace(this, EnvelopeError);
    }
  }

  //
  // Base Specification
  /// Returned when attempting to compress or encrypt an envelope that has
  /// already been elided.
  ///
  /// This error occurs because an elided envelope only contains a digest
  /// reference and no longer has a subject that can be compressed or
  /// encrypted.
  static alreadyElided(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.ALREADY_ELIDED,
      "envelope was elided, so it cannot be compressed or encrypted",
    );
  }

  /// Returned when attempting to retrieve an assertion by predicate, but
  /// multiple matching assertions exist.
  ///
  /// For queries that expect a single result (like `objectForPredicate`),
  /// having multiple matching assertions is ambiguous and requires more
  /// specific targeting.
  static ambiguousPredicate(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.AMBIGUOUS_PREDICATE,
      "more than one assertion matches the predicate",
    );
  }

  /// Returned when a digest validation fails.
  ///
  /// This can occur when unwrapping an envelope, verifying signatures, or
  /// other operations that rely on the integrity of envelope digests.
  static invalidDigest(): EnvelopeError {
    return new EnvelopeError(ErrorCode.INVALID_DIGEST, "digest did not match");
  }

  /// Returned when an envelope's format is invalid.
  ///
  /// This typically occurs during parsing or decoding of an envelope from
  /// CBOR.
  static invalidFormat(): EnvelopeError {
    return new EnvelopeError(ErrorCode.INVALID_FORMAT, "invalid format");
  }

  /// Returned when a digest is expected but not found.
  ///
  /// This can occur when working with envelope structures that require digest
  /// information, such as when working with elided envelopes.
  static missingDigest(): EnvelopeError {
    return new EnvelopeError(ErrorCode.MISSING_DIGEST, "a digest was expected but not found");
  }

  /// Returned when attempting to retrieve an assertion by predicate, but no
  /// matching assertion exists.
  ///
  /// This error occurs with functions like `objectForPredicate` when the
  /// specified predicate doesn't match any assertion in the envelope.
  static nonexistentPredicate(): EnvelopeError {
    return new EnvelopeError(ErrorCode.NONEXISTENT_PREDICATE, "no assertion matches the predicate");
  }

  /// Returned when attempting to unwrap an envelope that wasn't wrapped.
  ///
  /// This error occurs when calling `Envelope.tryUnwrap` on an
  /// envelope that doesn't have the wrapped format.
  static notWrapped(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.NOT_WRAPPED,
      "cannot unwrap an envelope that was not wrapped",
    );
  }

  /// Returned when expecting an envelope's subject to be a leaf, but it
  /// isn't.
  ///
  /// This error occurs when calling methods that require access to a leaf
  /// value but the envelope's subject is an assertion, node, or elided.
  static notLeaf(): EnvelopeError {
    return new EnvelopeError(ErrorCode.NOT_LEAF, "the envelope's subject is not a leaf");
  }

  /// Returned when expecting an envelope's subject to be an assertion, but it
  /// isn't.
  ///
  /// This error occurs when calling methods that require an assertion
  /// structure but the envelope's subject has a different format.
  static notAssertion(): EnvelopeError {
    return new EnvelopeError(ErrorCode.NOT_ASSERTION, "the envelope's subject is not an assertion");
  }

  /// Returned when assertion is invalid
  static invalidAssertion(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.INVALID_ASSERTION,
      "assertion must be a map with exactly one element",
    );
  }

  //
  // Attachments Extension
  /// Returned when an attachment's format is invalid.
  ///
  /// This error occurs when an envelope contains an attachment with an
  /// invalid structure according to the Envelope Attachment specification
  /// (BCR-2023-006).
  static invalidAttachment(message?: string): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.INVALID_ATTACHMENT,
      message !== undefined ? `invalid attachment: ${message}` : "invalid attachment",
    );
  }

  /// Returned when an attachment is requested but does not exist.
  ///
  /// This error occurs when attempting to retrieve an attachment by ID that
  /// doesn't exist in the envelope.
  static nonexistentAttachment(): EnvelopeError {
    return new EnvelopeError(ErrorCode.NONEXISTENT_ATTACHMENT, "nonexistent attachment");
  }

  /// Returned when multiple attachments match a single query.
  ///
  /// This error occurs when multiple attachments have the same ID, making
  /// it ambiguous which attachment should be returned.
  static ambiguousAttachment(): EnvelopeError {
    return new EnvelopeError(ErrorCode.AMBIGUOUS_ATTACHMENT, "ambiguous attachment");
  }

  //
  // Edges Extension
  /// Returned when an edge is missing the required `'isA'` assertion.
  static edgeMissingIsA(): EnvelopeError {
    return new EnvelopeError(ErrorCode.EDGE_MISSING_IS_A, "edge missing 'isA' assertion");
  }

  /// Returned when an edge is missing the required `'source'` assertion.
  static edgeMissingSource(): EnvelopeError {
    return new EnvelopeError(ErrorCode.EDGE_MISSING_SOURCE, "edge missing 'source' assertion");
  }

  /// Returned when an edge is missing the required `'target'` assertion.
  static edgeMissingTarget(): EnvelopeError {
    return new EnvelopeError(ErrorCode.EDGE_MISSING_TARGET, "edge missing 'target' assertion");
  }

  /// Returned when an edge has duplicate `'isA'` assertions.
  static edgeDuplicateIsA(): EnvelopeError {
    return new EnvelopeError(ErrorCode.EDGE_DUPLICATE_IS_A, "edge has duplicate 'isA' assertions");
  }

  /// Returned when an edge has duplicate `'source'` assertions.
  static edgeDuplicateSource(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.EDGE_DUPLICATE_SOURCE,
      "edge has duplicate 'source' assertions",
    );
  }

  /// Returned when an edge has duplicate `'target'` assertions.
  static edgeDuplicateTarget(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.EDGE_DUPLICATE_TARGET,
      "edge has duplicate 'target' assertions",
    );
  }

  /// Returned when an edge has an unexpected assertion (per BCR-2026-003).
  static edgeUnexpectedAssertion(): EnvelopeError {
    return new EnvelopeError(ErrorCode.EDGE_UNEXPECTED_ASSERTION, "edge has unexpected assertion");
  }

  /// Returned when an edge is requested but does not exist.
  static nonexistentEdge(): EnvelopeError {
    return new EnvelopeError(ErrorCode.NONEXISTENT_EDGE, "nonexistent edge");
  }

  /// Returned when multiple edges match a single query.
  static ambiguousEdge(): EnvelopeError {
    return new EnvelopeError(ErrorCode.AMBIGUOUS_EDGE, "ambiguous edge");
  }

  //
  // Compression Extension
  /// Returned when attempting to compress an envelope that is already
  /// compressed.
  ///
  /// This error occurs when calling compression functions on an envelope that
  /// already has compressed content, as defined in BCR-2023-005.
  static alreadyCompressed(): EnvelopeError {
    return new EnvelopeError(ErrorCode.ALREADY_COMPRESSED, "envelope was already compressed");
  }

  /// Returned when attempting to decompress an envelope that is not
  /// compressed.
  ///
  /// This error occurs when calling decompression functions on an envelope
  /// that doesn't contain compressed content.
  static notCompressed(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.NOT_COMPRESSED,
      "cannot decompress an envelope that was not compressed",
    );
  }

  //
  // Symmetric Encryption Extension
  /// Returned when attempting to encrypt an envelope that is already
  /// encrypted or compressed.
  ///
  /// This error occurs to prevent multiple layers of encryption or encryption
  /// of compressed data, which could reduce security, as defined in
  /// BCR-2023-004.
  static alreadyEncrypted(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.ALREADY_ENCRYPTED,
      "envelope was already encrypted or compressed, so it cannot be encrypted",
    );
  }

  /// Returned when attempting to decrypt an envelope that is not encrypted.
  ///
  /// This error occurs when calling decryption functions on an envelope that
  /// doesn't contain encrypted content.
  static notEncrypted(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.NOT_ENCRYPTED,
      "cannot decrypt an envelope that was not encrypted",
    );
  }

  //
  // Known Values Extension
  /// Returned when expecting an envelope's subject to be a known value, but
  /// it isn't.
  ///
  /// This error occurs when calling methods that require a known value (as
  /// defined in BCR-2023-003) but the envelope's subject is a different
  /// type.
  static notKnownValue(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.NOT_KNOWN_VALUE,
      "the envelope's subject is not a known value",
    );
  }

  //
  // Public Key Encryption Extension
  /// Returned when attempting to decrypt an envelope with a recipient that
  /// doesn't match.
  ///
  /// This error occurs when trying to use a private key to decrypt an
  /// envelope that wasn't encrypted for the corresponding public key.
  static unknownRecipient(): EnvelopeError {
    return new EnvelopeError(ErrorCode.UNKNOWN_RECIPIENT, "unknown recipient");
  }

  //
  // Encrypted Key Extension
  /// Returned when attempting to decrypt an envelope with a secret that
  /// doesn't match.
  ///
  /// This error occurs when trying to use a secret that does not correspond
  /// to the expected recipient, preventing successful decryption.
  static unknownSecret(): EnvelopeError {
    return new EnvelopeError(ErrorCode.UNKNOWN_SECRET, "secret not found");
  }

  //
  // Public Key Signing Extension
  /// Returned when a signature verification fails.
  ///
  /// This error occurs when a signature does not validate against its
  /// purported public key.
  static unverifiedSignature(): EnvelopeError {
    return new EnvelopeError(ErrorCode.UNVERIFIED_SIGNATURE, "could not verify a signature");
  }

  /// Returned when the outer signature object type is not `Signature`.
  static invalidOuterSignatureType(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.INVALID_OUTER_SIGNATURE_TYPE,
      "unexpected outer signature object type",
    );
  }

  /// Returned when the inner signature object type is not `Signature`.
  static invalidInnerSignatureType(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.INVALID_INNER_SIGNATURE_TYPE,
      "unexpected inner signature object type",
    );
  }

  /// Returned when the inner signature is not made with the same key as the
  /// outer signature.
  static unverifiedInnerSignature(): EnvelopeError {
    return new EnvelopeError(
      ErrorCode.UNVERIFIED_INNER_SIGNATURE,
      "inner signature not made with same key as outer signature",
    );
  }

  /// Returned when the signature object is not a `Signature`.
  static invalidSignatureType(): EnvelopeError {
    return new EnvelopeError(ErrorCode.INVALID_SIGNATURE_TYPE, "unexpected signature object type");
  }

  //
  // SSKR Extension
  /// Returned when SSKR shares are invalid or insufficient for
  /// reconstruction.
  ///
  /// This error occurs when attempting to join SSKR shares that are
  /// malformed, from different splits, or insufficient to meet the
  /// recovery threshold.
  static invalidShares(): EnvelopeError {
    return new EnvelopeError(ErrorCode.INVALID_SHARES, "invalid SSKR shares");
  }

  /// SSKR error wrapper
  static sskr(message: string, cause?: Error): EnvelopeError {
    return new EnvelopeError(ErrorCode.SSKR, `sskr error: ${message}`, cause);
  }

  //
  // Types Extension
  /// Returned when an envelope contains an invalid type.
  ///
  /// This error occurs when an envelope's type information doesn't match
  /// the expected format or value.
  static invalidType(): EnvelopeError {
    return new EnvelopeError(ErrorCode.INVALID_TYPE, "invalid type");
  }

  /// Returned when an envelope contains ambiguous type information.
  ///
  /// This error occurs when multiple type assertions exist that conflict
  /// with each other or create ambiguity about the envelope's type.
  static ambiguousType(): EnvelopeError {
    return new EnvelopeError(ErrorCode.AMBIGUOUS_TYPE, "ambiguous type");
  }

  //
  // Known Value Extension
  /// Returned when the subject is expected to be the unit value but isn't.
  static subjectNotUnit(): EnvelopeError {
    return new EnvelopeError(ErrorCode.SUBJECT_NOT_UNIT, "subject is not the unit value");
  }

  //
  // Expressions Extension
  /// Returned when a response envelope has an unexpected ID.
  ///
  /// This error occurs when processing a response envelope and the ID doesn't
  /// match the expected request ID, as defined in BCR-2023-012.
  static unexpectedResponseId(): EnvelopeError {
    return new EnvelopeError(ErrorCode.UNEXPECTED_RESPONSE_ID, "unexpected response ID");
  }

  /// Returned when a response envelope is invalid.
  static invalidResponse(): EnvelopeError {
    return new EnvelopeError(ErrorCode.INVALID_RESPONSE, "invalid response");
  }

  //
  // External errors
  /// dcbor error wrapper
  static cbor(message: string, cause?: Error): EnvelopeError {
    return new EnvelopeError(ErrorCode.CBOR, `dcbor error: ${message}`, cause);
  }

  /// Components error wrapper
  static components(message: string, cause?: Error): EnvelopeError {
    return new EnvelopeError(ErrorCode.COMPONENTS, `components error: ${message}`, cause);
  }

  /// General error wrapper
  static general(message: string, cause?: Error): EnvelopeError {
    return new EnvelopeError(ErrorCode.GENERAL, `general error: ${message}`, cause);
  }

  /// Create error with custom message (equivalent to Rust's Error::msg)
  static msg(message: string): EnvelopeError {
    return EnvelopeError.general(message);
  }
}

/// Type alias for Result type (for Rust compatibility)
export type Result<T> = T;

/// Export for backward compatibility
export type { EnvelopeError as Error };
