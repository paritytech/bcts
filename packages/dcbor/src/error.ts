/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Error types for CBOR encoding and decoding.
 *
 * @module error
 */

import type { Tag } from "./tag";
import { tagToString } from "./tag";

/**
 * A comprehensive set of errors that can occur during CBOR encoding and
 * decoding operations with special focus on enforcing the deterministic
 * encoding rules specified in the dCBOR specification.
 *
 * The dCBOR implementation validates all encoded CBOR against the
 * deterministic encoding requirements of RFC 8949 §4.2.1, plus additional
 * constraints defined in the dCBOR application profile. These errors represent
 * all the possible validation failures and decoding issues that can arise.
 */
export type Error =
  /**
   * The CBOR data ended prematurely during decoding, before a complete CBOR
   * item could be decoded. This typically happens when a CBOR item's
   * structure indicates more data than is actually present.
   */
  | { readonly type: "Underrun" }
  /**
   * An unsupported or invalid value was encountered in a CBOR header byte.
   * The parameter contains the unsupported header byte value.
   * This can occur when decoding CBOR that uses unsupported features or is
   * malformed.
   */
  | { readonly type: "UnsupportedHeaderValue"; readonly value: number }
  /**
   * A CBOR numeric value was encoded in a non-canonical form, violating the
   * deterministic encoding requirement of dCBOR (per Section 2.3 of the
   * dCBOR specification).
   *
   * This error is triggered when:
   * - An integer is not encoded in its shortest possible form
   * - A floating point value that could be represented as an integer was not
   *   reduced
   * - A NaN value was not encoded in its canonical form (`f97e00`)
   */
  | { readonly type: "NonCanonicalNumeric" }
  /**
   * An invalid CBOR simple value was encountered during decoding.
   *
   * Per Section 2.4 of the dCBOR specification, only `false`, `true`,
   * `null`, and floating point values are valid simple values in dCBOR.
   * All other major type 7 values are invalid.
   */
  | { readonly type: "InvalidSimpleValue" }
  /**
   * A CBOR text string was not valid UTF-8. The parameter contains the
   * specific error message.
   *
   * All CBOR text strings (major type 3) must be valid UTF-8 per RFC 8949.
   */
  | { readonly type: "InvalidString"; readonly message: string }
  /**
   * A CBOR text string was not encoded in Unicode Canonical Normalization
   * Form C (NFC).
   *
   * Per Section 2.5 of the dCBOR specification, all text strings must be in
   * NFC form, and decoders must reject any encoded text strings that are
   * not in NFC.
   */
  | { readonly type: "NonCanonicalString" }
  /**
   * The decoded CBOR item didn't consume all input data.
   * The parameter contains the number of unused bytes.
   *
   * This error occurs when decoding functions expect exactly one CBOR item
   * but the input contains additional data after a valid CBOR item.
   */
  | { readonly type: "UnusedData"; readonly count: number }
  /**
   * The keys in a decoded CBOR map were not in the canonical lexicographic order
   * of their encoding.
   *
   * Per the CDE specification and Section 2.1 of dCBOR, map keys must be in
   * ascending lexicographic order of their encoded representation for
   * deterministic encoding.
   */
  | { readonly type: "MisorderedMapKey" }
  /**
   * A decoded CBOR map contains duplicate keys, which is invalid.
   *
   * Per Section 2.2 of the dCBOR specification, CBOR maps must not contain
   * duplicate keys, and decoders must reject encoded maps with duplicate
   * keys.
   */
  | { readonly type: "DuplicateMapKey" }
  /**
   * A requested key was not found in a CBOR map during data extraction.
   */
  | { readonly type: "MissingMapKey" }
  /**
   * A CBOR numeric value could not be represented in the specified target
   * numeric type.
   *
   * This occurs when attempting to convert a CBOR number to a numeric
   * type that is too small to represent the value without loss of
   * precision.
   */
  | { readonly type: "OutOfRange" }
  /**
   * The CBOR value is not of the expected type for a conversion or
   * operation.
   *
   * This occurs when attempting to convert a CBOR value to a type that
   * doesn't match the actual CBOR item's type (e.g., trying to convert a
   * string to an integer).
   */
  | { readonly type: "WrongType" }
  /**
   * The CBOR tagged value had a different tag than expected.
   * Contains the expected tag and the actual tag found.
   */
  | { readonly type: "WrongTag"; readonly expected: Tag; readonly actual: Tag }
  /**
   * Invalid UTF‑8 in a text string.
   */
  | { readonly type: "InvalidUtf8"; readonly message: string }
  /**
   * Invalid ISO 8601 date format.
   */
  | { readonly type: "InvalidDate"; readonly message: string }
  /**
   * Custom error message.
   */
  | { readonly type: "Custom"; readonly message: string };

