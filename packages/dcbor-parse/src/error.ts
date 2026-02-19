/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/dcbor-parse - Error types
 *
 * This is a 1:1 TypeScript port of bc-dcbor-parse-rust error.rs
 *
 * @module dcbor-parse/error
 */

import type { Token } from "./token";

/**
 * Represents a span (range) in the source string.
 *
 * Corresponds to the Rust `logos::Span` type.
 */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Creates a span with the given start and end positions.
 */
export function span(start: number, end: number): Span {
  return { start, end };
}

/**
 * Creates a default (empty) span.
 */
export function defaultSpan(): Span {
  return { start: 0, end: 0 };
}

/**
 * Parse error types.
 *
 * Corresponds to the Rust `Error` enum in error.rs
 */
export type ParseError =
  | { readonly type: "EmptyInput" }
  | { readonly type: "UnexpectedEndOfInput" }
  | { readonly type: "ExtraData"; readonly span: Span }
  | { readonly type: "UnexpectedToken"; readonly token: Token; readonly span: Span }
  | { readonly type: "UnrecognizedToken"; readonly span: Span }
  | { readonly type: "ExpectedComma"; readonly span: Span }
  | { readonly type: "ExpectedColon"; readonly span: Span }
  | { readonly type: "UnmatchedParentheses"; readonly span: Span }
  | { readonly type: "UnmatchedBraces"; readonly span: Span }
  | { readonly type: "ExpectedMapKey"; readonly span: Span }
  | { readonly type: "InvalidTagValue"; readonly value: string; readonly span: Span }
  | { readonly type: "UnknownTagName"; readonly name: string; readonly span: Span }
  | { readonly type: "InvalidHexString"; readonly span: Span }
  | { readonly type: "InvalidBase64String"; readonly span: Span }
  | { readonly type: "UnknownUrType"; readonly urType: string; readonly span: Span }
  | { readonly type: "InvalidUr"; readonly message: string; readonly span: Span }
  | { readonly type: "InvalidKnownValue"; readonly value: string; readonly span: Span }
  | { readonly type: "UnknownKnownValueName"; readonly name: string; readonly span: Span }
  | { readonly type: "InvalidDateString"; readonly dateString: string; readonly span: Span }
  | { readonly type: "DuplicateMapKey"; readonly span: Span };

// Error constructors (lowercase to differentiate from the type)
export const parseError = {
  emptyInput(): ParseError {
    return { type: "EmptyInput" };
  },

  unexpectedEndOfInput(): ParseError {
    return { type: "UnexpectedEndOfInput" };
  },

  extraData(span: Span): ParseError {
    return { type: "ExtraData", span };
  },

  unexpectedToken(token: Token, span: Span): ParseError {
    return { type: "UnexpectedToken", token, span };
  },

  unrecognizedToken(span: Span): ParseError {
    return { type: "UnrecognizedToken", span };
  },

  expectedComma(span: Span): ParseError {
    return { type: "ExpectedComma", span };
  },

  expectedColon(span: Span): ParseError {
    return { type: "ExpectedColon", span };
  },

  unmatchedParentheses(span: Span): ParseError {
    return { type: "UnmatchedParentheses", span };
  },

  unmatchedBraces(span: Span): ParseError {
    return { type: "UnmatchedBraces", span };
  },

  expectedMapKey(span: Span): ParseError {
    return { type: "ExpectedMapKey", span };
  },

  invalidTagValue(value: string, span: Span): ParseError {
    return { type: "InvalidTagValue", value, span };
  },

  unknownTagName(name: string, span: Span): ParseError {
    return { type: "UnknownTagName", name, span };
  },

  invalidHexString(span: Span): ParseError {
    return { type: "InvalidHexString", span };
  },

  invalidBase64String(span: Span): ParseError {
    return { type: "InvalidBase64String", span };
  },

  unknownUrType(urType: string, span: Span): ParseError {
    return { type: "UnknownUrType", urType, span };
  },

  invalidUr(message: string, span: Span): ParseError {
    return { type: "InvalidUr", message, span };
  },

  invalidKnownValue(value: string, span: Span): ParseError {
    return { type: "InvalidKnownValue", value, span };
  },

  unknownKnownValueName(name: string, span: Span): ParseError {
    return { type: "UnknownKnownValueName", name, span };
  },

  invalidDateString(dateString: string, span: Span): ParseError {
    return { type: "InvalidDateString", dateString, span };
  },

  duplicateMapKey(span: Span): ParseError {
    return { type: "DuplicateMapKey", span };
  },
};

/**
 * Checks if an error is the default unrecognized token error.
 *
 * Corresponds to Rust `Error::is_default()`
 */
export function isDefaultError(error: ParseError): boolean {
  return error.type === "UnrecognizedToken";
}

/**
 * Gets the error message for a parse error.
 *
 * Corresponds to Rust's `Display` implementation for `Error`
 */
