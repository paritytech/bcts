/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Token types and Lexer for the dCBOR pattern language.
 *
 * This module provides tokenization for dCBOR pattern expressions,
 * converting input strings into a sequence of tokens for parsing.
 *
 * @module parse/token
 */

import { parseDcborItemPartial } from "@bcts/dcbor-parse";
import { type Span, span, type Result, Ok, Err } from "../error";
import { Quantifier } from "../quantifier";
import { Reluctance } from "../reluctance";

/**
 * Token types for dCBOR pattern parsing.
 *
 * This is a discriminated union matching the Rust Token enum.
 */
export type Token =
  // Operators
  | { readonly type: "And" }
  | { readonly type: "Or" }
  | { readonly type: "Not" }

  // Quantifiers
  | { readonly type: "RepeatZeroOrMore" }
  | { readonly type: "RepeatZeroOrMoreLazy" }
  | { readonly type: "RepeatZeroOrMorePossessive" }
  | { readonly type: "RepeatOneOrMore" }
  | { readonly type: "RepeatOneOrMoreLazy" }
  | { readonly type: "RepeatOneOrMorePossessive" }
  | { readonly type: "RepeatZeroOrOne" }
  | { readonly type: "RepeatZeroOrOneLazy" }
  | { readonly type: "RepeatZeroOrOnePossessive" }

  // Structure keywords
  | { readonly type: "Tagged" }
  | { readonly type: "Array" }
  | { readonly type: "Map" }

  // Value keywords
  | { readonly type: "Bool" }
  | { readonly type: "ByteString" }
  | { readonly type: "Date" }
  | { readonly type: "Known" }
  | { readonly type: "Null" }
  | { readonly type: "Number" }
  | { readonly type: "Text" }
  | { readonly type: "Digest" }
  | { readonly type: "Search" }

  // Literals
  | { readonly type: "BoolTrue" }
  | { readonly type: "BoolFalse" }
  | { readonly type: "NaN" }
  | { readonly type: "Infinity" }
  | { readonly type: "NegInfinity" }

  // Delimiters
  | { readonly type: "ParenOpen" }
  | { readonly type: "ParenClose" }
  | { readonly type: "BracketOpen" }
  | { readonly type: "BracketClose" }
  | { readonly type: "BraceOpen" }
  | { readonly type: "BraceClose" }
  | { readonly type: "Comma" }
  | { readonly type: "Colon" }
  | { readonly type: "Ellipsis" }

  // Comparisons
  | { readonly type: "GreaterThanOrEqual" }
  | { readonly type: "LessThanOrEqual" }
  | { readonly type: "GreaterThan" }
  | { readonly type: "LessThan" }

  // Complex literals
  | { readonly type: "NumberLiteral"; readonly value: number }
  | { readonly type: "GroupName"; readonly name: string }
  | { readonly type: "StringLiteral"; readonly value: string }
  | { readonly type: "SingleQuoted"; readonly value: string }
  | { readonly type: "Regex"; readonly pattern: string }
  | { readonly type: "HexString"; readonly value: Uint8Array }
  | { readonly type: "HexRegex"; readonly pattern: string }
  | { readonly type: "DateQuoted"; readonly value: string }
  | { readonly type: "DigestQuoted"; readonly value: string }
  | { readonly type: "Range"; readonly quantifier: Quantifier };

/**
 * A token with its position in the source.
 */
export interface SpannedToken {
  readonly token: Token;
  readonly span: Span;
}

/**
 * Simple keywords that map directly to tokens.
 */
const KEYWORDS: Record<string, Token> = {
  // Structure keywords
  tagged: { type: "Tagged" },
  array: { type: "Array" },
  map: { type: "Map" },

  // Value keywords
  bool: { type: "Bool" },
  bstr: { type: "ByteString" },
  date: { type: "Date" },
  known: { type: "Known" },
  null: { type: "Null" },
  number: { type: "Number" },
  text: { type: "Text" },
  digest: { type: "Digest" },
  search: { type: "Search" },

  // Boolean literals
  true: { type: "BoolTrue" },
  false: { type: "BoolFalse" },

  // Special values
  NaN: { type: "NaN" },
  Infinity: { type: "Infinity" },
};

/**
 * Check if a character is whitespace.
 */
const isWhitespace = (ch: string): boolean => {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f";
};

/**
 * Check if a character is a digit.
 */
