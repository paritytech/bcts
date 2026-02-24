/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Error types for envelope pattern parsing
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust error.rs
 *
 * @module envelope-pattern/error
 */

import type { Token } from "./parse/token";

/**
 * Span represents a range in the source input.
 */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Error types that can occur during parsing of Envelope patterns.
 *
 * Corresponds to the Rust `Error` enum in error.rs
 */
export type EnvelopePatternError =
  | { readonly type: "EmptyInput" }
  | { readonly type: "UnexpectedEndOfInput" }
  | { readonly type: "ExtraData"; readonly span: Span }
  | { readonly type: "UnexpectedToken"; readonly token: Token; readonly span: Span }
  | { readonly type: "UnrecognizedToken"; readonly span: Span }
  | { readonly type: "InvalidRegex"; readonly span: Span }
  | { readonly type: "UnterminatedRegex"; readonly span: Span }
  | { readonly type: "InvalidRange"; readonly span: Span }
  | { readonly type: "InvalidHexString"; readonly span: Span }
  | { readonly type: "InvalidDateFormat"; readonly span: Span }
  | { readonly type: "InvalidNumberFormat"; readonly span: Span }
  | { readonly type: "InvalidUr"; readonly message: string; readonly span: Span }
  | { readonly type: "ExpectedOpenParen"; readonly span: Span }
  | { readonly type: "ExpectedCloseParen"; readonly span: Span }
  | { readonly type: "ExpectedOpenBracket"; readonly span: Span }
  | { readonly type: "ExpectedCloseBracket"; readonly span: Span }
  | { readonly type: "ExpectedPattern"; readonly span: Span }
  | { readonly type: "UnmatchedParentheses"; readonly span: Span }
  | { readonly type: "UnmatchedBraces"; readonly span: Span }
  | { readonly type: "InvalidCaptureGroupName"; readonly name: string; readonly span: Span }
  | { readonly type: "InvalidPattern"; readonly span: Span }
  | { readonly type: "Unknown" }
  | { readonly type: "DCBORPatternError"; readonly error: unknown };

/**
 * Result type specialized for envelope pattern parsing.
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EnvelopePatternError };

/**
 * Creates a successful result.
 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Creates a failed result.
 */
export function err<T>(error: EnvelopePatternError): Result<T> {
  return { ok: false, error };
}

/**
 * Type guard for successful results.
 */
export function isOk<T>(result: Result<T>): result is { readonly ok: true; readonly value: T } {
  return result.ok;
}

/**
 * Type guard for failed results.
 */
export function isErr<T>(
  result: Result<T>,
): result is { readonly ok: false; readonly error: EnvelopePatternError } {
  return !result.ok;
}

/**
 * Unwraps a successful result or throws the error.
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(formatError(result.error));
}

/**
 * Unwraps a successful result or returns a default value.
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Maps a successful result value.
 */
export function map<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result as Result<U>;
}

/**
 * Formats an error for display.
 */
