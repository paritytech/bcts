/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Predicate parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/predicate_parser.rs`.
 *
 * @module envelope-pattern/parse/structure/predicate-parser
 */

import { type Result, err, expectedCloseParen, ok, unexpectedToken } from "../../error";
import { type Pattern, anyPredicate, predicate } from "../../pattern";
import type { Lexer } from "../token";
import { parseOr } from "../meta/or-parser";

export function parsePredicate(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyPredicate());
  }
  lexer.next(); // consume (
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;
  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  if (close.token.type !== "ParenClose") {
    return err(unexpectedToken(close.token, close.span));
  }
  return ok(predicate(inner.value));
}
