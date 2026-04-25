/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Compressed parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/compressed_parser.rs`.
 *
 * @module envelope-pattern/parse/structure/compressed-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, compressed } from "../../pattern";
import type { Lexer } from "../token";

export function parseCompressed(_lexer: Lexer): Result<Pattern> {
  return ok(compressed());
}
