/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Error type for UR encoding/decoding operations.
 */
export class URError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "URError";
  }
}

/**
 * Error type for invalid UR schemes.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `invalid UR scheme`.
 */
export class InvalidSchemeError extends URError {
  constructor() {
    super("invalid UR scheme");
    this.name = "InvalidSchemeError";
  }
}

/**
 * Error type for unspecified UR types.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `no UR type specified`.
 */
export class TypeUnspecifiedError extends URError {
  constructor() {
    super("no UR type specified");
    this.name = "TypeUnspecifiedError";
  }
}

/**
 * Error type for invalid UR types.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `invalid UR type`.
 */
export class InvalidTypeError extends URError {
  constructor() {
    super("invalid UR type");
    this.name = "InvalidTypeError";
  }
}

/**
 * Error type for non-single-part URs.
 */
export class NotSinglePartError extends URError {
  constructor() {
    super("UR is not a single-part");
    this.name = "NotSinglePartError";
  }
}

/**
 * Error type for unexpected UR types.
 *
 * Message matches Rust bc-ur-rust/src/error.rs:
 * `expected UR type {expected}, but found {found}`.
 */
export class UnexpectedTypeError extends URError {
  constructor(expected: string, found: string) {
    super(`expected UR type ${expected}, but found ${found}`);
    this.name = "UnexpectedTypeError";
  }
}

/**
 * Error type for Bytewords encoding/decoding errors.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `Bytewords error ({0})`.
 */
export class BytewordsError extends URError {
  constructor(message: string) {
    super(`Bytewords error (${message})`);
    this.name = "BytewordsError";
  }
}

/**
 * Error type for CBOR encoding/decoding errors.
 *
 * Message matches Rust bc-ur-rust/src/error.rs: `CBOR error ({0})`.
 */
export class CBORError extends URError {
  constructor(message: string) {
    super(`CBOR error (${message})`);
    this.name = "CBORError";
  }
}

/**
 * Error type for UR decoder errors.
 * Matches Rust's Error::UR(String) variant.
 */
export class URDecodeError extends URError {
  constructor(message: string) {
    super(`UR decoder error (${message})`);
    this.name = "URDecodeError";
  }
}

export type Result<T> = T | Error;

/**
 * Helper function to check if a result is an error.
 */
export function isError(result: unknown): result is Error {
  return result instanceof Error;
}
