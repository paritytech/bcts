/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Error types for dCBOR pattern parsing.
 *
 * This module provides error handling utilities for the dCBOR pattern
 * matching system, including a discriminated union Error type and
 * a Result type for type-safe error handling.
 *
 * @module error
 */

import type { Token } from "./parse/token";

/**
 * Represents a span in the input string, indicating position for error reporting.
 */
export interface Span {
  readonly start: number;
  readonly end: number;
}

/**
 * Creates a new Span.
 */
export const span = (start: number, end: number): Span => ({ start, end });

/**
 * Errors that can occur during parsing of dCBOR patterns.
 *
 * This is a discriminated union type matching the Rust Error enum.
 */
export type Error =
  | { readonly type: "EmptyInput" }
  | { readonly type: "UnexpectedEndOfInput" }
  | { readonly type: "ExtraData"; readonly span: Span }
  | { readonly type: "UnexpectedToken"; readonly token: Token; readonly span: Span }
  | { readonly type: "UnrecognizedToken"; readonly span: Span }
  | { readonly type: "InvalidRegex"; readonly span: Span }
  | { readonly type: "UnterminatedRegex"; readonly span: Span }
  | { readonly type: "UnterminatedString"; readonly span: Span }
  | { readonly type: "InvalidRange"; readonly span: Span }
  | { readonly type: "InvalidHexString"; readonly span: Span }
  | { readonly type: "UnterminatedHexString"; readonly span: Span }
  | { readonly type: "InvalidDateFormat"; readonly span: Span }
  | { readonly type: "InvalidNumberFormat"; readonly span: Span }
  | { readonly type: "InvalidUr"; readonly message: string; readonly span: Span }
  | { readonly type: "ExpectedOpenParen"; readonly span: Span }
  | { readonly type: "ExpectedCloseParen"; readonly span: Span }
  | { readonly type: "ExpectedCloseBracket"; readonly span: Span }
  | { readonly type: "ExpectedCloseBrace"; readonly span: Span }
  | { readonly type: "ExpectedColon"; readonly span: Span }
  | { readonly type: "ExpectedPattern"; readonly span: Span }
  | { readonly type: "UnmatchedParentheses"; readonly span: Span }
  | { readonly type: "UnmatchedBraces"; readonly span: Span }
  | { readonly type: "InvalidCaptureGroupName"; readonly name: string; readonly span: Span }
  | { readonly type: "InvalidDigestPattern"; readonly message: string; readonly span: Span }
  | { readonly type: "UnterminatedDigestQuoted"; readonly span: Span }
  | { readonly type: "UnterminatedDateQuoted"; readonly span: Span }
  | { readonly type: "Unknown" };

/**
 * A Result type specialized for dCBOR pattern parsing.
 * Matches Rust's Result<T, Error> pattern.
 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: Error };

/**
 * Creates a successful Result.
 */
export const Ok = <T>(value: T): Result<T> => ({ ok: true, value });

/**
 * Creates a failed Result.
 */
export const Err = <T>(error: Error): Result<T> => ({ ok: false, error });

/**
 * Unwraps a Result, throwing an error if it's not Ok.
 */
export const unwrap = <T>(result: Result<T>): T => {
  if (result.ok) {
    return result.value;
  }
  throw new PatternError(result.error);
};

/**
 * Unwraps a Result, returning the default value if it's an error.
 */
export const unwrapOr = <T>(result: Result<T>, defaultValue: T): T => {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
};

/**
 * Maps a Result's value if it's Ok.
 */
export const map = <T, U>(result: Result<T>, fn: (value: T) => U): Result<U> => {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result as Result<U>;
};

/**
 * Converts an Error to a human-readable string.
 */
