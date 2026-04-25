/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Array parser — port of `bc-envelope-pattern-rust`
 * `parse/leaf/array_parser.rs`.
 *
 * Mirrors Rust's flow exactly: after the `[` token has been consumed,
 * delegate to `utils::parseArrayInner` (which handles `*`, `{n}`, `{n,m}`,
 * `{n,}` directly and otherwise wraps the body in `[...]` and re-parses
 * via dcbor-pattern), then expect a closing `]`.
 *
 * @module envelope-pattern/parse/leaf/array-parser
 */

import {
  type Result,
  err,
  expectedCloseBracket,
  ok,
  unexpectedToken,
} from "../../error";
import type { Pattern } from "../../pattern";
import type { Lexer } from "../token";
import { parseArrayInner } from "../utils";

export function parseArray(lexer: Lexer): Result<Pattern> {
  const remainder = lexer.remainder();
  const inner = parseArrayInner(remainder);
  if (!inner.ok) return inner;
  const [pattern, consumed] = inner.value;
  lexer.bump(consumed);

  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseBracket(lexer.span()));
  }
  if (close.token.type !== "BracketClose") {
    return err(unexpectedToken(close.token, close.span));
  }
  return ok(pattern);
}
