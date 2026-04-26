/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Or parser — port of `bc-envelope-pattern-rust` `parse/meta/or_parser.rs`.
 *
 * @module envelope-pattern/parse/meta/or-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, or } from "../../pattern";
import type { Lexer } from "../token";
import { parseTraverse } from "./traverse-parser";

export function parseOr(lexer: Lexer): Result<Pattern> {
  const patterns: Pattern[] = [];
  const first = parseTraverse(lexer);
  if (!first.ok) return first;
  patterns.push(first.value);

  while (true) {
    const next = lexer.peekToken();
    if (next?.token.type !== "Or") {
      break;
    }
    lexer.next(); // consume |
    const nextExpr = parseTraverse(lexer);
    if (!nextExpr.ok) return nextExpr;
    patterns.push(nextExpr.value);
  }

  if (patterns.length === 1) {
    return ok(patterns[0]);
  }
  return ok(or(patterns));
}
