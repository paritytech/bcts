/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/dcbor-parse - Token types and Lexer
 *
 * This is a 1:1 TypeScript port of bc-dcbor-parse-rust token.rs
 *
 * @module dcbor-parse/token
 */

import { type CborDate, CborDate as DCborDate } from "@bcts/dcbor";
import { UR } from "@bcts/uniform-resources";
import { type Span, span, parseError as PE, type ParseResult, ok, err } from "./error";

/**
 * Token types produced by the lexer.
 *
 * Corresponds to the Rust `Token` enum in token.rs.
 *
 * **u64 parity**: `TagValue` and `KnownValueNumber` are widened to
 * `number | bigint` because Rust accepts the full `u64` range
 * (`0..=2^64-1`). Values that fit in
 * {@link Number.MAX_SAFE_INTEGER} (`2^53-1`) come through as plain
 * `number`s; anything larger arrives as a `bigint` so callers don't
 * silently lose precision. This matches the way `@bcts/dcbor` already
 * stores large unsigned integers (`number | bigint`) and lets the
 * downstream `cbor({ tag, value })` builder serialize correctly.
 *
 * **String value field**: the lexer keeps the outer double quotes on
 * the slice (e.g. `"\"hello\""`); the parser strips them in
 * `parseString`. Mirrors Rust `Token::String(String)` which holds the
 * raw `lex.slice()` including quotes (`token.rs:115-119`).
 */
export type Token =
  | { readonly type: "Bool"; readonly value: boolean }
  | { readonly type: "BraceOpen" }
  | { readonly type: "BraceClose" }
  | { readonly type: "BracketOpen" }
  | { readonly type: "BracketClose" }
  | { readonly type: "ParenthesisOpen" }
  | { readonly type: "ParenthesisClose" }
  | { readonly type: "Colon" }
  | { readonly type: "Comma" }
  | { readonly type: "Null" }
  | { readonly type: "NaN" }
  | { readonly type: "Infinity" }
  | { readonly type: "NegInfinity" }
  | { readonly type: "ByteStringHex"; readonly value: Uint8Array }
  | { readonly type: "ByteStringBase64"; readonly value: Uint8Array }
  | { readonly type: "DateLiteral"; readonly value: CborDate }
  | { readonly type: "Number"; readonly value: number }
  | { readonly type: "String"; readonly value: string }
  | { readonly type: "TagValue"; readonly value: number | bigint }
  | { readonly type: "TagName"; readonly value: string }
  | { readonly type: "KnownValueNumber"; readonly value: number | bigint }
  | { readonly type: "KnownValueName"; readonly value: string }
  | { readonly type: "Unit" }
  | { readonly type: "UR"; readonly value: UR };

// Token constructors (lowercase to differentiate from the type)
export const token = {
  bool(value: boolean): Token {
    return { type: "Bool", value };
  },
  braceOpen(): Token {
    return { type: "BraceOpen" };
  },
  braceClose(): Token {
    return { type: "BraceClose" };
  },
  bracketOpen(): Token {
    return { type: "BracketOpen" };
  },
  bracketClose(): Token {
    return { type: "BracketClose" };
  },
  parenthesisOpen(): Token {
    return { type: "ParenthesisOpen" };
  },
  parenthesisClose(): Token {
    return { type: "ParenthesisClose" };
  },
  colon(): Token {
    return { type: "Colon" };
  },
  comma(): Token {
    return { type: "Comma" };
  },
  null(): Token {
    return { type: "Null" };
  },
  nan(): Token {
    return { type: "NaN" };
  },
  infinity(): Token {
    return { type: "Infinity" };
  },
  negInfinity(): Token {
    return { type: "NegInfinity" };
  },
  byteStringHex(value: Uint8Array): Token {
    return { type: "ByteStringHex", value };
  },
  byteStringBase64(value: Uint8Array): Token {
    return { type: "ByteStringBase64", value };
  },
  dateLiteral(value: CborDate): Token {
    return { type: "DateLiteral", value };
  },
  number(value: number): Token {
    return { type: "Number", value };
  },
  string(value: string): Token {
    return { type: "String", value };
  },
  tagValue(value: number | bigint): Token {
    return { type: "TagValue", value };
  },
  tagName(value: string): Token {
    return { type: "TagName", value };
  },
  knownValueNumber(value: number | bigint): Token {
    return { type: "KnownValueNumber", value };
  },
  knownValueName(value: string): Token {
    return { type: "KnownValueName", value };
  },
  unit(): Token {
    return { type: "Unit" };
  },
  ur(value: UR): Token {
    return { type: "UR", value };
  },
};

