/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Token types and Lexer
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust token.rs
 * Uses a manual lexer implementation instead of logos.
 *
 * @module envelope-pattern/parse/token
 */

import { Quantifier, Reluctance } from "@bcts/dcbor-pattern";
import {
  type Span,
  type Result,
  type EnvelopePatternError,
  ok,
  err,
  invalidRegex,
  unterminatedRegex,
  invalidRange,
  invalidHexString,
  unexpectedEndOfInput,
  invalidNumberFormat,
} from "../error";

/**
 * Token types for the Gordian Envelope pattern syntax.
 *
 * Corresponds to the Rust `Token` enum in token.rs
 */
export type Token =
  // Meta Pattern Operators
  | { readonly type: "And" }
  | { readonly type: "Or" }
  | { readonly type: "Not" }
  | { readonly type: "Traverse" }
  | { readonly type: "RepeatZeroOrMore" }
  | { readonly type: "RepeatZeroOrMoreLazy" }
  | { readonly type: "RepeatZeroOrMorePossessive" }
  | { readonly type: "RepeatOneOrMore" }
  | { readonly type: "RepeatOneOrMoreLazy" }
  | { readonly type: "RepeatOneOrMorePossessive" }
  | { readonly type: "RepeatZeroOrOne" }
  | { readonly type: "RepeatZeroOrOneLazy" }
  | { readonly type: "RepeatZeroOrOnePossessive" }
  // Structure Pattern Keywords
  | { readonly type: "Assertion" }
  | { readonly type: "AssertionPred" }
  | { readonly type: "AssertionObj" }
  | { readonly type: "Digest" }
  | { readonly type: "Node" }
  | { readonly type: "Obj" }
  | { readonly type: "Obscured" }
  | { readonly type: "Elided" }
  | { readonly type: "Encrypted" }
  | { readonly type: "Compressed" }
  | { readonly type: "Pred" }
  | { readonly type: "Subject" }
  | { readonly type: "Wrapped" }
  | { readonly type: "Unwrap" }
  | { readonly type: "Search" }
  // Leaf Pattern Keywords
  | { readonly type: "ByteString" }
  | { readonly type: "Leaf" }
  | { readonly type: "Cbor" }
  | { readonly type: "DateKeyword" }
  | { readonly type: "Known" }
  | { readonly type: "Null" }
  | { readonly type: "NumberKeyword" }
  | { readonly type: "Tagged" }
  // Special literals
  | { readonly type: "BoolKeyword" }
  | { readonly type: "BoolTrue" }
  | { readonly type: "BoolFalse" }
  | { readonly type: "TextKeyword" }
  | { readonly type: "NaN" }
  | { readonly type: "StringLiteral"; readonly value: Result<string> }
  // Grouping and Range delimiters
  | { readonly type: "ParenOpen" }
  | { readonly type: "ParenClose" }
  | { readonly type: "BracketOpen" }
  | { readonly type: "BracketClose" }
  | { readonly type: "Comma" }
  | { readonly type: "Ellipsis" }
  | { readonly type: "GreaterThanOrEqual" }
  | { readonly type: "LessThanOrEqual" }
  | { readonly type: "GreaterThan" }
  | { readonly type: "LessThan" }
  // Numbers
  | { readonly type: "Integer"; readonly value: Result<number> }
  | { readonly type: "UnsignedInteger"; readonly value: Result<number> }
  | { readonly type: "Float"; readonly value: Result<number> }
  | { readonly type: "Infinity" }
  | { readonly type: "NegativeInfinity" }
  // Complex tokens
  | { readonly type: "GroupName"; readonly name: string }
  | { readonly type: "Regex"; readonly value: Result<string> }
  | { readonly type: "HexPattern"; readonly value: Result<Uint8Array> }
  | { readonly type: "HexBinaryRegex"; readonly value: Result<string> }
  | { readonly type: "DatePattern"; readonly value: Result<string> }
  | { readonly type: "Range"; readonly value: Result<Quantifier> }
  | { readonly type: "SingleQuotedPattern"; readonly value: Result<string> }
  | { readonly type: "SingleQuotedRegex"; readonly value: Result<string> }
  | { readonly type: "Identifier"; readonly value: string };

