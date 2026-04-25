/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Elided parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/elided_parser.rs`.
 *
 * @module envelope-pattern/parse/structure/elided-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, elided } from "../../pattern";
import type { Lexer } from "../token";

export function parseElided(_lexer: Lexer): Result<Pattern> {
  return ok(elided());
}