const isDigit = (ch: string): boolean => {
  return ch >= "0" && ch <= "9";
};

/**
 * Check if a character is a hex digit.
 */
const isHexDigit = (ch: string): boolean => {
  return (ch >= "0" && ch <= "9") || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F");
};

/**
 * Check if a character is an identifier start character.
 */
const isIdentStart = (ch: string): boolean => {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
};

/**
 * Check if a character is an identifier continuation character.
 */
const isIdentCont = (ch: string): boolean => {
  return isIdentStart(ch) || isDigit(ch);
};

/**
 * Parse a hex string to bytes.
 */
const hexToBytes = (hex: string): Uint8Array | undefined => {
  if (hex.length % 2 !== 0) {
    return undefined;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (isNaN(byte)) {
      return undefined;
    }
    bytes[i / 2] = byte;
  }
  return bytes;
};

/**
 * Lexer state for tokenizing dCBOR pattern expressions.
 */
export class Lexer {
  private readonly _input: string;
  private _position: number;

  constructor(input: string) {
    this._input = input;
    this._position = 0;
  }

  /**
   * Creates a new lexer for the given input.
   */
  static new(input: string): Lexer {
    return new Lexer(input);
  }

  /**
   * Returns the input string.
   */
  input(): string {
    return this._input;
  }

  /**
   * Returns the current position in the input.
   */
  position(): number {
    return this._position;
  }

  /**
   * Returns the remaining input.
   */
  remainder(): string {
    return this._input.slice(this._position);
  }

  /**
   * Peeks at the current character without consuming it.
   */
  peek(): string | undefined {
    return this._input[this._position];
  }

  /**
   * Peeks at the character at offset from current position.
   */
  peekAt(offset: number): string | undefined {
    return this._input[this._position + offset];
  }

  /**
   * Consumes and returns the current character.
   */
  advance(): string | undefined {
    const ch = this._input[this._position];
    if (ch !== undefined) {
      this._position++;
    }
    return ch;
  }

  /**
   * Advances by n characters.
   */
  bump(n: number): void {
    this._position += n;
  }

  /**
   * Creates a span from start to current position.
   */
  spanFrom(start: number): Span {
    return span(start, this._position);
  }

  /**
   * Skips whitespace characters.
   */
  skipWhitespace(): void {
    while (this._position < this._input.length && isWhitespace(this._input[this._position])) {
      this._position++;
    }
  }

  /**
   * Checks if the remainder starts with the given string.
   */
  startsWith(s: string): boolean {
    return this._input.slice(this._position).startsWith(s);
  }

