/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Wrapped/unwrap parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/wrapped_parser.rs`.
 *
 * @module envelope-pattern/parse/structure/wrapped-parser
 */

import { type Result, err, expectedCloseParen, ok, unexpectedToken } from "../../error";
import { type Pattern, unwrapEnvelope, unwrapMatching, wrapped } from "../../pattern";
import type { Lexer } from "../token";
import { parseOr } from "../meta/or-parser";

export function parseWrapped(_lexer: Lexer): Result<Pattern> {
  return ok(wrapped());
}

export function parseUnwrap(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(unwrapEnvelope());
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
  return ok(unwrapMatching(inner.value));
}
