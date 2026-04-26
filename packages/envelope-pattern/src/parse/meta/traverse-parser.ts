/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Traverse parser — port of `bc-envelope-pattern-rust`
 * `parse/meta/traverse_parser.rs`.
 *
 * Note the precedence chain: `parse_or → parse_traverse → parse_not →
 * parse_and → parse_primary`. The earlier TS port had `parse_traverse`
 * call `parse_and` directly, which pushed `!` below `&` and
 * miscompiled `!a & b`.
 *
 * @module envelope-pattern/parse/meta/traverse-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, traverse } from "../../pattern";
import type { Lexer } from "../token";
import { parseNot } from "./not-parser";

export function parseTraverse(lexer: Lexer): Result<Pattern> {
  const patterns: Pattern[] = [];
  const first = parseNot(lexer);
  if (!first.ok) return first;
  patterns.push(first.value);

  while (true) {
    const next = lexer.peekToken();
    if (next?.token.type !== "Traverse") {
      break;
    }
    lexer.next(); // consume ->
    const nextExpr = parseNot(lexer);
    if (!nextExpr.ok) return nextExpr;
    patterns.push(nextExpr.value);
  }

  if (patterns.length === 1) {
    return ok(patterns[0]);
  }
  return ok(traverse(patterns));
}
