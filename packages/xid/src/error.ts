/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID Error Types
 *
 * Error types returned when operating on XID Documents.
 * Ported from bc-xid-rust/src/error.rs
 */

export enum XIDErrorCode {
  DUPLICATE = "DUPLICATE",
  NOT_FOUND = "NOT_FOUND",
  STILL_REFERENCED = "STILL_REFERENCED",
  EMPTY_VALUE = "EMPTY_VALUE",
  UNKNOWN_PRIVILEGE = "UNKNOWN_PRIVILEGE",
  INVALID_XID = "INVALID_XID",
  MISSING_INCEPTION_KEY = "MISSING_INCEPTION_KEY",
  INVALID_RESOLUTION_METHOD = "INVALID_RESOLUTION_METHOD",
  MULTIPLE_PROVENANCE_MARKS = "MULTIPLE_PROVENANCE_MARKS",
  UNEXPECTED_PREDICATE = "UNEXPECTED_PREDICATE",
  UNEXPECTED_NESTED_ASSERTIONS = "UNEXPECTED_NESTED_ASSERTIONS",
  NO_PERMISSIONS = "NO_PERMISSIONS",
  NO_REFERENCES = "NO_REFERENCES",
  UNKNOWN_KEY_REFERENCE = "UNKNOWN_KEY_REFERENCE",
  UNKNOWN_DELEGATE_REFERENCE = "UNKNOWN_DELEGATE_REFERENCE",
  KEY_NOT_FOUND_IN_DOCUMENT = "KEY_NOT_FOUND_IN_DOCUMENT",
  DELEGATE_NOT_FOUND_IN_DOCUMENT = "DELEGATE_NOT_FOUND_IN_DOCUMENT",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  ENVELOPE_NOT_SIGNED = "ENVELOPE_NOT_SIGNED",
  SIGNATURE_VERIFICATION_FAILED = "SIGNATURE_VERIFICATION_FAILED",
  NO_PROVENANCE_MARK = "NO_PROVENANCE_MARK",
  GENERATOR_CONFLICT = "GENERATOR_CONFLICT",
  NO_GENERATOR = "NO_GENERATOR",
  CHAIN_ID_MISMATCH = "CHAIN_ID_MISMATCH",
  SEQUENCE_MISMATCH = "SEQUENCE_MISMATCH",
  ENVELOPE_PARSING = "ENVELOPE_PARSING",
  COMPONENT = "COMPONENT",
  CBOR = "CBOR",
  PROVENANCE_MARK = "PROVENANCE_MARK",
}

export class XIDError extends Error {
  readonly code: XIDErrorCode;
  declare readonly cause?: Error;

  constructor(code: XIDErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = "XIDError";
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ("captureStackTrace" in Error) {
      (
        Error as {
          captureStackTrace(target: object, constructor: typeof XIDError): void;
        }
      ).captureStackTrace(this, XIDError);
    }
  }

  /**
   * Returned when attempting to add a duplicate item.
   */
  static duplicate(item: string): XIDError {
    return new XIDError(XIDErrorCode.DUPLICATE, `duplicate item: ${item}`);
  }

  /**
   * Returned when an item is not found.
   */
  static notFound(item: string): XIDError {
    return new XIDError(XIDErrorCode.NOT_FOUND, `item not found: ${item}`);
  }

  /**
   * Returned when an item is still referenced by other items.
   */
  static stillReferenced(item: string): XIDError {
    return new XIDError(XIDErrorCode.STILL_REFERENCED, `item is still referenced: ${item}`);
  }

  /**
   * Returned when a value is invalid or empty.
   */
  static emptyValue(field: string): XIDError {
    return new XIDError(XIDErrorCode.EMPTY_VALUE, `invalid or empty value: ${field}`);
  }

  /**
   * Returned when an unknown privilege is encountered.
   */
  static unknownPrivilege(): XIDError {
    return new XIDError(XIDErrorCode.UNKNOWN_PRIVILEGE, "unknown privilege");
  }

  /**
   * Returned when the XID is invalid.
   */
  static invalidXid(): XIDError {
    return new XIDError(XIDErrorCode.INVALID_XID, "invalid XID");
  }

  /**
   * Returned when the inception key is missing.
   */
  static missingInceptionKey(): XIDError {
    return new XIDError(XIDErrorCode.MISSING_INCEPTION_KEY, "missing inception key");
  }

  /**
   * Returned when the resolution method is invalid.
   */
  static invalidResolutionMethod(): XIDError {
    return new XIDError(XIDErrorCode.INVALID_RESOLUTION_METHOD, "invalid resolution method");
  }

  /**
   * Returned when multiple provenance marks are found.
   */
  static multipleProvenanceMarks(): XIDError {
    return new XIDError(XIDErrorCode.MULTIPLE_PROVENANCE_MARKS, "multiple provenance marks");
  }

  /**
   * Returned when an unexpected predicate is encountered.
   */
  static unexpectedPredicate(predicate: string): XIDError {
    return new XIDError(XIDErrorCode.UNEXPECTED_PREDICATE, `unexpected predicate: ${predicate}`);
  }

