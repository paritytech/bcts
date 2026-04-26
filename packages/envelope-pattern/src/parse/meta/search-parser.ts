/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Search parser — port of `bc-envelope-pattern-rust`
 * `parse/meta/search_parser.rs`.
 *
 * @module envelope-pattern/parse/meta/search-parser
 */

import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
} from "../../error";
import { type Pattern, search } from "../../pattern";
import type { Lexer } from "../token";
import { parseOr } from "./or-parser";

export function parseSearch(lexer: Lexer): Result<Pattern> {
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
  return ok(search(inner.value));
}
