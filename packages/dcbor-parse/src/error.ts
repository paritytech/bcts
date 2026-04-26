/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
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
 *
 * **Encoding caveat (TS↔Rust)**: Rust spans are *byte* offsets into the
 * UTF-8 source. JavaScript strings are UTF-16 code-unit indexed, and
 * the TS lexer reports spans in those native code-unit units. The two
 * representations agree for ASCII input. For non-BMP / multi-byte
 * input (e.g. `"🌎"`, emoji, CJK characters) the indices diverge. If
 * you need byte-exact spans across implementations, transcode the
 * source to UTF-8 first or apply the equivalent `String.length` ↔
 * UTF-8 byte length conversion at the boundary.
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

  // Grab the exact line text (or empty if out of bounds).
  //
  // Rust uses `source.lines()` here, which strips the trailing `\r`
  // from `\r\n`-terminated lines (cf. `str::lines` docs). JS
  // `String#split("\n")` retains the `\r`, so on Windows-style input we
  // would render an extra blank glyph at end-of-line and the caret
  // would shift. Strip a trailing `\r` to match Rust's `lines()`.
  const lines = source.split("\n");
  let line = lines[lineNumber - 1] ?? "";
  if (line.endsWith("\r")) {
    line = line.slice(0, -1);
  }

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

/**
 * Renders a {@link Token} the way Rust's
 * `#[derive(Debug)]` on the corresponding enum variant would:
 *
 * - Variant-only tokens (`BraceOpen`, `Comma`, `Null`, `Unit`, `NaN`,
 *   …) print as the bare variant name.
 * - Variant-with-value tokens print as `Variant(value)` where `value`
 *   uses Rust's `Debug` form for the payload type:
 *   `Bool(true)`, `Number(3.14)`, `String("foo")` (with the inner
 *   double quotes preserved — TS keeps them on the slice anyway),
 *   `TagValue(1234)`, `KnownValueNumber(42)`, `TagName("date")`,
 *   `KnownValueName("isA")`, `DateLiteral(2023-02-08T15:30:45.000Z)`,
 *   etc.
 *
 * Mirrors Rust's `Error::UnexpectedToken(Box<Token>, Span)` formatter
 * `#[error("Unexpected token {0:?}")]` so error messages stay
 * byte-identical to Rust.
 */
function tokenDebugString(token: Token): string {
  switch (token.type) {
    case "Bool":
      return `Bool(${token.value ? "true" : "false"})`;
    case "BraceOpen":
      return "BraceOpen";
    case "BraceClose":
      return "BraceClose";
    case "BracketOpen":
      return "BracketOpen";
    case "BracketClose":
      return "BracketClose";
    case "ParenthesisOpen":
      return "ParenthesisOpen";
    case "ParenthesisClose":
      return "ParenthesisClose";
    case "Colon":
      return "Colon";
    case "Comma":
      return "Comma";
    case "Null":
      return "Null";
    case "NaN":
      return "NaN";
    case "Infinity":
      return "Infinity";
    case "NegInfinity":
      return "NegInfinity";
    case "Unit":
      return "Unit";
    case "ByteStringHex":
      // Rust `Token::ByteStringHex(Result<Vec<u8>>)` debug-formats the
      // `Ok(Vec<u8>)` payload as `Ok([0x68, 0x65, ...])`. We render the
      // bytes in the same `[0xNN, ...]` form so the text matches.
      return `ByteStringHex(Ok(${formatBytesDebug(token.value)}))`;
    case "ByteStringBase64":
      return `ByteStringBase64(Ok(${formatBytesDebug(token.value)}))`;
    case "DateLiteral":
      // The Rust `Date` `Debug` impl is opaque; we delegate to the
      // CborDate's own string rendering, which is the closest TS gets.
      return `DateLiteral(Ok(${String(token.value)}))`;
    case "Number":
      return `Number(${formatNumberDebug(token.value)})`;
    case "String":
      // The lexer stores the slice including the outer quotes
      // (matching Rust `Token::String(String)` which holds the raw
      // `lex.slice()`). Rust's `Debug` impl on `String` re-quotes the
      // contents — so a token whose value is `"hello"` prints as
      // `String("\"hello\"")`. Since the inner already contains the
      // quotes, we can mirror Rust by `JSON.stringify`-ing.
      return `String(${JSON.stringify(token.value)})`;
    case "TagValue":
      return `TagValue(Ok(${tagOrKnownValueDebug(token.value)}))`;
    case "TagName":
      return `TagName(${JSON.stringify(token.value)})`;
    case "KnownValueNumber":
      return `KnownValueNumber(Ok(${tagOrKnownValueDebug(token.value)}))`;
    case "KnownValueName":
      return `KnownValueName(${JSON.stringify(token.value)})`;
    case "UR":
      // Rust `Token::UR(Result<UR>)` → `UR(Ok(<UR debug>))`. We don't
      // have access to the Rust `UR::Debug` shape, so we emit the UR
      // string form, which is stable and unambiguous.
      return `UR(Ok(${token.value.string()}))`;
  }
}

/**
 * Renders a `Vec<u8>` the way Rust's `Debug` does:
 * `[0x68, 0x65, 0x6c, 0x6c, 0x6f]`.
 */
function formatBytesDebug(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (const b of bytes) {
    parts.push(`0x${b.toString(16).padStart(2, "0")}`);
  }
  return `[${parts.join(", ")}]`;
}

/**
 * Renders a JS `number` the way Rust's `f64::Debug` typically prints
 * it — using a decimal point even for integral values (e.g. `42.0`),
 * and `inf` / `-inf` / `NaN` for non-finite numbers. The dCBOR-parse
 * Rust source rarely produces a `Number` token in error messages
 * (numbers normally land in tagged-content contexts), but we still
 * mirror the convention so any error text is consistent with Rust.
 */
function formatNumberDebug(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "inf" : "-inf";
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
}

/**
 * Renders a `u64` payload the way Rust's `Debug` does — a bare digit
 * sequence without trailing `n` for `bigint` values. Mirrors
 * `<u64 as Debug>::fmt` and `<TagValue as Debug>::fmt` (TagValue is a
 * type alias for u64 in `bc-ur` / `dcbor`).
 */
function tagOrKnownValueDebug(value: number | bigint): string {
  return typeof value === "bigint" ? value.toString() : String(value);
}
