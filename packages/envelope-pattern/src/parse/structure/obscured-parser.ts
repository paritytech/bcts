/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Obscured parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/obscured_parser.rs`.
 *
 * @module envelope-pattern/parse/structure/obscured-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, obscured } from "../../pattern";
import type { Lexer } from "../token";

export function parseObscured(_lexer: Lexer): Result<Pattern> {
  return ok(obscured());
}
