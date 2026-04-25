/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * CBOR pattern parser — port of `bc-envelope-pattern-rust`
 * `parse/leaf/cbor_parser.rs`.
 *
 * Mirrors Rust's flow: lookahead for `(`. If absent, return `any_cbor()`.
 * Otherwise consume the `(`, delegate to `parseCborInner` (handles
 * `/regex/`, `ur:…`, and CBOR diagnostic notation), and expect a closing
 * `)`.
 *
 * @module envelope-pattern/parse/leaf/cbor-parser
 */

import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedToken,
} from "../../error";
import { type Pattern, anyCbor } from "../../pattern";
import type { Lexer } from "../token";
import { parseCborInner } from "../utils";

export function parseCbor(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyCbor());
  }

  lexer.next(); // consume (

  const remainder = lexer.remainder();
  const innerResult = parseCborInner(remainder);
  if (!innerResult.ok) return innerResult;
  const [pattern, consumed] = innerResult.value;
  lexer.bump(consumed);

  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  if (close.token.type !== "ParenClose") {
    return err(unexpectedToken(close.token, close.span));
  }
  return ok(pattern);
}
