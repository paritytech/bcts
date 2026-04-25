/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Primary pattern parser - handles atomic patterns.
 *
 * @module parse/meta/primary-parser
 */

import { CborDate } from "@bcts/dcbor";
import { Digest } from "@bcts/components";
import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { any, anyArray, anyMap, text, textRegex, number, numberRange } from "../../pattern";
import { parseBool, parseBoolTrue, parseBoolFalse } from "../value/bool-parser";
import { parseNull } from "../value/null-parser";
import { parseNumber } from "../value/number-parser";
import { parseText } from "../value/text-parser";
import {
  parseByteString,
  parseHexStringToken,
  parseHexRegexToken,
} from "../value/bytestring-parser";
import { parseDate } from "../value/date-parser";
import { parseDigest } from "../value/digest-parser";
import { parseKnownValue } from "../value/known-value-parser";
import { parseTagged } from "../structure/tagged-parser";
import { parseBracketArray } from "../structure/array-parser";
import { parseBracketMap } from "../structure/map-parser";
import { parseCapture } from "./capture-parser";
import { parseSearch } from "./search-parser";
import { parseQuantifier } from "./repeat-parser";
import { parseOr } from "./or-parser";
import { mapPatternWithLengthInterval } from "../../pattern/structure/map-pattern";
import {
  numberPatternNaN,
  numberPatternInfinity,
  numberPatternNegInfinity,
  numberPatternGreaterThanOrEqual,
  numberPatternLessThanOrEqual,
  numberPatternGreaterThan,
  numberPatternLessThan,
} from "../../pattern/value/number-pattern";
import { KnownValue } from "@bcts/known-values";
import {
  knownValuePatternValue,
  knownValuePatternNamed,
  knownValuePatternRegex,
} from "../../pattern/value/known-value-pattern";
import {
  datePatternValue,
  datePatternRange,
  datePatternEarliest,
  datePatternLatest,
  datePatternRegex,
} from "../../pattern/value/date-pattern";
import {
  digestPatternValue,
  digestPatternPrefix,
  digestPatternBinaryRegex,
} from "../../pattern/value/digest-pattern";
import type { Span } from "../../error";

/**
 * Parse a primary pattern - the most basic unit of pattern matching.
 */