export function errorMessage(error: ParseError): string {
  switch (error.type) {
    case "EmptyInput":
      return "Empty input";
    case "UnexpectedEndOfInput":
      return "Unexpected end of input";
    case "ExtraData":
      return "Extra data at end of input";
    case "UnexpectedToken":
      return `Unexpected token ${tokenDebugString(error.token)}`;
    case "UnrecognizedToken":
      return "Unrecognized token";
    case "ExpectedComma":
      return "Expected comma";
    case "ExpectedColon":
      return "Expected colon";
    case "UnmatchedParentheses":
      return "Unmatched parentheses";
    case "UnmatchedBraces":
      return "Unmatched braces";
    case "ExpectedMapKey":
      return "Expected map key";
    case "InvalidTagValue":
      return `Invalid tag value '${error.value}'`;
    case "UnknownTagName":
      return `Unknown tag name '${error.name}'`;
    case "InvalidHexString":
      return "Invalid hex string";
    case "InvalidBase64String":
      return "Invalid base64 string";
    case "UnknownUrType":
      return `Unknown UR type '${error.urType}'`;
    case "InvalidUr":
      return `Invalid UR '${error.message}'`;
    case "InvalidKnownValue":
      return `Invalid known value '${error.value}'`;
    case "UnknownKnownValueName":
      return `Unknown known value name '${error.name}'`;
    case "InvalidDateString":
      return `Invalid date string '${error.dateString}'`;
    case "DuplicateMapKey":
      return "Duplicate map key";
  }
}

/**
 * Gets the span for a parse error, if applicable.
 */
export function errorSpan(error: ParseError): Span | undefined {
  switch (error.type) {
    case "EmptyInput":
    case "UnexpectedEndOfInput":
      return undefined;
    case "ExtraData":
    case "UnexpectedToken":
    case "UnrecognizedToken":
    case "ExpectedComma":
    case "ExpectedColon":
    case "UnmatchedParentheses":
    case "UnmatchedBraces":
    case "ExpectedMapKey":
    case "InvalidTagValue":
    case "UnknownTagName":
    case "InvalidHexString":
    case "InvalidBase64String":
    case "UnknownUrType":
    case "InvalidUr":
    case "InvalidKnownValue":
    case "UnknownKnownValueName":
    case "InvalidDateString":
    case "DuplicateMapKey":
      return error.span;
  }
}

/**
 * Formats an error message with source context, line number, and caret.
 *
 * Corresponds to Rust `Error::format_message()`
 */
function formatMessage(message: string, source: string, range: Span): string {
  const start = range.start;
  const end = range.end;

  // Walk through the characters up to `start` to find line number and line start offset
  let lineNumber = 1;
  let lineStart = 0;

  for (let idx = 0; idx < source.length && idx < start; idx++) {
    if (source[idx] === "\n") {
      lineNumber++;
      lineStart = idx + 1;
    }
  }

  // Grab the exact line text (or empty if out of bounds)
  const lines = source.split("\n");
  const line = lines[lineNumber - 1] ?? "";

  // Column is byte-offset into that line
  const column = Math.max(0, start - lineStart);

  // Underline at least one caret, even for zero-width spans
  const underlineLen = Math.max(1, end - start);
  const caret = " ".repeat(column) + "^".repeat(underlineLen);

  return `line ${lineNumber}: ${message}\n${line}\n${caret}`;
}

/**
 * Gets the full error message with source context.
 *
 * Corresponds to Rust `Error::full_message()`
 */
export function fullErrorMessage(error: ParseError, source: string): string {
  const message = errorMessage(error);

  switch (error.type) {
    case "EmptyInput":
      return formatMessage(message, source, defaultSpan());
    case "UnexpectedEndOfInput":
      return formatMessage(message, source, span(source.length, source.length));
    case "ExtraData":
    case "UnexpectedToken":
    case "UnrecognizedToken":
    case "ExpectedComma":
    case "ExpectedColon":
    case "UnmatchedParentheses":
    case "UnmatchedBraces":
    case "ExpectedMapKey":
    case "InvalidTagValue":
    case "UnknownTagName":
    case "InvalidHexString":
    case "InvalidBase64String":
    case "UnknownUrType":
    case "InvalidUr":
    case "InvalidKnownValue":
    case "UnknownKnownValueName":
    case "InvalidDateString":
    case "DuplicateMapKey":
      return formatMessage(message, source, error.span);
  }
}

/**
 * Creates a default parse error (UnrecognizedToken with empty span).
 *
 * Corresponds to Rust `Error::default()`
 */
export function defaultParseError(): ParseError {
  return parseError.unrecognizedToken(defaultSpan());
}

/**
 * Result type for parse operations.
 *
 * Corresponds to Rust `Result<T, Error>`
 */
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ParseError };

/**
 * Creates a successful result.
 */
export function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

/**
 * Creates an error result.
 */
export function err<T>(error: ParseError): ParseResult<T> {
  return { ok: false, error };
}

/**
 * Checks if a result is successful.
 */
export function isOk<T>(result: ParseResult<T>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Checks if a result is an error.
 */
export function isErr<T>(result: ParseResult<T>): result is { ok: false; error: ParseError } {
  return !result.ok;
}

/**
 * Unwraps a result, throwing if it's an error.
 */
export function unwrap<T>(result: ParseResult<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(errorMessage(result.error));
}

/**
 * Unwraps a result error, throwing if it's successful.
 */
export function unwrapErr<T>(result: ParseResult<T>): ParseError {
  if (!result.ok) {
    return result.error;
  }
  throw new Error("Called unwrapErr on an Ok result");
}

// Helper function to get debug string for a token (forward declaration resolved at runtime)
function tokenDebugString(token: Token): string {
  // Simple debug representation
  return JSON.stringify(token);
}
