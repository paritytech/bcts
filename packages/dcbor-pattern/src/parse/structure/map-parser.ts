/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Map pattern parser.
 *
 * @module parse/structure/map-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { anyMap } from "../../pattern";
import {
  mapPatternWithLengthInterval,
  mapPatternWithConstraints,
} from "../../pattern/structure/map-pattern";
import { parseOrFromRegistry } from "../parse-registry";

/**
 * Parse a bracket map pattern: {pattern: pattern} or {{n}} etc.
 */
export const parseBracketMap = (lexer: Lexer): Result<Pattern> => {
  // Opening brace was already consumed
  const peeked = lexer.peekToken();

  if (peeked === undefined) {
    return Err({ type: "UnexpectedEndOfInput" });
  }

  if (!peeked.ok) {
    return peeked;
  }

  const token = peeked.value;

  // Check for closing brace (empty map - which means "any map")
  if (token.type === "BraceClose") {
    lexer.next(); // consume the closing brace
    return Ok(anyMap());
  }

  // Check for Range token (map length constraint)
  if (token.type === "Range") {
    lexer.next(); // consume the Range token
    const pattern = mapPatternWithLengthInterval(token.quantifier.interval());

    // Expect closing brace
    const closeResult = lexer.next();
    if (closeResult === undefined) {
      return Err({ type: "ExpectedCloseBrace", span: lexer.span() });
    }
    if (!closeResult.ok) {
      return closeResult;
    }
    if (closeResult.value.token.type !== "BraceClose") {
      return Err({
        type: "ExpectedCloseBrace",
        span: closeResult.value.span,
      });
    }

    return Ok({
      kind: "Structure",
      pattern: { type: "Map", pattern },
    });
  }

  // Parse as map with key-value constraints
  const constraints: [Pattern, Pattern][] = [];

  while (true) {
    // Parse key pattern
    const keyResult = parseOrFromRegistry(lexer);
    if (!keyResult.ok) {
      return keyResult;
    }

    // Expect colon
    const colonResult = lexer.next();
    if (colonResult === undefined) {
      return Err({ type: "ExpectedColon", span: lexer.span() });
    }
    if (!colonResult.ok) {
      return colonResult;
    }
    if (colonResult.value.token.type !== "Colon") {
      return Err({
        type: "ExpectedColon",
        span: colonResult.value.span,
      });
    }

    // Parse value pattern
    const valueResult = parseOrFromRegistry(lexer);
    if (!valueResult.ok) {
      return valueResult;
    }

    constraints.push([keyResult.value, valueResult.value]);

    // Check for comma or closing brace
    const nextToken = lexer.peekToken();
    if (nextToken?.ok !== true) {
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
  return Ok({
    kind: "Structure",
    pattern: { type: "Map", pattern: mapPatternWithConstraints(constraints) },
  });
};