/**
 * Lexer for dCBOR diagnostic notation.
 *
 * Corresponds to the Rust `logos::Lexer` used in parse.rs
 */
export class Lexer {
  private readonly _source: string;
  private _position: number;
  private _tokenStart: number;
  private _tokenEnd: number;

  constructor(source: string) {
    this._source = source;
    this._position = 0;
    this._tokenStart = 0;
    this._tokenEnd = 0;
  }

  /**
   * Gets the current span (position range of the last token).
   */
  span(): Span {
    return span(this._tokenStart, this._tokenEnd);
  }

  /**
   * Gets the slice of source corresponding to the last token.
   */
  slice(): string {
    return this._source.slice(this._tokenStart, this._tokenEnd);
  }

  /**
   * Gets the next token, or undefined if at end of input.
   * Returns a Result to handle lexing errors.
   */
  next(): ParseResult<Token> | undefined {
    this._skipWhitespaceAndComments();

    if (this._position >= this._source.length) {
      return undefined;
    }

    this._tokenStart = this._position;

    // Try to match tokens in order of specificity
    const result =
      this._tryMatchKeyword() ??
      this._tryMatchDateLiteral() ??
      this._tryMatchTagValueOrNumber() ??
      this._tryMatchTagName() ??
      this._tryMatchString() ??
      this._tryMatchByteStringHex() ??
      this._tryMatchByteStringBase64() ??
      this._tryMatchKnownValue() ??
      this._tryMatchUR() ??
      this._tryMatchPunctuation();

    if (result === undefined) {
      // Unrecognized token - consume one character
      this._position++;
      this._tokenEnd = this._position;
      return err(PE.unrecognizedToken(this.span()));
    }

    return result;
  }

