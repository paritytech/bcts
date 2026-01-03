/**
 * @bcts/dcbor-parse - Token types and Lexer
 *
 * This is a 1:1 TypeScript port of bc-dcbor-parse-rust token.rs
 *
 * @module dcbor-parse/token
 */

import { type CborDate, CborDate as DCborDate } from "@bcts/dcbor";
import { UR } from "@bcts/uniform-resources";
import {
  type Span,
  span,
  parseError as PE,
  type ParseResult,
  ok,
  err,
} from "./error";

/**
 * Token types produced by the lexer.
 *
 * Corresponds to the Rust `Token` enum in token.rs
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
  | { readonly type: "TagValue"; readonly value: number }
  | { readonly type: "TagName"; readonly value: string }
  | { readonly type: "KnownValueNumber"; readonly value: number }
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
  tagValue(value: number): Token {
    return { type: "TagValue", value };
  },
  tagName(value: string): Token {
    return { type: "TagName", value };
  },
  knownValueNumber(value: number): Token {
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
  readonly #source: string;
  #position: number;
  #tokenStart: number;
  #tokenEnd: number;

  constructor(source: string) {
    this.#source = source;
    this.#position = 0;
    this.#tokenStart = 0;
    this.#tokenEnd = 0;
  }

  /**
   * Gets the current span (position range of the last token).
   */
  span(): Span {
    return span(this.#tokenStart, this.#tokenEnd);
  }

  /**
   * Gets the slice of source corresponding to the last token.
   */
  slice(): string {
    return this.#source.slice(this.#tokenStart, this.#tokenEnd);
  }

  /**
   * Gets the next token, or undefined if at end of input.
   * Returns a Result to handle lexing errors.
   */
  next(): ParseResult<Token> | undefined {
    this.#skipWhitespaceAndComments();

    if (this.#position >= this.#source.length) {
      return undefined;
    }

    this.#tokenStart = this.#position;

    // Try to match tokens in order of specificity
    const result =
      this.#tryMatchKeyword() ??
      this.#tryMatchDateLiteral() ??
      this.#tryMatchTagValueOrNumber() ??
      this.#tryMatchTagName() ??
      this.#tryMatchString() ??
      this.#tryMatchByteStringHex() ??
      this.#tryMatchByteStringBase64() ??
      this.#tryMatchKnownValue() ??
      this.#tryMatchUR() ??
      this.#tryMatchPunctuation();

    if (result === undefined) {
      // Unrecognized token - consume one character
      this.#position++;
      this.#tokenEnd = this.#position;
      return err(PE.unrecognizedToken(this.span()));
    }

    return result;
  }

  #skipWhitespaceAndComments(): void {
    while (this.#position < this.#source.length) {
      const ch = this.#source[this.#position];

      // Skip whitespace
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === "\f") {
        this.#position++;
        continue;
      }

      // Skip inline comments: /.../ (not preceded by another /)
      if (ch === "/" && this.#position + 1 < this.#source.length && this.#source[this.#position + 1] !== "/") {
        this.#position++; // Skip opening /
        while (this.#position < this.#source.length && this.#source[this.#position] !== "/") {
          this.#position++;
        }
        if (this.#position < this.#source.length) {
          this.#position++; // Skip closing /
        }
        continue;
      }

      // Skip end-of-line comments: #...
      if (ch === "#") {
        while (this.#position < this.#source.length && this.#source[this.#position] !== "\n") {
          this.#position++;
        }
        continue;
      }

      break;
    }
  }

  #tryMatchKeyword(): ParseResult<Token> | undefined {
    const keywords: [string, Token][] = [
      ["true", token.bool(true)],
      ["false", token.bool(false)],
      ["null", token.null()],
      ["NaN", token.nan()],
      ["Infinity", token.infinity()],
      ["-Infinity", token.negInfinity()],
      ["Unit", token.unit()],
    ];

    for (const [keyword, tok] of keywords) {
      if (this.#matchLiteral(keyword)) {
        // Make sure it's not part of a longer identifier
        const nextChar = this.#source[this.#position];
        if (nextChar === undefined || !this.#isIdentifierChar(nextChar)) {
          this.#tokenEnd = this.#position;
          return ok(tok);
        }
        // Reset position if it was a partial match
        this.#position = this.#tokenStart;
      }
    }

    return undefined;
  }

  #tryMatchDateLiteral(): ParseResult<Token> | undefined {
    // ISO-8601 date: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS...
    const dateRegex = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/;
    const remaining = this.#source.slice(this.#position);
    const match = dateRegex.exec(remaining);

    if (match !== null) {
      const dateStr = match[0];
      this.#position += dateStr.length;
      this.#tokenEnd = this.#position;

      try {
        const date = DCborDate.fromString(dateStr);
        return ok(token.dateLiteral(date));
      } catch {
        return err(PE.invalidDateString(dateStr, this.span()));
      }
    }

    return undefined;
  }

  #tryMatchTagValueOrNumber(): ParseResult<Token> | undefined {
    // Check for tag value: integer followed by (
    // Or just a number
    const numberRegex = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
    const remaining = this.#source.slice(this.#position);
    const match = numberRegex.exec(remaining);

    if (match !== null) {
      const numStr = match[0];
      const nextChar = this.#source[this.#position + numStr.length];

      // Check if this is a tag value (integer followed by parenthesis)
      if (nextChar === "(" && !numStr.includes(".") && !numStr.includes("e") && !numStr.includes("E") && !numStr.startsWith("-")) {
        // It's a tag value
        this.#position += numStr.length + 1; // Include the (
        this.#tokenEnd = this.#position;

        const tagValue = parseInt(numStr, 10);
        if (!Number.isSafeInteger(tagValue) || tagValue < 0) {
          return err(PE.invalidTagValue(numStr, span(this.#tokenStart, this.#tokenStart + numStr.length)));
        }

        return ok(token.tagValue(tagValue));
      }

      // It's a regular number
      this.#position += numStr.length;
      this.#tokenEnd = this.#position;

      const num = parseFloat(numStr);
      return ok(token.number(num));
    }

    return undefined;
  }

  #tryMatchTagName(): ParseResult<Token> | undefined {
    // Tag name: identifier followed by (
    const tagNameRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*\(/;
    const remaining = this.#source.slice(this.#position);
    const match = tagNameRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      const name = fullMatch.slice(0, -1); // Remove trailing (
      this.#position += fullMatch.length;
      this.#tokenEnd = this.#position;

      return ok(token.tagName(name));
    }

    return undefined;
  }

  #tryMatchString(): ParseResult<Token> | undefined {
    if (this.#source[this.#position] !== '"') {
      return undefined;
    }

    // JavaScript-style string with escape sequences
    // eslint-disable-next-line no-control-regex
    const stringRegex = /^"([^"\\\x00-\x1F]|\\(["\\bnfrt/]|u[a-fA-F0-9]{4}))*"/;
    const remaining = this.#source.slice(this.#position);
    const match = stringRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      this.#position += fullMatch.length;
      this.#tokenEnd = this.#position;

      // Return the full string including quotes
      return ok(token.string(fullMatch));
    }

    // Invalid string - try to find where it ends for better error reporting
    this.#position++;
    while (this.#position < this.#source.length) {
      const ch = this.#source[this.#position];
      if (ch === '"' || ch === "\n") {
        if (ch === '"') this.#position++;
        break;
      }
      if (ch === "\\") {
        this.#position += 2;
      } else {
        this.#position++;
      }
    }
    this.#tokenEnd = this.#position;
    return err(PE.unrecognizedToken(this.span()));
  }

  #tryMatchByteStringHex(): ParseResult<Token> | undefined {
    // h'...'
    if (!this.#matchLiteral("h'")) {
      return undefined;
    }

    const hexRegex = /^[0-9a-fA-F]*/;
    const remaining = this.#source.slice(this.#position);
    const match = hexRegex.exec(remaining);
    const hexPart = match !== null ? match[0] : "";

    this.#position += hexPart.length;

    if (this.#source[this.#position] !== "'") {
      this.#tokenEnd = this.#position;
      return err(PE.invalidHexString(this.span()));
    }

    this.#position++; // Skip closing '
    this.#tokenEnd = this.#position;

    // Check that hex string has even length
    if (hexPart.length % 2 !== 0) {
      return err(PE.invalidHexString(this.span()));
    }

    // Decode hex
    const bytes = hexToBytes(hexPart);
    return ok(token.byteStringHex(bytes));
  }

  #tryMatchByteStringBase64(): ParseResult<Token> | undefined {
    // b64'...'
    if (!this.#matchLiteral("b64'")) {
      return undefined;
    }

    const base64Regex = /^[A-Za-z0-9+/=]*/;
    const remaining = this.#source.slice(this.#position);
    const match = base64Regex.exec(remaining);
    const base64Part = match !== null ? match[0] : "";

    this.#position += base64Part.length;

    if (this.#source[this.#position] !== "'") {
      this.#tokenEnd = this.#position;
      return err(PE.invalidBase64String(this.span()));
    }

    this.#position++; // Skip closing '
    this.#tokenEnd = this.#position;

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

  #tryMatchKnownValue(): ParseResult<Token> | undefined {
    if (this.#source[this.#position] !== "'") {
      return undefined;
    }

    // Check for empty string '' (Unit)
    if (this.#source[this.#position + 1] === "'") {
      this.#position += 2;
      this.#tokenEnd = this.#position;
      return ok(token.knownValueName(""));
    }

    // Check for numeric known value: '0' or '[1-9][0-9]*'
    const numericRegex = /^'(0|[1-9][0-9]*)'/;
    const remaining = this.#source.slice(this.#position);
    let match = numericRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      const numStr = match[1];
      this.#position += fullMatch.length;
      this.#tokenEnd = this.#position;

      const value = parseInt(numStr, 10);
      if (!Number.isSafeInteger(value) || value < 0) {
        return err(PE.invalidKnownValue(numStr, span(this.#tokenStart + 1, this.#tokenEnd - 1)));
      }

      return ok(token.knownValueNumber(value));
    }

    // Check for named known value: '[a-zA-Z_][a-zA-Z0-9_-]*'
    const nameRegex = /^'([a-zA-Z_][a-zA-Z0-9_-]*)'/;
    match = nameRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      const name = match[1];
      this.#position += fullMatch.length;
      this.#tokenEnd = this.#position;

      return ok(token.knownValueName(name));
    }

    // Invalid known value
    this.#position++;
    while (this.#position < this.#source.length && this.#source[this.#position] !== "'") {
      this.#position++;
    }
    if (this.#position < this.#source.length) {
      this.#position++;
    }
    this.#tokenEnd = this.#position;
    return err(PE.unrecognizedToken(this.span()));
  }

  #tryMatchUR(): ParseResult<Token> | undefined {
    // ur:type/data
    const urRegex = /^ur:([a-zA-Z0-9][a-zA-Z0-9-]*)\/([a-zA-Z]{8,})/;
    const remaining = this.#source.slice(this.#position);
    const match = urRegex.exec(remaining);

    if (match !== null) {
      const fullMatch = match[0];
      this.#position += fullMatch.length;
      this.#tokenEnd = this.#position;

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

  #tryMatchPunctuation(): ParseResult<Token> | undefined {
    const ch = this.#source[this.#position];

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
      this.#position++;
      this.#tokenEnd = this.#position;
      return ok(matched);
    }

    return undefined;
  }

  #matchLiteral(literal: string): boolean {
    if (this.#source.slice(this.#position, this.#position + literal.length) === literal) {
      this.#position += literal.length;
      return true;
    }
    return false;
  }

  #isIdentifierChar(ch: string): boolean {
    return /[a-zA-Z0-9_-]/.test(ch);
  }
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
 * Converts a base64 string to bytes.
 */
function base64ToBytes(base64: string): Uint8Array {
  // Use built-in atob for base64 decoding
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