export function formatError(error: EnvelopePatternError): string {
  switch (error.type) {
    case "EmptyInput":
      return "Empty input";
    case "UnexpectedEndOfInput":
      return "Unexpected end of input";
    case "ExtraData":
      return `Extra data at end of input at position ${error.span.start}-${error.span.end}`;
    case "UnexpectedToken":
      return `Unexpected token ${JSON.stringify(error.token)} at position ${error.span.start}-${error.span.end}`;
    case "UnrecognizedToken":
      return `Unrecognized token at position ${error.span.start}-${error.span.end}`;
    case "InvalidRegex":
      return `Invalid regex pattern at position ${error.span.start}-${error.span.end}`;
    case "UnterminatedRegex":
      return `Unterminated regex pattern at position ${error.span.start}-${error.span.end}`;
    case "InvalidRange":
      return `Invalid range at position ${error.span.start}-${error.span.end}`;
    case "InvalidHexString":
      return `Invalid hex string at position ${error.span.start}-${error.span.end}`;
    case "InvalidDateFormat":
      return `Invalid date format at position ${error.span.start}-${error.span.end}`;
    case "InvalidNumberFormat":
      return `Invalid number format at position ${error.span.start}-${error.span.end}`;
    case "InvalidUr":
      return `Invalid UR: ${error.message} at position ${error.span.start}-${error.span.end}`;
    case "ExpectedOpenParen":
      return `Expected opening parenthesis at position ${error.span.start}-${error.span.end}`;
    case "ExpectedCloseParen":
      return `Expected closing parenthesis at position ${error.span.start}-${error.span.end}`;
    case "ExpectedOpenBracket":
      return `Expected opening bracket at position ${error.span.start}-${error.span.end}`;
    case "ExpectedCloseBracket":
      return `Expected closing bracket at position ${error.span.start}-${error.span.end}`;
    case "ExpectedPattern":
      return `Expected pattern after operator at position ${error.span.start}-${error.span.end}`;
    case "UnmatchedParentheses":
      return `Unmatched parentheses at position ${error.span.start}-${error.span.end}`;
    case "UnmatchedBraces":
      return `Unmatched braces at position ${error.span.start}-${error.span.end}`;
    case "InvalidCaptureGroupName":
      return `Invalid capture group name '${error.name}' at position ${error.span.start}-${error.span.end}`;
    case "InvalidPattern":
      return `Invalid pattern at position ${error.span.start}-${error.span.end}`;
    case "Unknown":
      return "Unknown error";
    case "DCBORPatternError":
      return `DCBOR pattern error: ${String(error.error)}`;
  }
}

// Error factory functions for convenience

export function emptyInput(): EnvelopePatternError {
  return { type: "EmptyInput" };
}

export function unexpectedEndOfInput(): EnvelopePatternError {
  return { type: "UnexpectedEndOfInput" };
}

export function extraData(span: Span): EnvelopePatternError {
  return { type: "ExtraData", span };
}

export function unexpectedToken(token: Token, span: Span): EnvelopePatternError {
  return { type: "UnexpectedToken", token, span };
}

export function unrecognizedToken(span: Span): EnvelopePatternError {
  return { type: "UnrecognizedToken", span };
}

export function invalidRegex(span: Span): EnvelopePatternError {
  return { type: "InvalidRegex", span };
}

export function unterminatedRegex(span: Span): EnvelopePatternError {
  return { type: "UnterminatedRegex", span };
}

export function invalidRange(span: Span): EnvelopePatternError {
  return { type: "InvalidRange", span };
}

export function invalidHexString(span: Span): EnvelopePatternError {
  return { type: "InvalidHexString", span };
}

export function invalidDateFormat(span: Span): EnvelopePatternError {
  return { type: "InvalidDateFormat", span };
}

export function invalidNumberFormat(span: Span): EnvelopePatternError {
  return { type: "InvalidNumberFormat", span };
}

export function invalidUr(message: string, span: Span): EnvelopePatternError {
  return { type: "InvalidUr", message, span };
}

export function expectedOpenParen(span: Span): EnvelopePatternError {
  return { type: "ExpectedOpenParen", span };
}

export function expectedCloseParen(span: Span): EnvelopePatternError {
  return { type: "ExpectedCloseParen", span };
}

export function expectedOpenBracket(span: Span): EnvelopePatternError {
  return { type: "ExpectedOpenBracket", span };
}

export function expectedCloseBracket(span: Span): EnvelopePatternError {
  return { type: "ExpectedCloseBracket", span };
}

export function expectedPattern(span: Span): EnvelopePatternError {
  return { type: "ExpectedPattern", span };
}

export function unmatchedParentheses(span: Span): EnvelopePatternError {
  return { type: "UnmatchedParentheses", span };
}

export function unmatchedBraces(span: Span): EnvelopePatternError {
  return { type: "UnmatchedBraces", span };
}

export function invalidCaptureGroupName(name: string, span: Span): EnvelopePatternError {
  return { type: "InvalidCaptureGroupName", name, span };
}

export function invalidPattern(span: Span): EnvelopePatternError {
  return { type: "InvalidPattern", span };
}

export function unknown(): EnvelopePatternError {
  return { type: "Unknown" };
}

export function dcborPatternError(error: unknown): EnvelopePatternError {
  return { type: "DCBORPatternError", error };
}