export const errorToString = (error: Error): string => {
  switch (error.type) {
    case "EmptyInput":
      return "Empty input";
    case "UnexpectedEndOfInput":
      return "Unexpected end of input";
    case "ExtraData":
      return `Extra data at end of input at ${error.span.start}..${error.span.end}`;
    case "UnexpectedToken":
      return `Unexpected token at ${error.span.start}..${error.span.end}`;
    case "UnrecognizedToken":
      return `Unrecognized token at position ${error.span.start}..${error.span.end}`;
    case "InvalidRegex":
      return `Invalid regex pattern at ${error.span.start}..${error.span.end}`;
    case "UnterminatedRegex":
      return `Unterminated regex pattern at ${error.span.start}..${error.span.end}`;
    case "UnterminatedString":
      return `Unterminated string literal at ${error.span.start}..${error.span.end}`;
    case "InvalidRange":
      return `Invalid range at ${error.span.start}..${error.span.end}`;
    case "InvalidHexString":
      return `Invalid hex string at ${error.span.start}..${error.span.end}`;
    case "UnterminatedHexString":
      return `Unterminated hex string at ${error.span.start}..${error.span.end}`;
    case "InvalidDateFormat":
      return `Invalid date format at ${error.span.start}..${error.span.end}`;
    case "InvalidNumberFormat":
      return `Invalid number format at ${error.span.start}..${error.span.end}`;
    case "InvalidUr":
      return `Invalid UR: ${error.message} at ${error.span.start}..${error.span.end}`;
    case "ExpectedOpenParen":
      return `Expected opening parenthesis at ${error.span.start}..${error.span.end}`;
    case "ExpectedCloseParen":
      return `Expected closing parenthesis at ${error.span.start}..${error.span.end}`;
    case "ExpectedCloseBracket":
      return `Expected closing bracket at ${error.span.start}..${error.span.end}`;
    case "ExpectedCloseBrace":
      return `Expected closing brace at ${error.span.start}..${error.span.end}`;
    case "ExpectedColon":
      return `Expected colon at ${error.span.start}..${error.span.end}`;
    case "ExpectedPattern":
      return `Expected pattern after operator at ${error.span.start}..${error.span.end}`;
    case "UnmatchedParentheses":
      return `Unmatched parentheses at ${error.span.start}..${error.span.end}`;
    case "UnmatchedBraces":
      return `Unmatched braces at ${error.span.start}..${error.span.end}`;
    case "InvalidCaptureGroupName":
      return `Invalid capture group name '${error.name}' at ${error.span.start}..${error.span.end}`;
    case "InvalidDigestPattern":
      return `Invalid digest pattern: ${error.message} at ${error.span.start}..${error.span.end}`;
    case "UnterminatedDigestQuoted":
      return `Unterminated digest quoted pattern at ${error.span.start}..${error.span.end}`;
    case "UnterminatedDateQuoted":
      return `Unterminated date quoted pattern at ${error.span.start}..${error.span.end}`;
    case "Unknown":
      return "Unknown error";
  }
};

/**
 * Adjusts the span of an error by adding the given offset to both start and end positions.
 * Returns a new error with adjusted span, or the original error if it has no span.
 */
export const adjustSpan = (error: Error, offset: number): Error => {
  switch (error.type) {
    case "ExtraData":
      return { type: "ExtraData", span: span(offset + error.span.start, offset + error.span.end) };
    case "UnexpectedToken":
      return {
        type: "UnexpectedToken",
        token: error.token,
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnrecognizedToken":
      return {
        type: "UnrecognizedToken",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidRegex":
      return {
        type: "InvalidRegex",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnterminatedRegex":
      return {
        type: "UnterminatedRegex",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnterminatedString":
      return {
        type: "UnterminatedString",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidRange":
      return {
        type: "InvalidRange",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidHexString":
      return {
        type: "InvalidHexString",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnterminatedHexString":
      return {
        type: "UnterminatedHexString",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidDateFormat":
      return {
        type: "InvalidDateFormat",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidNumberFormat":
      return {
        type: "InvalidNumberFormat",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidUr":
      return {
        type: "InvalidUr",
        message: error.message,
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "ExpectedOpenParen":
      return {
        type: "ExpectedOpenParen",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "ExpectedCloseParen":
      return {
        type: "ExpectedCloseParen",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "ExpectedCloseBracket":
      return {
        type: "ExpectedCloseBracket",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "ExpectedCloseBrace":
      return {
        type: "ExpectedCloseBrace",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "ExpectedColon":
      return {
        type: "ExpectedColon",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "ExpectedPattern":
      return {
        type: "ExpectedPattern",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnmatchedParentheses":
      return {
        type: "UnmatchedParentheses",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnmatchedBraces":
      return {
        type: "UnmatchedBraces",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidCaptureGroupName":
      return {
        type: "InvalidCaptureGroupName",
        name: error.name,
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "InvalidDigestPattern":
      return {
        type: "InvalidDigestPattern",
        message: error.message,
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnterminatedDigestQuoted":
      return {
        type: "UnterminatedDigestQuoted",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    case "UnterminatedDateQuoted":
      return {
        type: "UnterminatedDateQuoted",
        span: span(offset + error.span.start, offset + error.span.end),
      };
    // For errors without spans, return them as-is
    case "EmptyInput":
    case "UnexpectedEndOfInput":
    case "Unknown":
      return error;
  }
};

/**
 * JavaScript Error class wrapper for PatternError.
 * Provides stack traces and works with try/catch blocks.
 */
export class PatternError extends globalThis.Error {
  public readonly errorType: Error;

  constructor(errorType: Error, message?: string) {
    super(message ?? errorToString(errorType));
    this.name = "PatternError";
    this.errorType = errorType;
  }
}