  private _skipWhitespaceAndComments(): void {
    while (this._position < this._source.length) {
      const ch = this._source[this._position];

      // Skip whitespace
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f") {
        this._position++;
        continue;
      }

      // Skip inline comments: `/[^/]*/` (matches the Rust skip regex
      // `/[^/]*/`). Note that the Rust regex *does* match `//` (zero
      // non-slash characters between the two slashes), so an empty
      // comment is a valid no-op for the lexer. We accept that case too;
      // earlier revisions of this port required at least one non-slash
      // body character, which broke parity with Rust on inputs like
      // `// trailing thought`.
      if (ch === "/") {
        // Confirm there is a closing slash somewhere ahead. If not, fall
        // through and let the punctuation matcher report an
        // unrecognized token (Rust would equally fail to match the skip
        // regex and emit an `UnrecognizedToken`).
        let scan = this._position + 1;
        while (scan < this._source.length && this._source[scan] !== "/") {
          scan++;
        }
        if (scan < this._source.length) {
          this._position = scan + 1; // jump past the closing /
          continue;
        }
        // No closing /: not a comment — leave _position alone and break
        // out so the punctuation matcher can flag the unrecognized `/`.
        break;
      }

      // Skip end-of-line comments: #...
      if (ch === "#") {
        while (this._position < this._source.length && this._source[this._position] !== "\n") {
          this._position++;
        }
        continue;
      }

      break;
    }
  }

  /**
   * Matches reserved keywords: `true`, `false`, `null`, `NaN`,
   * `Infinity`, `-Infinity`, `Unit`.
   *
   * Mirrors Rust's `Logos` `#[token(...)]` matcher
   * (`bc-dcbor-parse-rust/src/token.rs:12-50, 164`), which is greedy
   * and emits the keyword token *as soon as the literal matches* —
   * subsequent characters become a separate (likely unrecognized) token
   * stream. So input like `truex` lexes as `Bool(true)` followed by an
   * unrecognized run on `x`. Earlier revisions of this port enforced an
   * identifier boundary check (`!_isIdentifierChar(nextChar)`) and
   * rejected the whole prefix as a single `UnrecognizedToken`, which
   * broke span/variant parity with Rust.
   */
  private _tryMatchKeyword(): ParseResult<Token> | undefined {
    const keywords: [string, Token][] = [
      // Order matters: `-Infinity` must come before any other `-` based
      // matcher (we lex this before numbers, so the `-` doesn't get
      // siphoned off as a sign).
      ["-Infinity", token.negInfinity()],
      ["true", token.bool(true)],
      ["false", token.bool(false)],
      ["null", token.null()],
      ["NaN", token.nan()],
      ["Infinity", token.infinity()],
      ["Unit", token.unit()],
    ];

    for (const [keyword, tok] of keywords) {
      if (this._matchLiteral(keyword)) {
        this._tokenEnd = this._position;
        return ok(tok);
      }
    }

    return undefined;
  }

  private _tryMatchDateLiteral(): ParseResult<Token> | undefined {
    // ISO-8601 date: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS...
    const dateRegex = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/;
    const remaining = this._source.slice(this._position);
    const match = dateRegex.exec(remaining);

    if (match !== null) {
      const dateStr = match[0];
      this._position += dateStr.length;
      this._tokenEnd = this._position;

      // Validate date components before parsing to match Rust's strict behavior
      if (!isValidDateString(dateStr)) {
        return err(PE.invalidDateString(dateStr, this.span()));
      }

      try {
        const date = DCborDate.fromString(dateStr);
        return ok(token.dateLiteral(date));
      } catch {
        return err(PE.invalidDateString(dateStr, this.span()));
      }
    }

    return undefined;
  }

  private _tryMatchTagValueOrNumber(): ParseResult<Token> | undefined {
    // Check for tag value: integer followed by (
    // Or just a number
    const numberRegex = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
    const remaining = this._source.slice(this._position);
    const match = numberRegex.exec(remaining);

    if (match !== null) {
      const numStr = match[0];
      const nextChar = this._source[this._position + numStr.length];

      // Check if this is a tag value (integer followed by parenthesis)
      if (
        nextChar === "(" &&
        !numStr.includes(".") &&
        !numStr.includes("e") &&
        !numStr.includes("E") &&
        !numStr.startsWith("-")
      ) {
        // It's a tag value. Mirrors Rust `token.rs:128-136`:
        // `stripped.parse::<TagValue>()` accepts the full `u64` range
        // (`0..=2^64-1`). We use `BigInt` to get exact-integer parsing,
        // then narrow to `number` when the value fits in
        // `Number.MAX_SAFE_INTEGER` so callers don't pay the bigint
        // tax for tag numbers in the common range. Anything outside
        // `[0, 2^64-1]` is reported as `InvalidTagValue` matching Rust.
        this._position += numStr.length + 1; // Include the (
        this._tokenEnd = this._position;

        const parsed = parseUsize64(numStr);
        if (parsed === undefined) {
          return err(
            PE.invalidTagValue(numStr, span(this._tokenStart, this._tokenStart + numStr.length)),
          );
        }

        return ok(token.tagValue(parsed));
      }

      // It's a regular number
      this._position += numStr.length;
      this._tokenEnd = this._position;

      const num = parseFloat(numStr);
      return ok(token.number(num));
    }

    return undefined;
  }

  private _tryMatchTagName(): ParseResult<Token> | undefined {
    // Tag name: identifier followed by (
    const tagNameRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*\(/;
    const remaining = this._source.slice(this._position);
    const match = tagNameRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      const name = fullMatch.slice(0, -1); // Remove trailing (
      this._position += fullMatch.length;
      this._tokenEnd = this._position;

      return ok(token.tagName(name));
    }

    return undefined;
  }

  private _tryMatchString(): ParseResult<Token> | undefined {
    if (this._source[this._position] !== '"') {
      return undefined;
    }

    // JavaScript-style string with escape sequences
    // eslint-disable-next-line no-control-regex
    const stringRegex = /^"([^"\\\x00-\x1F]|\\(["\\bnfrt/]|u[a-fA-F0-9]{4}))*"/;
    const remaining = this._source.slice(this._position);
    const match = stringRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      this._position += fullMatch.length;
      this._tokenEnd = this._position;

      // Return the full string including quotes
      return ok(token.string(fullMatch));
    }

    // Invalid string: emit an unrecognized token covering just the
    // opening `"` and let the next call to `next()` re-lex. Mirrors
    // Rust's Logos behaviour when the `String` regex fails to match —
    // the lexer emits `Error::default()` (which `expect_token` upgrades
    // to `UnrecognizedToken(span)` for the single character) and
    // recovers at the very next byte. Earlier revisions of this port
    // consumed through the next `"` or `\n`, which inflated the error
    // span beyond what Rust reports.
    this._position++;
    this._tokenEnd = this._position;
    return err(PE.unrecognizedToken(this.span()));
  }

  private _tryMatchByteStringHex(): ParseResult<Token> | undefined {
    // h'...'
    if (!this._matchLiteral("h'")) {
      return undefined;
    }

    const hexRegex = /^[0-9a-fA-F]*/;
    const remaining = this._source.slice(this._position);
    const match = hexRegex.exec(remaining);
    const hexPart = match !== null ? match[0] : "";

    this._position += hexPart.length;

    if (this._source[this._position] !== "'") {
      this._tokenEnd = this._position;
      return err(PE.invalidHexString(this.span()));
    }

    this._position++; // Skip closing '
    this._tokenEnd = this._position;

    // Check that hex string has even length
    if (hexPart.length % 2 !== 0) {
      return err(PE.invalidHexString(this.span()));
    }

    // Decode hex
    const bytes = hexToBytes(hexPart);
    return ok(token.byteStringHex(bytes));
  }

  private _tryMatchByteStringBase64(): ParseResult<Token> | undefined {
    // b64'...'
    if (!this._matchLiteral("b64'")) {
      return undefined;
    }

    const base64Regex = /^[A-Za-z0-9+/=]*/;
    const remaining = this._source.slice(this._position);
    const match = base64Regex.exec(remaining);
    const base64Part = match !== null ? match[0] : "";

    this._position += base64Part.length;

    if (this._source[this._position] !== "'") {
      this._tokenEnd = this._position;
      return err(PE.invalidBase64String(this.span()));
    }

    this._position++; // Skip closing '
    this._tokenEnd = this._position;

    // Check minimum length requirement (2 characters)
    if (base64Part.length < 2) {
      return err(PE.invalidBase64String(this.span()));
    }

    // Decode base64
    try {
      const bytes = base64ToBytes(base64Part);
      return ok(token.byteStringBase64(bytes));
    } catch {
      return err(PE.invalidBase64String(this.span()));
    }
  }

  private _tryMatchKnownValue(): ParseResult<Token> | undefined {
    if (this._source[this._position] !== "'") {
      return undefined;
    }

    // Check for empty string '' (Unit)
    if (this._source[this._position + 1] === "'") {
      this._position += 2;
      this._tokenEnd = this._position;
      return ok(token.knownValueName(""));
    }

    // Check for numeric known value: '0' or '[1-9][0-9]*'
    const numericRegex = /^'(0|[1-9][0-9]*)'/;
    const remaining = this._source.slice(this._position);
    let match = numericRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      const numStr = match[1];
      this._position += fullMatch.length;
      this._tokenEnd = this._position;

      // Mirrors Rust `token.rs:146-153`: `stripped.parse::<u64>()`
      // accepts the full `u64` range. We share the helper used for
      // `TagValue` to get the same narrow-when-safe-else-bigint path.
      const value = parseUsize64(numStr);
      if (value === undefined) {
        return err(PE.invalidKnownValue(numStr, span(this._tokenStart + 1, this._tokenEnd - 1)));
      }

      return ok(token.knownValueNumber(value));
    }

    // Check for named known value: '[a-zA-Z_][a-zA-Z0-9_-]*'
    const nameRegex = /^'([a-zA-Z_][a-zA-Z0-9_-]*)'/;
    match = nameRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      const name = match[1];
      this._position += fullMatch.length;
      this._tokenEnd = this._position;

      return ok(token.knownValueName(name));
    }

    // Invalid known value: emit an unrecognized token covering just the
    // opening `'` and let the next call to `next()` re-lex. Mirrors
    // Rust's Logos behaviour when neither `KnownValueNumber` nor
    // `KnownValueName` regex matches — the lexer emits `Error::default()`
    // (single character span) and recovers at the next byte. Earlier
    // revisions of this port consumed through the closing `'`, which
    // inflated the error span beyond what Rust reports.
    this._position++;
    this._tokenEnd = this._position;
    return err(PE.unrecognizedToken(this.span()));
  }

  private _tryMatchUR(): ParseResult<Token> | undefined {
    // ur:type/data
    const urRegex = /^ur:([a-zA-Z0-9][a-zA-Z0-9-]*)\/([a-zA-Z]{8,})/;
    const remaining = this._source.slice(this._position);
    const match = urRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      this._position += fullMatch.length;
      this._tokenEnd = this._position;

      try {
        const ur = UR.fromURString(fullMatch);
        return ok(token.ur(ur));
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        return err(PE.invalidUr(errorMsg, this.span()));
      }
    }

    return undefined;
  }

  private _tryMatchPunctuation(): ParseResult<Token> | undefined {
    const ch = this._source[this._position];

    const punctuation: Record<string, Token> = {
      "{": token.braceOpen(),
      "}": token.braceClose(),
      "[": token.bracketOpen(),
      "]": token.bracketClose(),
      "(": token.parenthesisOpen(),
      ")": token.parenthesisClose(),
      ":": token.colon(),
      ",": token.comma(),
    };

    const matched = punctuation[ch];
    if (matched !== undefined) {
      this._position++;
      this._tokenEnd = this._position;
      return ok(matched);
    }

    return undefined;
  }

  private _matchLiteral(literal: string): boolean {
    if (this._source.slice(this._position, this._position + literal.length) === literal) {
      this._position += literal.length;
      return true;
    }
    return false;
  }
}

