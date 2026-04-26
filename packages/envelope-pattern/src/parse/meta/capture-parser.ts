/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Capture parser — port of `bc-envelope-pattern-rust`
 * `parse/meta/capture_parser.rs`.
 *
 * The `@name(...)` form requires explicit parentheses. Mirrors Rust
 * exactly:
 * ```ignore
 * @name ( expr )
 * ```
 * The previous TS port called `parse_group` (primary + quantifier), which
 * wrapped the inner expression in a redundant `GroupPattern` and accepted
 * the bare `@name p` form that Rust rejects.
 *
 * @module envelope-pattern/parse/meta/capture-parser
 */

import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
} from "../../error";
import { type Pattern, capture } from "../../pattern";
import type { Lexer } from "../token";
import { parseOr } from "./or-parser";

export function parseCapture(lexer: Lexer, name: string): Result<Pattern> {
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
  return ok(capture(name, inner.value));
}
