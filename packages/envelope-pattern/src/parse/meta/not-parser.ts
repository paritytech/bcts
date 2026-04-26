/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Not parser — port of `bc-envelope-pattern-rust`
 * `parse/meta/not_parser.rs`.
 *
 * Mirrors Rust:
 * - On `!`, recurse into `parse_not` so chained negation parses as
 *   `not(not(x))` rather than `not(group(x))`.
 * - Otherwise descend into `parse_and`.
 *
 * @module envelope-pattern/parse/meta/not-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, notMatching } from "../../pattern";
import type { Lexer } from "../token";
import { parseAnd } from "./and-parser";

export function parseNot(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type === "Not") {
    lexer.next(); // consume !
    const inner = parseNot(lexer);
    if (!inner.ok) return inner;
    return ok(notMatching(inner.value));
  }
  return parseAnd(lexer);
}