/**
 * Strictly parses a non-negative integer string in the range
 * `[0, 2^64 - 1]`, mirroring Rust `<u64 as FromStr>::from_str`.
 *
 * - Empty input or non-digit characters → `undefined`.
 * - Values that fit in `Number.MAX_SAFE_INTEGER` are returned as plain
 *   `number`s, so callers in the common case (tag values like `40000`,
 *   known values like `1`) never see a `bigint`.
 * - Values in `(2^53-1, 2^64-1]` are returned as `bigint`. dCBOR's
 *   `cbor({ tag, value })` and `KnownValue` constructors both accept
 *   `bigint` natively, so the bigint flows through to wire encoding
 *   without precision loss.
 * - Values strictly greater than `2^64 - 1` (or negative) are rejected
 *   so this parser never produces a tag/known-value outside the
 *   `u64` domain — matches Rust which fails `parse::<u64>()` in that
 *   case.
 */
const MAX_U64: bigint = (1n << 64n) - 1n;
function parseUsize64(s: string): number | bigint | undefined {
  if (s.length === 0) return undefined;
  // The regex feeding this helper already rejects sign / leading
  // zeros / non-digits; this guard is defensive in case the helper is
  // reused elsewhere.
  if (!/^\d+$/.test(s)) return undefined;
  let value: bigint;
  try {
    value = BigInt(s);
  } catch {
    return undefined;
  }
  if (value < 0n || value > MAX_U64) return undefined;
  // Narrow to plain `number` when safe so common-case callers never
  // see a `bigint`.
  if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return value;
}

