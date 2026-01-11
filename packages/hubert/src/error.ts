/**
 * Top-level error types for the hubert library.
 *
 * Port of error.rs from hubert-rust.
 *
 * @module
 */

/**
 * Base error class for all Hubert errors.
 *
 * @category Errors
 */
export class HubertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubertError";
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when attempting to store at an ARID that already exists.
 *
 * Port of `Error::AlreadyExists { arid }` from error.rs line 6.
 *
 * @category Errors
 */
export class AlreadyExistsError extends HubertError {
  /** The ARID that already exists */
  readonly arid: string;

  constructor(arid: string) {
    super(`${arid} already exists`);
    this.name = "AlreadyExistsError";
    this.arid = arid;
  }
}

/**
 * Error thrown when an ARID is not found.
 *
 * Port of `Error::NotFound` from error.rs line 8.
 *
 * @category Errors
 */
export class NotFoundError extends HubertError {
  constructor() {
    super("Not found");
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when an ARID format is invalid.
 *
 * Port of `Error::InvalidArid` from error.rs line 11.
 *
 * @category Errors
 */
export class InvalidAridError extends HubertError {
  constructor() {
    super("Invalid ARID format");
    this.name = "InvalidAridError";
  }
}

/**
 * Error thrown for I/O operations.
 *
 * Port of `Error::Io(e)` from error.rs line 35.
 *
 * @category Errors
 */
export class IoError extends HubertError {
  /** The underlying error */
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(`IO error: ${message}`);
    this.name = "IoError";
    this.cause = cause;
  }
}