/**
 * Keyword to token type mapping.
 */
const KEYWORDS = new Map<string, Token>([
  // Meta Pattern Operators
  ["&", { type: "And" }],
  ["|", { type: "Or" }],
  ["!", { type: "Not" }],
  // Structure Pattern Keywords
  ["assert", { type: "Assertion" }],
  ["assertpred", { type: "AssertionPred" }],
  ["assertobj", { type: "AssertionObj" }],
  ["digest", { type: "Digest" }],
  ["node", { type: "Node" }],
  ["obj", { type: "Obj" }],
  ["obscured", { type: "Obscured" }],
  ["elided", { type: "Elided" }],
  ["encrypted", { type: "Encrypted" }],
  ["compressed", { type: "Compressed" }],
  ["pred", { type: "Pred" }],
  ["subj", { type: "Subject" }],
  ["wrapped", { type: "Wrapped" }],
  ["unwrap", { type: "Unwrap" }],
  ["search", { type: "Search" }],
  // Leaf Pattern Keywords
  ["bstr", { type: "ByteString" }],
  ["leaf", { type: "Leaf" }],
  ["cbor", { type: "Cbor" }],
  ["date", { type: "DateKeyword" }],
  ["known", { type: "Known" }],
  ["null", { type: "Null" }],
  ["number", { type: "NumberKeyword" }],
  ["tagged", { type: "Tagged" }],
  // Special literals
  ["bool", { type: "BoolKeyword" }],
  ["true", { type: "BoolTrue" }],
  ["false", { type: "BoolFalse" }],
  ["text", { type: "TextKeyword" }],
  ["NaN", { type: "NaN" }],
  ["Infinity", { type: "Infinity" }],
  ["-Infinity", { type: "NegativeInfinity" }],
]);

/**
 * Checks if a character is whitespace.
 */
function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

/**
 * Checks if a character can start an identifier.
 */
function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

/**
 * Checks if a character can continue an identifier.
 */
function isIdentContinue(ch: string): boolean {
  return isIdentStart(ch) || (ch >= "0" && ch <= "9");
}

/**
 * Checks if a character is a digit.
 */
function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/**
 * Checks if a character is a hex digit.
 */
function isHexDigit(ch: string): boolean {
  return (ch >= "0" && ch <= "9") || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
}

/**
 * Lexer for Gordian Envelope pattern syntax.
 */
export class Lexer {
  private readonly _source: string;
  private _position = 0;
  private _tokenStart = 0;
  private _peekedToken: { token: Token; span: Span } | undefined = undefined;

  constructor(source: string) {
    this._source = source;
  }

  /**
   * Gets the current position in the source.
   */
  get position(): number {
    return this._position;
  }

  /**
   * Peeks at the next token without consuming it.
   */
  peekToken(): { token: Token; span: Span } | undefined {
    if (this._peekedToken !== undefined) {
      return this._peekedToken;
    }
    const result = this.next();
    this._peekedToken = result;
    return result;
  }

  /**
   * Gets the current span (from token start to current position).
   */
  span(): Span {
    return { start: this._tokenStart, end: this._position };
  }

  /**
   * Gets the remaining source string.
   */
  remainder(): string {
    return this._source.slice(this._position);
  }

  /**
   * Peeks at the current character without consuming it.
   */
  peek(): string | undefined {
    if (this._position >= this._source.length) {
      return undefined;
    }
    return this._source[this._position];
  }

  /**
   * Peeks at the next character without consuming current.
   */
  peekNext(): string | undefined {
    if (this._position + 1 >= this._source.length) {
      return undefined;
    }
    return this._source[this._position + 1];
  }

  /**
   * Advances the position by n characters.
   */
  bump(n = 1): void {
    this._position = Math.min(this._position + n, this._source.length);
  }