/**
 * Create a custom error with a message.
 *
 * Matches Rust's `Error::msg()` method.
 */
export const errorMsg = (message: string): Error => ({
  type: "Custom",
  message,
});

/**
 * Convert an Error to a display string.
 *
 * Matches Rust's `Display` trait / `to_string()` method.
 */
export const errorToString = (error: Error): string => {
  switch (error.type) {
    case "Underrun":
      return "early end of CBOR data";
    case "UnsupportedHeaderValue":
      return "unsupported value in CBOR header";
    case "NonCanonicalNumeric":
      return "a CBOR numeric value was encoded in non-canonical form";
    case "InvalidSimpleValue":
      return "an invalid CBOR simple value was encountered";
    case "InvalidString":
      return `an invalidly-encoded UTF-8 string was encountered in the CBOR (${error.message})`;
    case "NonCanonicalString":
      return "a CBOR string was not encoded in Unicode Canonical Normalization Form C";
    case "UnusedData":
      return `the decoded CBOR had ${error.count} extra bytes at the end`;
    case "MisorderedMapKey":
      return "the decoded CBOR map has keys that are not in canonical order";
    case "DuplicateMapKey":
      return "the decoded CBOR map has a duplicate key";
    case "MissingMapKey":
      return "missing CBOR map key";
    case "OutOfRange":
      return "the CBOR numeric value could not be represented in the specified numeric type";
    case "WrongType":
      return "the decoded CBOR value was not the expected type";
    case "WrongTag":
      return `expected CBOR tag ${tagToString(error.expected)}, but got ${tagToString(error.actual)}`;
    case "InvalidUtf8":
      return `invalid UTF‑8 string: ${error.message}`;
    case "InvalidDate":
      return `invalid ISO 8601 date string: ${error.message}`;
    case "Custom":
      return error.message;
  }
};

/**
 * Result type matching Rust's `Result<T, Error>`.
 *
 * In TypeScript, we use a discriminated union for Result instead of
 * try/catch for better type safety and Rust compatibility.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

/**
 * Create a successful Result.
 */
export const Ok = <T>(value: T): Result<T> => ({
  ok: true,
  value,
});

/**
 * Create a failed Result.
 */
export const Err = <T>(error: Error): Result<T> => ({
  ok: false,
  error,
});

/**
 * Typed error class for all CBOR-related errors.
 *
 * Wraps the discriminated union Error type in a JavaScript Error object
 * for proper error handling with stack traces.
 *
 * @example
 * ```typescript
 * throw new CborError({ type: 'Underrun' });
 * throw new CborError({ type: 'WrongTag', expected: tag1, actual: tag2 });
 * ```
 */
export class CborError extends Error {
  /**
   * The structured error information.
   */
  public readonly errorType: Error;

  /**
   * Create a new CborError.
   *
   * @param errorType - The discriminated union error type
   * @param message - Optional custom message (defaults to errorToString(errorType))
   */
  constructor(errorType: Error, message?: string) {
    super(message ?? errorToString(errorType));
    this.name = "CborError";
    this.errorType = errorType;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if ("captureStackTrace" in Error) {
      (
        Error as {
          captureStackTrace(target: object, constructor: typeof CborError): void;
        }
      ).captureStackTrace(this, CborError);
    }
  }

  /**
   * Check if an error is a CborError.
   *
   * @param error - Error to check
   * @returns True if error is a CborError
   */
  static isCborError(error: unknown): error is CborError {
    return error instanceof CborError;
  }
}
