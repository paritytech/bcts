/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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
 */
export const parseCapture = (lexer: Lexer, name: string): Result<Pattern> => {
  // Expect opening parenthesis
  const openResult = lexer.next();
  if (openResult === undefined) {
    return Err({ type: "UnexpectedEndOfInput" });
  }
  if (!openResult.ok) {
    return openResult;
  }
  if (openResult.value.token.type !== "ParenOpen") {
    return Err({
      type: "UnexpectedToken",
      token: openResult.value.token,
      span: openResult.value.span,
    });
  }

  // Parse the inner pattern
  const innerResult = parseOr(lexer);
  if (!innerResult.ok) {
    return innerResult;
  }

  // Expect closing parenthesis
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

  return Ok(capture(name, innerResult.value));
};
