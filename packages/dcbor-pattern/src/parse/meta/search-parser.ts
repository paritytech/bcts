/**
 * Search pattern parser.
 *
 * @module parse/meta/search-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { search } from "../../pattern";
import { parseOr } from "./or-parser";

/**
 * Parse a search pattern `...(pattern)`.
 *
 * This function is called when a Search token (`...`) is encountered.
 * It expects an opening parenthesis, followed by a pattern, followed by
 * a closing parenthesis.
 */
export const parseSearch = (lexer: Lexer): Result<Pattern> => {
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

  return Ok(search(innerResult.value));
};