/**
 * Converts a hex string to bytes.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Converts a base64 string to bytes with strict validation.
 * Rejects base64 strings with invalid padding (matches Rust's base64 crate behavior).
 */
function base64ToBytes(base64: string): Uint8Array {
  // Validate base64 padding strictly (Rust's base64 crate requires proper padding)
  const expectedPadding = (4 - (base64.replace(/=/g, "").length % 4)) % 4;
  const paddingMatch = /=+$/.exec(base64);
  const actualPadding = paddingMatch !== null ? paddingMatch[0].length : 0;

  // If there should be padding but there isn't, or padding is wrong length
  if (expectedPadding !== actualPadding) {
    throw new Error("Invalid base64 padding");
  }

  // Use built-in atob for base64 decoding
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Validates a date string has valid month/day values.
 * JavaScript Date is lenient and accepts invalid dates like 2023-02-30,
 * but Rust's Date::from_string rejects them.
 */
function isValidDateString(dateStr: string): boolean {
  // Extract date components
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (dateMatch === null) return false;

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);

  // Validate month (1-12)
  if (month < 1 || month > 12) return false;

  // Validate day (1-N where N depends on month)
  if (day < 1) return false;

  // Days in each month (non-leap year)
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Adjust for leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (isLeapYear && month === 2) {
    if (day > 29) return false;
  } else {
    if (day > daysInMonth[month - 1]) return false;
  }

  // If there's a time component, validate it
  const timeMatch = /T(\d{2}):(\d{2}):(\d{2})/.exec(dateStr);
  if (timeMatch !== null) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const second = parseInt(timeMatch[3], 10);

    if (hour < 0 || hour > 23) return false;
    if (minute < 0 || minute > 59) return false;
    if (second < 0 || second > 59) return false;
  }

  return true;
}
