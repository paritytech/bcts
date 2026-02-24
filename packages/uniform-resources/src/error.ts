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
 */
export class InvalidSchemeError extends URError {
  constructor() {
    super("Invalid UR scheme");
    this.name = "InvalidSchemeError";
  }
}

/**
 * Error type for unspecified UR types.
 */
export class TypeUnspecifiedError extends URError {
  constructor() {
    super("No UR type specified");
    this.name = "TypeUnspecifiedError";
  }
}

/**
 * Error type for invalid UR types.
 */
export class InvalidTypeError extends URError {
  constructor() {
    super("Invalid UR type");
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
 */
export class UnexpectedTypeError extends URError {
  constructor(expected: string, found: string) {
    super(`Expected UR type ${expected}, but found ${found}`);
    this.name = "UnexpectedTypeError";
  }
}

/**
 * Error type for Bytewords encoding/decoding errors.
 */
export class BytewordsError extends URError {
  constructor(message: string) {
    super(`Bytewords error: ${message}`);
    this.name = "BytewordsError";
  }
}

/**
 * Error type for CBOR encoding/decoding errors.
 */
export class CBORError extends URError {
  constructor(message: string) {
    super(`CBOR error: ${message}`);
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
