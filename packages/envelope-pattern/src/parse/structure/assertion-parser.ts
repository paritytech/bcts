/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Assertion parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/assertion_parser.rs`.
 *
 * Note: Rust's `parse_assertion` ignores its lexer entirely and always
 * returns `Pattern::any_assertion()`. There is intentionally **no**
 * `assert(pred, obj)` syntax — predicate/object filters are written via
 * the dedicated `assertpred(...)` / `assertobj(...)` keywords.
 *
 * @module envelope-pattern/parse/structure/assertion-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, anyAssertion } from "../../pattern";
import type { Lexer } from "../token";

export function parseAssertion(_lexer: Lexer): Result<Pattern> {
  return ok(anyAssertion());
}
