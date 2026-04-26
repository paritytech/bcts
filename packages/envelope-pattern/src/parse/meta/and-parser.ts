/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * And parser — port of `bc-envelope-pattern-rust`
 * `parse/meta/and_parser.rs`.
 *
 * Mirrors Rust: `parse_and` calls `parse_primary` (NOT `parse_not`); `!`
 * is handled at a higher precedence level by `parse_not`.
 *
 * @module envelope-pattern/parse/meta/and-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, and } from "../../pattern";
import type { Lexer } from "../token";
import { parsePrimary } from "./primary-parser";

export function parseAnd(lexer: Lexer): Result<Pattern> {
  const patterns: Pattern[] = [];
  const first = parsePrimary(lexer);
  if (!first.ok) return first;
  patterns.push(first.value);

  while (true) {
    const next = lexer.peekToken();
    if (next?.token.type !== "And") {
      break;
    }
    lexer.next(); // consume &
    const nextExpr = parsePrimary(lexer);
    if (!nextExpr.ok) return nextExpr;
    patterns.push(nextExpr.value);
  }

  if (patterns.length === 1) {
    return ok(patterns[0]);
  }
  return ok(and(patterns));
}