  /**
   * Returned when unexpected nested assertions are found.
   */
  static unexpectedNestedAssertions(): XIDError {
    return new XIDError(XIDErrorCode.UNEXPECTED_NESTED_ASSERTIONS, "unexpected nested assertions");
  }

  /**
   * Returned when a service has no permissions.
   */
  static noPermissions(uri: string): XIDError {
    return new XIDError(XIDErrorCode.NO_PERMISSIONS, `no permissions in service '${uri}'`);
  }

  /**
   * Returned when a service has no key or delegate references.
   */
  static noReferences(uri: string): XIDError {
    return new XIDError(
      XIDErrorCode.NO_REFERENCES,
      `no key or delegate references in service '${uri}'`,
    );
  }

  /**
   * Returned when an unknown key reference is found in a service.
   */
  static unknownKeyReference(reference: string, uri: string): XIDError {
    return new XIDError(
      XIDErrorCode.UNKNOWN_KEY_REFERENCE,
      `unknown key reference ${reference} in service '${uri}'`,
    );
  }

  /**
   * Returned when an unknown delegate reference is found in a service.
   */
  static unknownDelegateReference(reference: string, uri: string): XIDError {
    return new XIDError(
      XIDErrorCode.UNKNOWN_DELEGATE_REFERENCE,
      `unknown delegate reference ${reference} in service '${uri}'`,
    );
  }

  /**
   * Returned when a key is not found in the XID document.
   */
  static keyNotFoundInDocument(key: string): XIDError {
    return new XIDError(
      XIDErrorCode.KEY_NOT_FOUND_IN_DOCUMENT,
      `key not found in XID document: ${key}`,
    );
  }

  /**
   * Returned when a delegate is not found in the XID document.
   */
  static delegateNotFoundInDocument(delegate: string): XIDError {
    return new XIDError(
      XIDErrorCode.DELEGATE_NOT_FOUND_IN_DOCUMENT,
      `delegate not found in XID document: ${delegate}`,
    );
  }

  /**
   * Returned when the password is invalid.
   */
  static invalidPassword(): XIDError {
    return new XIDError(XIDErrorCode.INVALID_PASSWORD, "invalid password");
  }

  /**
   * Returned when the envelope is not signed.
   */
  static envelopeNotSigned(): XIDError {
    return new XIDError(XIDErrorCode.ENVELOPE_NOT_SIGNED, "envelope is not signed");
  }

  /**
   * Returned when signature verification fails.
   */
  static signatureVerificationFailed(): XIDError {
    return new XIDError(
      XIDErrorCode.SIGNATURE_VERIFICATION_FAILED,
      "signature verification failed",
    );
  }

  /**
   * Returned when there is no provenance mark to advance.
   */
  static noProvenanceMark(): XIDError {
    return new XIDError(XIDErrorCode.NO_PROVENANCE_MARK, "no provenance mark to advance");
  }

  /**
   * Returned when document already has generator but external generator was provided.
   */
  static generatorConflict(): XIDError {
    return new XIDError(
      XIDErrorCode.GENERATOR_CONFLICT,
      "document already has generator, cannot provide external generator",
    );
  }

  /**
   * Returned when document does not have generator but needs one.
   */
  static noGenerator(): XIDError {
    return new XIDError(
      XIDErrorCode.NO_GENERATOR,
      "document does not have generator, must provide external generator",
    );
  }

  /**
   * Returned when generator chain ID doesn't match.
   */
  static chainIdMismatch(expected: Uint8Array, actual: Uint8Array): XIDError {
    const expectedHex = Array.from(expected)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const actualHex = Array.from(actual)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return new XIDError(
      XIDErrorCode.CHAIN_ID_MISMATCH,
      `generator chain ID mismatch: expected ${expectedHex}, got ${actualHex}`,
    );
  }

  /**
   * Returned when generator sequence doesn't match.
   */
  static sequenceMismatch(expected: number, actual: number): XIDError {
    return new XIDError(
      XIDErrorCode.SEQUENCE_MISMATCH,
      `generator sequence mismatch: expected ${expected}, got ${actual}`,
    );
  }

  /**
   * Envelope parsing error wrapper.
   */
  static envelopeParsing(cause?: Error): XIDError {
    return new XIDError(XIDErrorCode.ENVELOPE_PARSING, "envelope parsing error", cause);
  }

  /**
   * Component error wrapper.
   */
  static component(cause?: Error): XIDError {
    return new XIDError(XIDErrorCode.COMPONENT, "component error", cause);
  }

  /**
   * CBOR error wrapper.
   */
  static cbor(cause?: Error): XIDError {
    return new XIDError(XIDErrorCode.CBOR, "CBOR error", cause);
  }

  /**
   * Provenance mark error wrapper.
   */
  static provenanceMark(cause?: Error): XIDError {
    return new XIDError(XIDErrorCode.PROVENANCE_MARK, "provenance mark error", cause);
  }
}

/**
 * Result type for XID operations.
 */
export type XIDResult<T> = T;