  /**
   * Skips whitespace.
   */
  private _skipWhitespace(): void {
    while (this._position < this._source.length) {
      const ch = this._source[this._position];
      if (ch !== undefined && isWhitespace(ch)) {
        this._position++;
      } else {
        break;
      }
    }
  }

  /**
   * Parses a string literal (after the opening quote).
   */
  private _parseStringLiteral(): Result<string> {
    const src = this.remainder();
    let escape = false;
    let content = "";

    for (let i = 0; i < src.length; i++) {
      const b = src[i];
      if (b === undefined) break;

      if (b === '"' && !escape) {
        // End of string
        this.bump(i + 1);
        return ok(content);
      }

      if (b === "\\" && !escape) {
        escape = true;
        continue;
      }

      if (escape) {
        switch (b) {
          case "n":
            content += "\n";
            break;
          case "t":
            content += "\t";
            break;
          case "r":
            content += "\r";
            break;
          case "\\":
            content += "\\";
            break;
          case '"':
            content += '"';
            break;
          default:
            // Invalid escape sequence, but we'll be lenient
            content += "\\";
            content += b;
        }
        escape = false;
      } else {
        content += b;
      }
    }

    return err(unexpectedEndOfInput());
  }

  /**
   * Parses a regex pattern (after the opening slash).
   */
  private _parseRegex(): Result<string> {
    const src = this.remainder();
    let escape = false;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === undefined) break;

      if (ch === "\\" && !escape) {
        escape = true;
        continue;
      }

      if (ch === "/" && !escape) {
        // Found the closing delimiter
        this.bump(i + 1);
        const content = src.slice(0, i);
        // Validate regex
        try {
          new RegExp(content);
          return ok(content);
        } catch {
          return err(invalidRegex(this.span()));
        }
      }

