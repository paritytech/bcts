/**
 * Map pattern parser.
 *
 * @module parse/structure/map-parser
 */

import type { Lexer, Token, TokenResult } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { anyMap } from "../../pattern";
import { mapPatternWithLengthInterval } from "../../pattern/structure/map-pattern";
import { parseOr } from "../meta/or-parser";

/**
 * Parse a bracket map pattern: {pattern: pattern} or {{n}} etc.
 */
export const parseBracketMap = (lexer: Lexer): Result<Pattern> => {
  // Opening brace was already consumed
  // Peek at the next token to determine what we're parsing
  const peeked = lexer.peek();

  if (!peeked.ok) {
    return Err({ type: "UnexpectedEndOfInput" });
  }

  const token = peeked.value;

  // Check for closing brace (empty map - which means "any map")
  if (token?.type === "BraceClose") {
    lexer.next(); // consume the closing brace
    return Ok(anyMap());
  }

  // Check for Range token (map length constraint)
  if (token?.type === "Range" && token.value.ok) {
    lexer.next(); // consume the Range token
    const quantifier = token.value.value;
    const pattern = mapPatternWithLengthInterval(quantifier.interval());

    // Expect closing brace
    const next = lexer.next();
    if (!next.ok || next.value?.type !== "BraceClose") {
      return Err({
        type: "ExpectedCloseBrace",
        span: lexer.span(),
      });
    }

    return Ok({
      kind: "Structure",
      pattern: { type: "Map", pattern },
    });
  }

  // Parse as map with key-value constraints
  const constraints: Array<[Pattern, Pattern]> = [];

  while (true) {
    // Parse key pattern
    const keyResult = parseOr(lexer);
    if (!keyResult.ok) {
      return keyResult;
    }

    // Expect colon
    const colonResult = lexer.next();
    if (!colonResult.ok || colonResult.value?.type !== "Colon") {
      return Err({
        type: "ExpectedColon",
        span: lexer.span(),
      });
    }

    // Parse value pattern
    const valueResult = parseOr(lexer);
    if (!valueResult.ok) {
      return valueResult;
    }

    constraints.push([keyResult.value, valueResult.value]);

    // Check for comma or closing brace
    const nextToken = lexer.peek();
    if (!nextToken.ok || !nextToken.value) {
      return Err({ type: "UnexpectedEndOfInput" });
    }

    if (nextToken.value.type === "BraceClose") {
      lexer.next(); // consume the closing brace
      break;
    }

    if (nextToken.value.type === "Comma") {
      lexer.next(); // consume the comma
      continue;
    }

    return Err({
      type: "UnexpectedToken",
      token: nextToken.value,
      span: lexer.span(),
    });
  }

  // Create map pattern with constraints
  const { mapPatternWithConstraints } = require("../../pattern/structure/map-pattern");
  return Ok({
    kind: "Structure",
    pattern: { type: "Map", pattern: mapPatternWithConstraints(constraints) },
  });
};
