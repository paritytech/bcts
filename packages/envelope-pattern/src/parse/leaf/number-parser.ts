/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Number parsers — port of `bc-envelope-pattern-rust` `parse/leaf/number_parser.rs`.
 *
 * @module envelope-pattern/parse/leaf/number-parser
 */

import { type Result, err, ok, unexpectedEndOfInput, unexpectedToken } from "../../error";
import {
  type Pattern,
  NumberPattern,
  number,
  numberRange,
  numberGreaterThan,
  numberLessThan,
  patternLeaf,
  leafNumber,
} from "../../pattern";
import type { Lexer } from "../token";

/**
 * Parses an optional `...end` suffix following an already-consumed number,
 * mirroring Rust `parse_number_range_or_comparison`.
 */
export function parseNumberRangeOrComparison(lexer: Lexer, firstValue: number): Result<Pattern> {
  const next = lexer.peekToken();
  if (next === undefined) {
    return ok(number(firstValue));
  }

  if (next.token.type === "Ellipsis") {
    lexer.next(); // consume ...
    const endToken = lexer.next();
    if (endToken === undefined) {
      return err(unexpectedEndOfInput());
    }

    let endValue: number;
    if (
      endToken.token.type === "UnsignedInteger" ||
      endToken.token.type === "Integer" ||
      endToken.token.type === "Float"
    ) {
      if (!endToken.token.value.ok) return err(endToken.token.value.error);
      endValue = endToken.token.value.value;
    } else {
      return err(unexpectedToken(endToken.token, endToken.span));
    }

    return ok(numberRange(firstValue, endValue));
  }

  return ok(number(firstValue));
}

/**
 * Parses a number following a comparison operator, mirroring Rust
 * `parse_comparison_number`.
 */
export function parseComparisonNumber(lexer: Lexer, op: ">=" | "<=" | ">" | "<"): Result<Pattern> {
  const numToken = lexer.next();
  if (numToken === undefined) {
    return err(unexpectedEndOfInput());
  }

  let value: number;
  if (
    numToken.token.type === "UnsignedInteger" ||
    numToken.token.type === "Integer" ||
    numToken.token.type === "Float"
  ) {
    if (!numToken.token.value.ok) return err(numToken.token.value.error);
    value = numToken.token.value.value;
  } else {
    return err(unexpectedToken(numToken.token, numToken.span));
  }

  switch (op) {
    case ">=":
      return ok(patternLeaf(leafNumber(NumberPattern.greaterThanOrEqual(value))));
    case "<=":
      return ok(patternLeaf(leafNumber(NumberPattern.lessThanOrEqual(value))));
    case ">":
      return ok(numberGreaterThan(value));
    case "<":
      return ok(numberLessThan(value));
  }
}