      escape = false;
    }

    return err(unterminatedRegex(this.span()));
  }

  /**
   * Parses a hex pattern (after h').
   */
  private _parseHexPattern(): Result<Uint8Array> {
    const src = this.remainder();

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === undefined) break;

      if (ch === "'") {
        // Found the closing delimiter
        const hexStr = src.slice(0, i);
        this.bump(i + 1);

        // Validate and decode hex
        if (hexStr.length % 2 !== 0) {
          return err(invalidHexString(this.span()));
        }

        const bytes = new Uint8Array(hexStr.length / 2);
        for (let j = 0; j < hexStr.length; j += 2) {
          const byte = parseInt(hexStr.slice(j, j + 2), 16);
          if (Number.isNaN(byte)) {
            return err(invalidHexString(this.span()));
          }
          bytes[j / 2] = byte;
        }
        return ok(bytes);
      }

      if (!isHexDigit(ch)) {
        return err(invalidHexString(this.span()));
      }
    }

    return err(invalidHexString(this.span()));
  }

  /**
   * Parses a hex binary regex (after h'/).
   */
  private _parseHexBinaryRegex(): Result<string> {
    const src = this.remainder();
    let escape = false;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === undefined) break;

      if (ch === "\\" && !escape) {
        escape = true;
        continue;
      }

      if (ch === "/" && !escape) {
        // Found the closing delimiter
        this.bump(i + 1);
        // Check for optional closing '
        if (this.peek() === "'") {
          this.bump(1);
        }
        const regexStr = src.slice(0, i);
        // Validate regex
        try {
          new RegExp(regexStr);
          return ok(regexStr);
        } catch {
          return err(invalidRegex(this.span()));
        }
      }

      escape = false;
    }

    return err(unterminatedRegex(this.span()));
  }

  /**
   * Parses a date pattern (after date').
   */
  private _parseDatePattern(): Result<string> {
    const src = this.remainder();

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === "'") {
        // Found the closing delimiter
        const content = src.slice(0, i);
        this.bump(i + 1);
        return ok(content);
      }
    }

    return err(unterminatedRegex(this.span()));
  }

  /**
   * Parses a range pattern (after {).
   */
  private _parseRange(): Result<Quantifier> {
    const src = this.remainder();
    let pos = 0;

    // Skip whitespace
    while (pos < src.length && src[pos] !== undefined && isWhitespace(src[pos])) {
      pos++;
    }

    // Parse minimum value
    const minStart = pos;
    while (pos < src.length && src[pos] !== undefined && isDigit(src[pos])) {
      pos++;
    }
    if (minStart === pos) {
      return err(invalidRange(this.span()));
    }
    const min = parseInt(src.slice(minStart, pos), 10);
    if (Number.isNaN(min)) {
      return err(invalidRange(this.span()));
    }

    // Skip whitespace
    while (pos < src.length && src[pos] !== undefined && isWhitespace(src[pos])) {
      pos++;
    }

    let max: number | undefined;
    const ch = src[pos];

    if (ch === ",") {
      pos++;
      // Skip whitespace
      while (pos < src.length && src[pos] !== undefined && isWhitespace(src[pos])) {
        pos++;
      }

      const nextCh = src[pos];
      if (nextCh === "}") {
        // {n,} - open ended
        pos++;
        max = undefined;
      } else if (nextCh !== undefined && isDigit(nextCh)) {
        // {n,m} - range
        const maxStart = pos;
        while (pos < src.length && src[pos] !== undefined && isDigit(src[pos])) {
          pos++;
        }
        max = parseInt(src.slice(maxStart, pos), 10);
        if (Number.isNaN(max)) {
          return err(invalidRange(this.span()));
        }

        // Skip whitespace
        while (pos < src.length && src[pos] !== undefined && isWhitespace(src[pos])) {
          pos++;
        }

        if (src[pos] !== "}") {
          return err(invalidRange(this.span()));
        }
        pos++;
      } else {
        return err(invalidRange(this.span()));
      }
    } else if (ch === "}") {
      // {n} - exact
      pos++;
      max = min;
    } else {
      return err(invalidRange(this.span()));
    }

    // Determine greediness
    let mode: Reluctance = Reluctance.Greedy;
    const modeChar = src[pos];
    if (modeChar === "?") {
      pos++;
      mode = Reluctance.Lazy;
    } else if (modeChar === "+") {
      pos++;
      mode = Reluctance.Possessive;
    }

    this.bump(pos);

    if (max !== undefined && min > max) {
      return err(invalidRange(this.span()));
    }

    if (max !== undefined) {
      return ok(Quantifier.between(min, max, mode));
    }
    return ok(Quantifier.atLeast(min, mode));
  }

  /**
   * Parses a single quoted pattern (after ').
   */
  private _parseSingleQuotedPattern(): Result<string> {
    const src = this.remainder();

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === "'") {
        // Found the closing delimiter
        const content = src.slice(0, i);
        this.bump(i + 1);
        return ok(content);
      }
    }

    return err(unterminatedRegex(this.span()));
  }

  /**
   * Parses a single quoted regex (after '/).
   */
  private _parseSingleQuotedRegex(): Result<string> {
    const src = this.remainder();
    let escape = false;

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === undefined) break;

      if (ch === "\\" && !escape) {
        escape = true;
        continue;
      }

      if (ch === "/" && !escape) {
        // Found the closing delimiter
        this.bump(i + 1);
        // Check for optional closing '
        if (this.peek() === "'") {
          this.bump(1);
        }
        const regexStr = src.slice(0, i);
        // Validate regex
        try {
          new RegExp(regexStr);
          return ok(regexStr);
        } catch {
          return err(invalidRegex(this.span()));
        }
      }

      escape = false;
    }

    return err(unterminatedRegex(this.span()));
  }

  /**
   * Parses a number (integer or float).
   */
  private _parseNumber(): Token {
    const startPos = this._position;
    let isFloat = false;
    let isNegative = false;

    // Check for negative sign
    if (this.peek() === "-") {
      isNegative = true;
      this.bump(1);
    }

    // Parse integer part
    let c = this.peek();
    while (c !== undefined && isDigit(c)) {
      this.bump(1);
      c = this.peek();
    }

    // Check for decimal point
    const nextC = this.peekNext();
    if (this.peek() === "." && nextC !== undefined && isDigit(nextC)) {
      isFloat = true;
      this.bump(1); // consume '.'

      // Parse fractional part
      c = this.peek();
      while (c !== undefined && isDigit(c)) {
        this.bump(1);
        c = this.peek();
      }
    }

    // Check for exponent
    if (this.peek() === "e" || this.peek() === "E") {
      isFloat = true;
      this.bump(1);

      // Check for sign
      if (this.peek() === "+" || this.peek() === "-") {
        this.bump(1);
      }

      // Parse exponent digits
      c = this.peek();
      while (c !== undefined && isDigit(c)) {
        this.bump(1);
        c = this.peek();
      }
    }

    const numStr = this._source.slice(startPos, this._position);

    if (isFloat) {
      const value = parseFloat(numStr);
      if (Number.isNaN(value)) {
        return { type: "Float", value: err(invalidNumberFormat(this.span())) };
      }
      return { type: "Float", value: ok(value) };
    }

    const value = parseInt(numStr, 10);
    if (Number.isNaN(value)) {
      return { type: "Integer", value: err(invalidNumberFormat(this.span())) };
    }

    if (isNegative) {
      return { type: "Integer", value: ok(value) };
    }
    return { type: "UnsignedInteger", value: ok(value) };
  }

  /**
   * Gets the next token from the input.
   */
  next(): { token: Token; span: Span } | undefined {
    // Return peeked token if available
    if (this._peekedToken !== undefined) {
      const peeked = this._peekedToken;
      this._peekedToken = undefined;
      return peeked;
    }

    this._skipWhitespace();
    this._tokenStart = this._position;

    if (this._position >= this._source.length) {
      return undefined;
    }

    const ch = this._source[this._position];
    if (ch === undefined) return undefined;

    // Check for two-character operators first
    const twoChar = this._source.slice(this._position, this._position + 2);
    const threeChar = this._source.slice(this._position, this._position + 3);

    // Check for ... (ellipsis)
    if (threeChar === "...") {
      this.bump(3);
      return { token: { type: "Ellipsis" }, span: this.span() };
    }

    // Check for -Infinity
    if (this._source.slice(this._position, this._position + 9) === "-Infinity") {
      this.bump(9);
      return { token: { type: "NegativeInfinity" }, span: this.span() };
    }

    // Check for two-character operators
    switch (twoChar) {
      case "->":
        this.bump(2);
        return { token: { type: "Traverse" }, span: this.span() };
      case "*?":
        this.bump(2);
        return { token: { type: "RepeatZeroOrMoreLazy" }, span: this.span() };
      case "*+":
        this.bump(2);
        return { token: { type: "RepeatZeroOrMorePossessive" }, span: this.span() };
      case "+?":
        this.bump(2);
        return { token: { type: "RepeatOneOrMoreLazy" }, span: this.span() };
      case "++":
        this.bump(2);
        return { token: { type: "RepeatOneOrMorePossessive" }, span: this.span() };
      case "??":
        this.bump(2);
        return { token: { type: "RepeatZeroOrOneLazy" }, span: this.span() };
      case "?+":
        this.bump(2);
        return { token: { type: "RepeatZeroOrOnePossessive" }, span: this.span() };
      case ">=":
        this.bump(2);
        return { token: { type: "GreaterThanOrEqual" }, span: this.span() };
      case "<=":
        this.bump(2);
        return { token: { type: "LessThanOrEqual" }, span: this.span() };
      case "h'": {
        this.bump(2);
        // Check if followed by / for HexBinaryRegex
        if (this.peek() === "/") {
          this.bump(1);
          return {
            token: { type: "HexBinaryRegex", value: this._parseHexBinaryRegex() },
            span: this.span(),
          };
        }
        return { token: { type: "HexPattern", value: this._parseHexPattern() }, span: this.span() };
      }
      case "'/":
        this.bump(2);
        return {
          token: { type: "SingleQuotedRegex", value: this._parseSingleQuotedRegex() },
          span: this.span(),
        };
    }

    // Check for single character operators
    switch (ch) {
      case "&":
        this.bump(1);
        return { token: { type: "And" }, span: this.span() };
      case "|":
        this.bump(1);
        return { token: { type: "Or" }, span: this.span() };
      case "!":
        this.bump(1);
        return { token: { type: "Not" }, span: this.span() };
      case "*":
        this.bump(1);
        return { token: { type: "RepeatZeroOrMore" }, span: this.span() };
      case "+":
        this.bump(1);
        return { token: { type: "RepeatOneOrMore" }, span: this.span() };
      case "?":
        this.bump(1);
        return { token: { type: "RepeatZeroOrOne" }, span: this.span() };
      case "(":
        this.bump(1);
        return { token: { type: "ParenOpen" }, span: this.span() };
      case ")":
        this.bump(1);
        return { token: { type: "ParenClose" }, span: this.span() };
      case "[":
        this.bump(1);
        return { token: { type: "BracketOpen" }, span: this.span() };
      case "]":
        this.bump(1);
        return { token: { type: "BracketClose" }, span: this.span() };
      case ",":
        this.bump(1);
        return { token: { type: "Comma" }, span: this.span() };
      case ">":
        this.bump(1);
        return { token: { type: "GreaterThan" }, span: this.span() };
      case "<":
        this.bump(1);
        return { token: { type: "LessThan" }, span: this.span() };
      case '"':
        this.bump(1);
        return {
          token: { type: "StringLiteral", value: this._parseStringLiteral() },
          span: this.span(),
        };
      case "/":
        this.bump(1);
        return { token: { type: "Regex", value: this._parseRegex() }, span: this.span() };
      case "{":
        this.bump(1);
        return { token: { type: "Range", value: this._parseRange() }, span: this.span() };
      case "'":
        this.bump(1);
        return {
          token: { type: "SingleQuotedPattern", value: this._parseSingleQuotedPattern() },
          span: this.span(),
        };
      case "@": {
        // Group name
        this.bump(1);
        const start = this._position;
        let gc = this.peek();
        if (gc !== undefined && isIdentStart(gc)) {
          gc = this.peek();
          while (gc !== undefined && isIdentContinue(gc)) {
            this.bump(1);
            gc = this.peek();
          }
          const name = this._source.slice(start, this._position);
          return { token: { type: "GroupName", name }, span: this.span() };
        }
        // Invalid group name, return as error token
        return { token: { type: "GroupName", name: "" }, span: this.span() };
      }
    }

    // Check for date' pattern
    if (this._source.slice(this._position, this._position + 5) === "date'") {
      this.bump(5);
      return { token: { type: "DatePattern", value: this._parseDatePattern() }, span: this.span() };
    }

    // Check for number (including negative)
    const nextChar = this.peekNext();
    if (isDigit(ch) || (ch === "-" && nextChar !== undefined && isDigit(nextChar))) {
      return { token: this._parseNumber(), span: this.span() };
    }

    // Check for identifier/keyword
    if (isIdentStart(ch)) {
      const start = this._position;
      let ic = this.peek();
      while (ic !== undefined && isIdentContinue(ic)) {
        this.bump(1);
        ic = this.peek();
      }
      const ident = this._source.slice(start, this._position);

      // Check for keywords
      const keyword = KEYWORDS.get(ident);
      if (keyword !== undefined) {
        return { token: keyword, span: this.span() };
      }

      // Unknown identifier - return as Identifier token
      return { token: { type: "Identifier", value: ident }, span: this.span() };
    }

    // Unknown character
    this.bump(1);
    return undefined;
  }

  /**
   * Iterates over all tokens.
   */
  *[Symbol.iterator](): Iterator<
    { token: Token; span: Span } | { error: EnvelopePatternError; span: Span }
  > {
    let result = this.next();
    while (result !== undefined) {
      yield result;
      result = this.next();
    }
  }
}

/**
 * Creates a new lexer for the given source.
 */
export function lexer(source: string): Lexer {
  return new Lexer(source);
}
