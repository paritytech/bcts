/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Null parser — port of `bc-envelope-pattern-rust` `parse/leaf/null_parser.rs`.
 *
 * @module envelope-pattern/parse/leaf/null-parser
 */

import { ok, type Result } from "../../error";
import { type Pattern, nullPattern } from "../../pattern";
import type { Lexer } from "../token";

export function parseNull(_lexer: Lexer): Result<Pattern> {
  return ok(nullPattern());
}
