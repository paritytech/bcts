/**
 * Capture pattern parser.
 *
 * @module parse/meta/capture-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { capture } from "../../pattern";
import { parseOr } from "./or-parser";

/**
 * Parse a capture pattern of the form `@name(pattern)`.
 *
 * This function is called when a `GroupName` token is encountered.
 * It expects the next token to be an opening parenthesis, followed by a
 * pattern, followed by a closing parenthesis.
 *
 * @example
 * - `@count(number)` - captures any number with the name "count"
 * - `@name(text)` - captures any text with the name "name"
 * - `@item([*] | map)` - captures any array or map with the name "item"
 */
export const parseCapture = (lexer: Lexer, name: string): Result<Pattern> => {
  // Expect opening parenthesis
  const openResult = lexer.next();
  if (!openResult.ok || openResult.value?.type !== "ParenOpen") {
    return Err({
      type: "UnexpectedToken",
      token: openResult.ok ? openResult.value : undefined,
      span: lexer.span(),
    });
  }

  // Parse the inner pattern
  const innerResult = parseOr(lexer);
  if (!innerResult.ok) {
    return innerResult;
  }

  // Expect closing parenthesis
  const closeResult = lexer.next();
  if (!closeResult.ok || closeResult.value?.type !== "ParenClose") {
    return Err({
      type: "ExpectedCloseParen",
      span: lexer.span(),
    });
  }

  return Ok(capture(name, innerResult.value));
};