export const parsePrimary = (lexer: Lexer): Result<Pattern> => {
  const tokenResult = lexer.next();

  if (tokenResult === undefined) {
    return Err({ type: "UnexpectedEndOfInput" });
  }

  if (!tokenResult.ok) {
    return tokenResult;
  }

  const spanned = tokenResult.value;
  const token = spanned.token;

  switch (token.type) {
    // Meta patterns
    case "RepeatZeroOrMore":
      // '*' as standalone pattern means "any"
      return Ok(any());

    case "Search":
      return parseSearch(lexer);

    // Parenthesized groups
    case "ParenOpen": {
      const patternResult = parseOr(lexer);
      if (!patternResult.ok) {
        return patternResult;
      }

      const closeResult = lexer.next();
      if (closeResult === undefined) {
        return Err({ type: "ExpectedCloseParen", span: lexer.span() });
      }
      if (!closeResult.ok) {
        return closeResult;
      }
      if (closeResult.value.token.type !== "ParenClose") {
        return Err({
          type: "ExpectedCloseParen",
          span: closeResult.value.span,
        });
      }

      // After closing parenthesis, check for quantifiers
      return parseQuantifier(patternResult.value, lexer, true);
    }

    // Capture patterns (@name(...))
    case "GroupName":
      return parseCapture(lexer, token.name);

    // Value patterns
    case "Bool":
      return parseBool(lexer);
    case "BoolTrue":
      return parseBoolTrue(lexer);
    case "BoolFalse":
      return parseBoolFalse(lexer);
    case "ByteString":
      return parseByteString(lexer);
    case "Date":
      return parseDate(lexer);
    case "Digest":
      return parseDigest(lexer);
    case "DigestQuoted":
      // Mirrors Rust `parse_digest_quoted`
      // (`bc-dcbor-pattern-rust/src/parse/token.rs:317-395`):
      //
      //   1. Empty content → InvalidDigestPattern.
      //   2. `ur:digest/...` → DigestPattern.Value via Digest.fromURString.
      //   3. `/regex/`       → DigestPattern.BinaryRegex.
      //   4. Even-length hex ≤ 64 chars (= 32 bytes) → DigestPattern.Prefix.
      //   5. Anything else   → InvalidDigestPattern.
      return parseDigestQuotedContent(token.value, spanned.span);
    case "DateQuoted":
      // Mirrors Rust `parse_date_quoted`
      // (`bc-dcbor-pattern-rust/src/parse/token.rs:397-525`):
      //
      //   1. Empty content              → InvalidDateFormat.
      //   2. `/regex/`                  → DatePattern.Regex.
      //   3. `...iso`                   → DatePattern.Latest.
      //   4. `iso...`                   → DatePattern.Earliest.
      //   5. `iso1...iso2`              → DatePattern.Range.
      //   6. Single ISO-8601 date       → DatePattern.Value.
      //   7. Anything else              → InvalidDateFormat.
      return parseDateQuotedContent(token.value, spanned.span);
    case "Known":
      return parseKnownValue(lexer);
    case "Null":
      return parseNull(lexer);
    case "Number":
      return parseNumber(lexer);
    case "Text":
      return parseText(lexer);

    // Direct string literal
    case "StringLiteral":
      return Ok(text(token.value));

    // Single-quoted pattern (non-prefixed known value)
    case "SingleQuoted":
      return parseSingleQuotedAsKnownValue(token.value);

    // Direct regex literal
    case "Regex":
      try {
        const regex = new RegExp(token.pattern);
        return Ok(textRegex(regex));
      } catch {
        return Err({
          type: "InvalidRegex",
          span: spanned.span,
        });
      }

    // Direct hex string literal
    case "HexString":
      return parseHexStringToken(Ok(token.value));

    // Direct hex regex literal
    case "HexRegex":
      try {
        const regex = new RegExp(token.pattern);
        return parseHexRegexToken(Ok(regex));
      } catch {
        return Err({
          type: "InvalidRegex",
          span: spanned.span,
        });
      }

    // Structure patterns
    case "Tagged":
      return parseTagged(lexer);

    case "Array":
      return Ok(anyArray());

    case "Map":
      return Ok(anyMap());

    // Bracket syntax for arrays
    case "BracketOpen":
      return parseBracketArray(lexer);

    // Brace syntax for maps
    case "BraceOpen":
      return parseBracketMap(lexer);

    // Range tokens that represent map length constraints
    case "Range":
      return Ok({
        kind: "Structure",
        pattern: {
          type: "Map",
          pattern: mapPatternWithLengthInterval(token.quantifier.interval()),
        },
      });

    // Number literal
    case "NumberLiteral": {
      // Look ahead for range operator
      const peeked = lexer.peekToken();
      if (peeked !== undefined && peeked.ok && peeked.value.type === "Ellipsis") {
        lexer.next(); // consume the ellipsis
        const endResult = lexer.next();
        if (endResult === undefined) {
          return Err({ type: "UnexpectedEndOfInput" });
        }
        if (!endResult.ok) {
          return endResult;
        }
        if (endResult.value.token.type !== "NumberLiteral") {
          return Err({
            type: "UnexpectedToken",
            token: endResult.value.token,
            span: endResult.value.span,
          });
        }
        return Ok(numberRange(token.value, endResult.value.token.value));
      }
      return Ok(number(token.value));
    }

    case "NaN":
      return Ok({
        kind: "Value",
        pattern: { type: "Number", pattern: numberPatternNaN() },
      });

    case "Infinity":
      return Ok({
        kind: "Value",
        pattern: { type: "Number", pattern: numberPatternInfinity() },
      });

    case "NegInfinity":
      return Ok({
        kind: "Value",
        pattern: { type: "Number", pattern: numberPatternNegInfinity() },
      });

    case "GreaterThanOrEqual": {
      const numResult = lexer.next();
      if (numResult === undefined) {
        return Err({ type: "UnexpectedEndOfInput" });
      }
      if (!numResult.ok) {
        return numResult;
      }
      if (numResult.value.token.type !== "NumberLiteral") {
        return Err({
          type: "UnexpectedToken",
          token: numResult.value.token,
          span: numResult.value.span,
        });
      }
      return Ok({
        kind: "Value",
        pattern: {
          type: "Number",
          pattern: numberPatternGreaterThanOrEqual(numResult.value.token.value),
        },
      });
    }

    case "LessThanOrEqual": {
      const numResult = lexer.next();
      if (numResult === undefined) {
        return Err({ type: "UnexpectedEndOfInput" });
      }
      if (!numResult.ok) {
        return numResult;
      }
      if (numResult.value.token.type !== "NumberLiteral") {
        return Err({
          type: "UnexpectedToken",
          token: numResult.value.token,
          span: numResult.value.span,
        });
      }
      return Ok({
        kind: "Value",
        pattern: {
          type: "Number",
          pattern: numberPatternLessThanOrEqual(numResult.value.token.value),
        },
      });
    }

    case "GreaterThan": {
      const numResult = lexer.next();
      if (numResult === undefined) {
        return Err({ type: "UnexpectedEndOfInput" });
      }
      if (!numResult.ok) {
        return numResult;
      }
      if (numResult.value.token.type !== "NumberLiteral") {
        return Err({
          type: "UnexpectedToken",
          token: numResult.value.token,
          span: numResult.value.span,
        });
      }
      return Ok({
        kind: "Value",
        pattern: {
          type: "Number",
          pattern: numberPatternGreaterThan(numResult.value.token.value),
        },
      });
    }

    case "LessThan": {
      const numResult = lexer.next();
      if (numResult === undefined) {
        return Err({ type: "UnexpectedEndOfInput" });
      }
      if (!numResult.ok) {
        return numResult;
      }
      if (numResult.value.token.type !== "NumberLiteral") {
        return Err({
          type: "UnexpectedToken",
          token: numResult.value.token,
          span: numResult.value.span,
        });
      }
      return Ok({
        kind: "Value",
        pattern: {
          type: "Number",
          pattern: numberPatternLessThan(numResult.value.token.value),
        },
      });
    }

    // Unexpected tokens - these token types are not valid as primary patterns
    case "And":
    case "Or":
    case "Not":
    case "RepeatZeroOrMoreLazy":
    case "RepeatZeroOrMorePossessive":
    case "RepeatOneOrMore":
    case "RepeatOneOrMoreLazy":
    case "RepeatOneOrMorePossessive":
    case "RepeatZeroOrOne":
    case "RepeatZeroOrOneLazy":
    case "RepeatZeroOrOnePossessive":
    case "ParenClose":
    case "BracketClose":
    case "BraceClose":
    case "Comma":
    case "Colon":
    case "Ellipsis":
      return Err({
        type: "UnexpectedToken",
        token,
        span: spanned.span,
      });
  }
};

