/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Assertion-object parser — port of
 * `bc-envelope-pattern-rust/src/parse/structure/assertion_obj_parser.rs`.
 *
 * Requires `assertobj(<pattern>)`. The bare `assertobj` keyword is a
 * syntax error in Rust; we now mirror that behaviour.
 *
 * @module envelope-pattern/parse/structure/assertion-obj-parser
 */

import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
} from "../../error";
import { type Pattern, assertionWithObject } from "../../pattern";
import type { Lexer } from "../token";
import { parseOr } from "../meta/or-parser";

export function parseAssertionObj(lexer: Lexer): Result<Pattern> {
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
  return ok(assertionWithObject(inner.value));
}
