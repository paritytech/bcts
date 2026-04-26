/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Assertion-predicate parser — port of
 * `bc-envelope-pattern-rust/src/parse/structure/assertion_pred_parser.rs`.
 *
 * Requires `assertpred(<pattern>)`. The bare `assertpred` keyword is a
 * syntax error in Rust (it errors on `UnexpectedEndOfInput` /
 * `UnexpectedToken`); we now mirror that behaviour.
 *
 * @module envelope-pattern/parse/structure/assertion-pred-parser
 */

import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
} from "../../error";
import { type Pattern, assertionWithPredicate } from "../../pattern";
import type { Lexer } from "../token";
import { parseOr } from "../meta/or-parser";

export function parseAssertionPred(lexer: Lexer): Result<Pattern> {
  const open = lexer.next();
  if (open === undefined) {
    return err(unexpectedEndOfInput());
  }
  if (open.token.type !== "ParenOpen") {
    return err(unexpectedToken(open.token, open.span));
  }
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;
  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  if (close.token.type !== "ParenClose") {
    return err(unexpectedToken(close.token, close.span));
  }
  return ok(assertionWithPredicate(inner.value));
}