/**
 * Parse a single-quoted pattern as a known value.
 *
 * This handles the non-prefixed single-quoted syntax:
 * - 'value' -> known value by numeric ID
 * - 'name' -> known value by name
 * - '/regex/' -> known value by regex
 */
const parseSingleQuotedAsKnownValue = (value: string): Result<Pattern> => {
  // Check if it's a regex pattern (starts and ends with /)
  if (value.startsWith("/") && value.endsWith("/") && value.length > 2) {
    const regexStr = value.slice(1, -1);
    try {
      const regex = new RegExp(regexStr);
      return Ok({
        kind: "Value",
        pattern: { type: "KnownValue", pattern: knownValuePatternRegex(regex) },
      });
    } catch {
      return Err({ type: "InvalidRegex", span: { start: 0, end: value.length } });
    }
  }

  // Try to parse as numeric ID.
  //
  // Mirrors Rust's `value.parse::<u64>()` in
  // `parse_single_quoted_as_known_value`
  // (`bc-dcbor-pattern-rust/src/parse/meta/primary_parser.rs`):
  // accepts the full `0..=2^64-1` range. Earlier this port used
  // `parseInt(value, 10)` which silently truncated values above
  // `Number.MAX_SAFE_INTEGER`. We use `BigInt` and feed it directly
  // to `KnownValue`, which already accepts `bigint` natively.
  if (/^\d+$/.test(value)) {
    const numericValue = BigInt(value);
    if (numericValue <= 0xffffffffffffffffn) {
      const knownValue = new KnownValue(numericValue);
      return Ok({
        kind: "Value",
        pattern: { type: "KnownValue", pattern: knownValuePatternValue(knownValue) },
      });
    }
    // Out-of-range — fall through to the `Named` branch below, the
    // way Rust's `match value.parse::<u64>()` falls through on
    // overflow.
  }

  // Otherwise treat as name
  return Ok({
    kind: "Value",
    pattern: { type: "KnownValue", pattern: knownValuePatternNamed(value) },
  });
};

/**
 * Parse the body of a `digest'…'` literal.
 *
 * Mirrors Rust `parse_digest_quoted`
 * (`bc-dcbor-pattern-rust/src/parse/token.rs:317-395`). The Rust
 * version runs in the lexer (the token payload is already a
 * `Result<DigestPattern>`); the TS lexer keeps the raw content and
 * delegates to this helper so the parser surface stays minimal. The
 * dispatch order and error variants are identical to Rust.
 */
