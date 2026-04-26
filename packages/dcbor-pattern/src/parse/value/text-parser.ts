/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Text pattern parser.
 *
 * @module parse/value/text-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { anyText } from "../../pattern";

/**
 * Parse a text pattern from the `text` keyword.
 *
 * Mirrors Rust `parse_text`
 * (`bc-dcbor-pattern-rust/src/parse/value/text_parser.rs`):
 *
 * ```rust
 * pub(crate) fn parse_text(_lexer: &mut logos::Lexer<Token>) -> Result<Pattern> {
 *     Ok(Pattern::any_text())
 * }
 * ```
 *
 * The `text` keyword always means "match any text"; literal strings
 * and regexes are parsed as standalone primaries (`StringLiteral` /
 * `SingleQuoted` tokens that hit `parse_primary` directly). Earlier
 * revisions of this port consumed a following `SingleQuoted` /
 * `StringLiteral` token here, which silently accepted patterns Rust
 * rejects (e.g. `text "foo"` would be parsed as `text("foo")` in TS
 * but raise `ExtraData` in Rust).
 */
export const parseText = (_lexer: Lexer): Result<Pattern> => {
  // `text` keyword was already consumed by the caller. Return
  // `any_text` unconditionally — match Rust line-for-line.
  return Ok(anyText());
};
