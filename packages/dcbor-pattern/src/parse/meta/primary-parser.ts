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
      try {
        const digest = Digest.fromHex(token.value);
        return Ok({
          kind: "Value",
          pattern: { type: "Digest", pattern: { variant: "Value", value: digest } },
        });
      } catch {
        return Err({
          type: "InvalidDigestPattern",
          message: `Invalid digest hex: ${token.value}`,
          span: spanned.span,
        });
      }
    case "DateQuoted":
      try {
        const date = CborDate.fromString(token.value);
        return Ok({
          kind: "Value",
          pattern: { type: "Date", pattern: { variant: "Value", value: date } },
        });
      } catch {
        return Err({
          type: "InvalidDateFormat",
          span: spanned.span,
        });
      }
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

  // Try to parse as numeric ID
  const numericValue = parseInt(value, 10);
  if (!isNaN(numericValue) && numericValue.toString() === value && numericValue >= 0) {
    const knownValue = new KnownValue(BigInt(numericValue));
    return Ok({
      kind: "Value",
      pattern: { type: "KnownValue", pattern: knownValuePatternValue(knownValue) },
    });
  }

  // Otherwise treat as name
  return Ok({
    kind: "Value",
    pattern: { type: "KnownValue", pattern: knownValuePatternNamed(value) },
  });
};
