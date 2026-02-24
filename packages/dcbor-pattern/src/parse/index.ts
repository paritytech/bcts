/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Parsing module for dCBOR patterns.
 *
 * This module provides the parser for dCBOR pattern expressions,
 * converting string representations into Pattern AST nodes.
 *
 * @module parse
 */

export * from "./token";
export * from "./value";
export * from "./structure";
export * from "./meta";
export * from "./parse-registry";

import type { Pattern } from "../pattern";
import type { Result } from "../error";
import { Ok, Err } from "../error";
import { Lexer } from "./token";
import { parseOr } from "./meta/or-parser";
import { setParseOrFn } from "./parse-registry";

// Register the parseOr function with the parse registry
// This breaks the circular dependency between meta and structure parsers
setParseOrFn(parseOr);

/**
 * Parses a complete dCBOR pattern expression.
 *
 * @param input - The pattern string to parse
 * @returns A Result containing the parsed Pattern or an error
 *
 * @example
 * ```typescript
 * const result = parse("number");
 * if (result.ok) {
 *   console.log(result.value);
 * }
 * ```
 */
export const parse = (input: string): Result<Pattern> => {
  const result = parsePartial(input);
  if (!result.ok) {
    return result;
  }

  const [pattern, consumed] = result.value;
  if (consumed < input.length) {
    // There's extra data after the pattern
    return Err({
      type: "ExtraData",
      span: { start: consumed, end: input.length },
    });
  }

  return Ok(pattern);
};

/**
 * Parses a partial dCBOR pattern expression, returning the parsed pattern
 * and the number of characters consumed.
 *
 * Unlike `parse()`, this function succeeds even if additional characters
 * follow the first pattern. The returned index points to the first unparsed
 * character after the pattern.
 *
 * @param input - The pattern string to parse
 * @returns A Result containing a tuple of [Pattern, consumedLength] or an error
 *
 * @example
 * ```typescript
 * const result = parsePartial("true rest");
 * if (result.ok) {
 *   const [pattern, consumed] = result.value;
 *   console.log(consumed); // 4 or 5 (includes whitespace)
 * }
 * ```
 */
export const parsePartial = (input: string): Result<[Pattern, number]> => {
  if (input.trim().length === 0) {
    return Err({ type: "EmptyInput" });
  }

  const lexer = new Lexer(input);
  const patternResult = parseOr(lexer);

  if (!patternResult.ok) {
    return patternResult;
  }

  // Calculate consumed bytes
  const consumed = lexer.position();

  return Ok([patternResult.value, consumed]);
};
