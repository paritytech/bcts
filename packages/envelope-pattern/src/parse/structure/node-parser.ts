/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Node parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/node_parser.rs`.
 *
 * Mirrors Rust:
 * - Bare `node` → `any_node()`.
 * - `node({n})` / `node({n,m})` / `node({n,})` → `node_with_assertions_range`.
 * - Anything else inside the parens (e.g. `node(text)`) is a syntax error
 *   in Rust; the previous TS port silently produced an always-matching
 *   `WithSubject` node, which we have removed.
 *
 * @module envelope-pattern/parse/structure/node-parser
 */

import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
} from "../../error";
import { type Pattern, NodePattern, anyNode, patternStructure, structureNode } from "../../pattern";
import type { Lexer } from "../token";

export function parseNode(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyNode());
  }
  lexer.next(); // consume (

  const inner = lexer.next();
  if (inner === undefined) {
    return err(unexpectedEndOfInput());
  }
  if (inner.token.type !== "Range") {
    return err(unexpectedToken(inner.token, inner.span));
  }
  if (!inner.token.value.ok) return err(inner.token.value.error);
  const interval = inner.token.value.value.interval();

  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  if (close.token.type !== "ParenClose") {
    return err(unexpectedToken(close.token, close.span));
  }
  return ok(patternStructure(structureNode(NodePattern.fromInterval(interval))));
}