  /**
   * Gets the next token.
   */
  next(): Result<SpannedToken> | undefined {
    this.skipWhitespace();

    if (this._position >= this._input.length) {
      return undefined;
    }

    const start = this._position;
    const ch = this.peek() ?? "";

    // Try multi-character operators first
    if (this.startsWith("-Infinity")) {
      this.bump(9);
      return Ok({ token: { type: "NegInfinity" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("...")) {
      this.bump(3);
      return Ok({ token: { type: "Ellipsis" }, span: this.spanFrom(start) });
    }

    // Two-dot ellipsis for ranges (check after three-dot)
    if (this.startsWith("..") && !this.startsWith("...")) {
      this.bump(2);
      return Ok({ token: { type: "Ellipsis" }, span: this.spanFrom(start) });
    }

    if (this.startsWith(">=")) {
      this.bump(2);
      return Ok({ token: { type: "GreaterThanOrEqual" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("<=")) {
      this.bump(2);
      return Ok({ token: { type: "LessThanOrEqual" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("*?")) {
      this.bump(2);
      return Ok({ token: { type: "RepeatZeroOrMoreLazy" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("*+")) {
      this.bump(2);
      return Ok({ token: { type: "RepeatZeroOrMorePossessive" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("+?")) {
      this.bump(2);
      return Ok({ token: { type: "RepeatOneOrMoreLazy" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("++")) {
      this.bump(2);
      return Ok({ token: { type: "RepeatOneOrMorePossessive" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("??")) {
      this.bump(2);
      return Ok({ token: { type: "RepeatZeroOrOneLazy" }, span: this.spanFrom(start) });
    }

    if (this.startsWith("?+")) {
      this.bump(2);
      return Ok({ token: { type: "RepeatZeroOrOnePossessive" }, span: this.spanFrom(start) });
    }

    // Single character operators
    switch (ch) {
      case "&":
        this.advance();
        return Ok({ token: { type: "And" }, span: this.spanFrom(start) });
      case "|":
        this.advance();
        return Ok({ token: { type: "Or" }, span: this.spanFrom(start) });
      case "!":
        this.advance();
        return Ok({ token: { type: "Not" }, span: this.spanFrom(start) });
      case "*":
        this.advance();
        return Ok({ token: { type: "RepeatZeroOrMore" }, span: this.spanFrom(start) });
      case "+":
        this.advance();
        return Ok({ token: { type: "RepeatOneOrMore" }, span: this.spanFrom(start) });
      case "?":
        this.advance();
        return Ok({ token: { type: "RepeatZeroOrOne" }, span: this.spanFrom(start) });
      case "(":
        this.advance();
        return Ok({ token: { type: "ParenOpen" }, span: this.spanFrom(start) });
      case ")":
        this.advance();
        return Ok({ token: { type: "ParenClose" }, span: this.spanFrom(start) });
      case "[":
        this.advance();
        return Ok({ token: { type: "BracketOpen" }, span: this.spanFrom(start) });
      case "]":
        this.advance();
        return Ok({ token: { type: "BracketClose" }, span: this.spanFrom(start) });
      case "}":
        this.advance();
        return Ok({ token: { type: "BraceClose" }, span: this.spanFrom(start) });
      case ",":
        this.advance();
        return Ok({ token: { type: "Comma" }, span: this.spanFrom(start) });
      case ":":
        this.advance();
        return Ok({ token: { type: "Colon" }, span: this.spanFrom(start) });
      case ">":
        this.advance();
        return Ok({ token: { type: "GreaterThan" }, span: this.spanFrom(start) });
      case "<":
        this.advance();
        return Ok({ token: { type: "LessThan" }, span: this.spanFrom(start) });
    }

    // Brace open - may be range or just brace
    if (ch === "{") {
      this.advance();
      return this.parseBraceOpen(start);
    }

    // String literal
    if (ch === '"') {
      this.advance();
      return this.parseString(start);
    }

    // Single quoted string
    if (ch === "'") {
      this.advance();
      return this.parseSingleQuoted(start);
    }

    // Regex
    if (ch === "/") {
      this.advance();
      return this.parseRegex(start);
    }

    // Group name (@name)
    if (ch === "@") {
      this.advance();
      return this.parseGroupName(start);
    }

    // Hex string or hex regex (h'...' or h'/.../')
    if (ch === "h" && this.peekAt(1) === "'") {
      this.bump(2);
      // Check if it's a hex regex
      if (this.peek() === "/") {
        this.advance();
        return this.parseHexRegex(start);
      }
      return this.parseHexString(start);
    }

    // Number literal (including negative)
    if (isDigit(ch) || (ch === "-" && isDigit(this.peekAt(1) ?? ""))) {
      return this.parseNumber(start);
    }

    // Identifier or keyword (including date' and digest')
    if (isIdentStart(ch)) {
      return this.parseIdentifierOrKeyword(start);
    }

    // Unrecognized token
    this.advance();
    return Err({ type: "UnrecognizedToken", span: this.spanFrom(start) });
  }

  /**
   * Tokenizes the entire input and returns all tokens.
   */
  tokenize(): Result<SpannedToken[]> {
    const tokens: SpannedToken[] = [];

    while (true) {
      const result = this.next();
      if (result === undefined) {
        break;
      }
      if (!result.ok) {
        return result as Result<SpannedToken[]>;
      }
      tokens.push(result.value);
    }

    return Ok(tokens);
  }

  /**
   * Parse { - could be BraceOpen or Range.
   */
  private parseBraceOpen(start: number): Result<SpannedToken> {
    // Look ahead to see if this is a range pattern
    const remainder = this.remainder();

    // Skip whitespace and check for digit
    let pos = 0;
    while (pos < remainder.length && isWhitespace(remainder[pos])) {
      pos++;
    }

    if (pos < remainder.length && isDigit(remainder[pos])) {
      // Check if it looks like a range pattern
      if (this.looksLikeRangePattern(remainder.slice(pos))) {
        return this.parseRange(start);
      }
    }

    return Ok({ token: { type: "BraceOpen" }, span: this.spanFrom(start) });
  }

  /**
   * Check if content looks like a range pattern.
   */
  private looksLikeRangePattern(content: string): boolean {
    let i = 0;

    // Skip whitespace
    while (i < content.length && isWhitespace(content[i])) {
      i++;
    }

    // Need at least one digit
    if (i >= content.length || !isDigit(content[i])) {
      return false;
    }

    // Skip digits
    while (i < content.length && isDigit(content[i])) {
      i++;
    }

    // Skip whitespace
    while (i < content.length && isWhitespace(content[i])) {
      i++;
    }

    // After digits, should see comma or closing brace
    // If we see a colon, it's a map constraint, not a range
    if (i < content.length) {
      const ch = content[i];
      if (ch === ":") {
        return false;
      }
      return ch === "," || ch === "}";
    }

    return false;
  }

  /**
   * Parse a range pattern like {1,5} or {3,} or {5}.
   */
  private parseRange(start: number): Result<SpannedToken> {
    // Skip whitespace
    this.skipWhitespace();

    // Parse first number
    const minStart = this._position;
    let peeked = this.peek();
    while (peeked !== undefined && isDigit(peeked)) {
      this.advance();
      peeked = this.peek();
    }

    if (this._position === minStart) {
      return Err({ type: "InvalidRange", span: this.spanFrom(start) });
    }

    const min = parseInt(this._input.slice(minStart, this._position), 10);

    this.skipWhitespace();

    let max: number | undefined;

    const nextCh = this.peek();
    if (nextCh === ",") {
      this.advance();
      this.skipWhitespace();

      const afterComma = this.peek();
      if (afterComma === "}") {
        // Unbounded: {n,}
        this.advance();
        max = undefined;
      } else if (afterComma !== undefined && isDigit(afterComma)) {
        // Bounded: {n,m}
        const maxStart = this._position;
        let maxPeeked = this.peek();
        while (maxPeeked !== undefined && isDigit(maxPeeked)) {
          this.advance();
          maxPeeked = this.peek();
        }
        max = parseInt(this._input.slice(maxStart, this._position), 10);

        this.skipWhitespace();
        if (this.peek() !== "}") {
          return Err({ type: "InvalidRange", span: this.spanFrom(start) });
        }
        this.advance();
      } else {
        return Err({ type: "InvalidRange", span: this.spanFrom(start) });
      }
    } else if (nextCh === "}") {
      // Exact: {n}
      this.advance();
      max = min;
    } else {
      return Err({ type: "InvalidRange", span: this.spanFrom(start) });
    }

    // Check for reluctance modifier
    let reluctance = Reluctance.Greedy;
    const modCh = this.peek();
    if (modCh === "?") {
      this.advance();
      reluctance = Reluctance.Lazy;
    } else if (modCh === "+") {
      this.advance();
      reluctance = Reluctance.Possessive;
    }

    // Validate range
    if (max !== undefined && min > max) {
      return Err({ type: "InvalidRange", span: this.spanFrom(start) });
    }

    const quantifier =
      max !== undefined
        ? Quantifier.between(min, max, reluctance)
        : Quantifier.atLeast(min, reluctance);

    return Ok({ token: { type: "Range", quantifier }, span: this.spanFrom(start) });
  }

  /**
   * Parse a string literal.
   */
  private parseString(start: number): Result<SpannedToken> {
    let result = "";
    let escape = false;

    while (this._position < this._input.length) {
      const ch = this.advance() ?? "";

      if (escape) {
        switch (ch) {
          case '"':
            result += '"';
            break;
          case "\\":
            result += "\\";
            break;
          case "n":
            result += "\n";
            break;
          case "r":
            result += "\r";
            break;
          case "t":
            result += "\t";
            break;
          default:
            result += "\\";
            result += ch;
            break;
        }
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        return Ok({ token: { type: "StringLiteral", value: result }, span: this.spanFrom(start) });
      } else {
        result += ch;
      }
    }

    return Err({ type: "UnterminatedString", span: this.spanFrom(start) });
  }

  /**
   * Parse a single-quoted string.
   */
  private parseSingleQuoted(start: number): Result<SpannedToken> {
    let result = "";
    let escape = false;

    while (this._position < this._input.length) {
      const ch = this.advance() ?? "";

      if (escape) {
        switch (ch) {
          case "'":
            result += "'";
            break;
          case "\\":
            result += "\\";
            break;
          case "n":
            result += "\n";
            break;
          case "r":
            result += "\r";
            break;
          case "t":
            result += "\t";
            break;
          default:
            result += "\\";
            result += ch;
            break;
        }
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "'") {
        return Ok({ token: { type: "SingleQuoted", value: result }, span: this.spanFrom(start) });
      } else {
        result += ch;
      }
    }

    return Err({ type: "UnterminatedString", span: this.spanFrom(start) });
  }

  /**
   * Parse a regex pattern.
   */
  private parseRegex(start: number): Result<SpannedToken> {
    let pattern = "";
    let escape = false;

    while (this._position < this._input.length) {
      const ch = this.advance() ?? "";

      if (escape) {
        pattern += ch;
        escape = false;
      } else if (ch === "\\") {
        pattern += ch;
        escape = true;
      } else if (ch === "/") {
        // Validate regex
        try {
          new RegExp(pattern);
        } catch {
          return Err({ type: "InvalidRegex", span: this.spanFrom(start) });
        }
        return Ok({ token: { type: "Regex", pattern }, span: this.spanFrom(start) });
      } else {
        pattern += ch;
      }
    }

    return Err({ type: "UnterminatedRegex", span: this.spanFrom(start) });
  }

  /**
   * Parse a group name.
   */
  private parseGroupName(start: number): Result<SpannedToken> {
    const nameStart = this._position;

    // First char must be identifier start
    if (!isIdentStart(this.peek() ?? "")) {
      return Err({ type: "InvalidCaptureGroupName", name: "", span: this.spanFrom(start) });
    }

    let identCh = this.peek();
    while (identCh !== undefined && isIdentCont(identCh)) {
      this.advance();
      identCh = this.peek();
    }

    const name = this._input.slice(nameStart, this._position);
    return Ok({ token: { type: "GroupName", name }, span: this.spanFrom(start) });
  }

  /**
   * Parse a hex string.
   */
  private parseHexString(start: number): Result<SpannedToken> {
    let hex = "";

    while (this._position < this._input.length) {
      const ch = this.peek() ?? "";

      if (ch === "'") {
        this.advance();
        const bytes = hexToBytes(hex);
        if (bytes === undefined) {
          return Err({ type: "InvalidHexString", span: this.spanFrom(start) });
        }
        return Ok({ token: { type: "HexString", value: bytes }, span: this.spanFrom(start) });
      } else if (isHexDigit(ch)) {
        hex += ch;
        this.advance();
      } else {
        return Err({ type: "InvalidHexString", span: this.spanFrom(start) });
      }
    }

    return Err({ type: "UnterminatedHexString", span: this.spanFrom(start) });
  }

  /**
   * Parse a hex regex pattern.
   */
  private parseHexRegex(start: number): Result<SpannedToken> {
    let pattern = "";
    let escape = false;

    while (this._position < this._input.length) {
      const ch = this.advance() ?? "";

      if (escape) {
        pattern += ch;
        escape = false;
      } else if (ch === "\\") {
        pattern += ch;
        escape = true;
      } else if (ch === "/") {
        // Check for closing '
        if (this.peek() === "'") {
          this.advance();
          // Validate regex
          try {
            new RegExp(pattern);
          } catch {
            return Err({ type: "InvalidRegex", span: this.spanFrom(start) });
          }
          return Ok({ token: { type: "HexRegex", pattern }, span: this.spanFrom(start) });
        }
        pattern += ch;
      } else {
        pattern += ch;
      }
    }

    return Err({ type: "UnterminatedRegex", span: this.spanFrom(start) });
  }

  /**
   * Parse a number literal using dcbor-parse for consistency with dCBOR.
   */
  private parseNumber(start: number): Result<SpannedToken> {
    const numStart = this._position;

    // Optional negative sign
    if (this.peek() === "-") {
      this.advance();
    }

    // Integer part
    if (this.peek() === "0") {
      this.advance();
    } else if (isDigit(this.peek() ?? "")) {
      while (isDigit(this.peek() ?? "")) {
        this.advance();
      }
    } else {
      return Err({ type: "InvalidNumberFormat", span: this.spanFrom(start) });
    }

    // Fractional part (but not if it's the start of a range like 1..10)
    if (this.peek() === "." && this.peekAt(1) !== ".") {
      this.advance();
      if (!isDigit(this.peek() ?? "")) {
        return Err({ type: "InvalidNumberFormat", span: this.spanFrom(start) });
      }
      while (isDigit(this.peek() ?? "")) {
        this.advance();
      }
    }

    // Exponent part
    if (this.peek() === "e" || this.peek() === "E") {
      this.advance();
      if (this.peek() === "+" || this.peek() === "-") {
        this.advance();
      }
      if (!isDigit(this.peek() ?? "")) {
        return Err({ type: "InvalidNumberFormat", span: this.spanFrom(start) });
      }
      while (isDigit(this.peek() ?? "")) {
        this.advance();
      }
    }

    const numStr = this._input.slice(numStart, this._position);

    // Use dcbor-parse for dCBOR-compliant number parsing
    const parseResult = parseDcborItemPartial(numStr);
    if (!parseResult.ok) {
      return Err({ type: "InvalidNumberFormat", span: this.spanFrom(start) });
    }

    const [cbor] = parseResult.value;
    const numValue = cbor.asNumber();

    if (numValue === undefined) {
      return Err({ type: "InvalidNumberFormat", span: this.spanFrom(start) });
    }

    // Convert bigint to number if needed, ensuring it's a valid JavaScript number
    const value = typeof numValue === "bigint" ? Number(numValue) : numValue;

    if (!isFinite(value)) {
      return Err({ type: "InvalidNumberFormat", span: this.spanFrom(start) });
    }

    return Ok({ token: { type: "NumberLiteral", value }, span: this.spanFrom(start) });
  }

  /**
   * Parse an identifier or keyword.
   */
  private parseIdentifierOrKeyword(start: number): Result<SpannedToken> {
    const identStart = this._position;

    let identCh = this.peek();
    while (identCh !== undefined && isIdentCont(identCh)) {
      this.advance();
      identCh = this.peek();
    }

    const ident = this._input.slice(identStart, this._position);

    // Check for special quoted patterns
    if (ident === "date" && this.peek() === "'") {
      this.advance();
      return this.parseDateQuoted(start);
    }

    if (ident === "digest" && this.peek() === "'") {
      this.advance();
      return this.parseDigestQuoted(start);
    }

    // Check for keyword
    const keyword = KEYWORDS[ident];
    if (keyword !== undefined) {
      return Ok({ token: keyword, span: this.spanFrom(start) });
    }

    // Unknown identifier - treat as unrecognized
    return Err({ type: "UnrecognizedToken", span: this.spanFrom(start) });
  }

  /**
   * Parse a date quoted pattern.
   */
  private parseDateQuoted(start: number): Result<SpannedToken> {
    let content = "";

    while (this._position < this._input.length) {
      const ch = this.advance() ?? "";

      if (ch === "'") {
        if (content.length === 0) {
          return Err({ type: "InvalidDateFormat", span: this.spanFrom(start) });
        }
        return Ok({ token: { type: "DateQuoted", value: content }, span: this.spanFrom(start) });
      }
      content += ch;
    }

    return Err({ type: "UnterminatedDateQuoted", span: this.spanFrom(start) });
  }

  /**
   * Parse a digest quoted pattern.
   */
  private parseDigestQuoted(start: number): Result<SpannedToken> {
    let content = "";

    while (this._position < this._input.length) {
      const ch = this.advance() ?? "";

      if (ch === "'") {
        if (content.length === 0) {
          return Err({
            type: "InvalidDigestPattern",
            message: "empty content",
            span: this.spanFrom(start),
          });
        }
        return Ok({ token: { type: "DigestQuoted", value: content }, span: this.spanFrom(start) });
      }
      content += ch;
    }

    return Err({ type: "UnterminatedDigestQuoted", span: this.spanFrom(start) });
  }

  /**
   * Peeks at the next token without consuming it.
   * Returns a Result with the token or undefined if at end of input.
   */
  peekToken(): Result<Token> | undefined {
    const savedPosition = this._position;
    const result = this.next();
    this._position = savedPosition;

    if (result === undefined) {
      return undefined;
    }

    if (!result.ok) {
      return result;
    }

    return Ok(result.value.token);
  }

  /**
   * Returns the current span (position to position).
   */
  span(): Span {
    return span(this._position, this._position);
  }

  /**
   * Returns the last token's span.
   */
  lastSpan(): Span {
    // This is a simplification - in reality we'd track the last span
    return span(this._position, this._position);
  }
}

// Re-export Span
export type { Span };