const parseDigestQuotedContent = (content: string, span: Span): Result<Pattern> => {
  if (content.length === 0) {
    return Err({
      type: "InvalidDigestPattern",
      message: "empty content",
      span,
    });
  }

  // (1) UR string: `ur:digest/...`.
  if (content.startsWith("ur:")) {
    try {
      const digest = Digest.fromURString(content);
      return Ok({
        kind: "Value",
        pattern: { type: "Digest", pattern: digestPatternValue(digest) },
      });
    } catch (e) {
      return Err({
        type: "InvalidUr",
        message: e instanceof Error ? e.message : String(e),
        span,
      });
    }
  }

  // (2) Binary regex: `/regex/`.
  if (content.startsWith("/") && content.endsWith("/") && content.length > 2) {
    const regexBody = content.slice(1, -1);
    try {
      const regex = new RegExp(regexBody);
      return Ok({
        kind: "Value",
        pattern: { type: "Digest", pattern: digestPatternBinaryRegex(regex) },
      });
    } catch {
      return Err({ type: "InvalidRegex", span });
    }
  }

  // (3) Hex prefix (≤ 32 bytes = 64 chars).
  if (/^[0-9a-fA-F]+$/.test(content)) {
    if (content.length % 2 !== 0) {
      return Err({ type: "InvalidHexString", span });
    }
    if (content.length > 64) {
      // Rust treats > 32 decoded bytes as `InvalidHexString`.
      return Err({ type: "InvalidHexString", span });
    }
    const bytes = new Uint8Array(content.length / 2);
    for (let i = 0; i < content.length; i += 2) {
      bytes[i / 2] = parseInt(content.slice(i, i + 2), 16);
    }
    return Ok({
      kind: "Value",
      pattern: { type: "Digest", pattern: digestPatternPrefix(bytes) },
    });
  }

  // (4) Anything else → invalid.
  return Err({
    type: "InvalidDigestPattern",
    message: content,
    span,
  });
};

/**
 * Parse the body of a `date'…'` literal.
 *
 * Mirrors Rust `parse_date_quoted`
 * (`bc-dcbor-pattern-rust/src/parse/token.rs:397-525`). Dispatch:
 *
 *   - empty content              → InvalidDateFormat.
 *   - `/regex/`                  → DatePattern.Regex.
 *   - `...iso`                   → DatePattern.Latest.
 *   - `iso...`                   → DatePattern.Earliest.
 *   - `iso1...iso2`              → DatePattern.Range.
 *   - single ISO-8601            → DatePattern.Value.
 *   - anything else              → InvalidDateFormat.
 */
const parseDateQuotedContent = (content: string, span: Span): Result<Pattern> => {
  if (content.length === 0) {
    return Err({ type: "InvalidDateFormat", span });
  }

  // (1) Regex: `/regex/`.
  if (content.startsWith("/") && content.endsWith("/") && content.length > 2) {
    const regexBody = content.slice(1, -1);
    try {
      const regex = new RegExp(regexBody);
      return Ok({
        kind: "Value",
        pattern: { type: "Date", pattern: datePatternRegex(regex) },
      });
    } catch {
      return Err({ type: "InvalidRegex", span });
    }
  }

  const tryParseDate = (s: string): CborDate | undefined => {
    try {
      return CborDate.fromString(s);
    } catch {
      return undefined;
    }
  };

  // (2)/(3)/(4) Range / Earliest / Latest patterns — anything containing `...`.
  if (content.includes("...")) {
    if (content.startsWith("...")) {
      // Latest: `...iso`.
      const isoStr = content.slice(3);
      const date = tryParseDate(isoStr);
      if (date === undefined) {
        return Err({ type: "InvalidDateFormat", span });
      }
      return Ok({
        kind: "Value",
        pattern: { type: "Date", pattern: datePatternLatest(date) },
      });
    }
    if (content.endsWith("...")) {
      // Earliest: `iso...`.
      const isoStr = content.slice(0, -3);
      const date = tryParseDate(isoStr);
      if (date === undefined) {
        return Err({ type: "InvalidDateFormat", span });
      }
      return Ok({
        kind: "Value",
        pattern: { type: "Date", pattern: datePatternEarliest(date) },
      });
    }
    // Range: `iso...iso`.
    const parts = content.split("...");
    if (parts.length !== 2) {
      return Err({ type: "InvalidDateFormat", span });
    }
    const start = tryParseDate(parts[0]);
    const end = tryParseDate(parts[1]);
    if (start === undefined || end === undefined) {
      return Err({ type: "InvalidDateFormat", span });
    }
    return Ok({
      kind: "Value",
      pattern: { type: "Date", pattern: datePatternRange(start, end) },
    });
  }

  // (5) Single ISO-8601 date.
  const date = tryParseDate(content);
  if (date === undefined) {
    return Err({ type: "InvalidDateFormat", span });
  }
  return Ok({
    kind: "Value",
    pattern: { type: "Date", pattern: datePatternValue(date) },
  });
};
