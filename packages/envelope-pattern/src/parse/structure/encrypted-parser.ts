/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Encrypted parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/encrypted_parser.rs`.
 *
 * @module envelope-pattern/parse/structure/encrypted-parser
 */

import { type Result, ok } from "../../error";
import { type Pattern, encrypted } from "../../pattern";
import type { Lexer } from "../token";

export function parseEncrypted(_lexer: Lexer): Result<Pattern> {
  return ok(encrypted());
}
