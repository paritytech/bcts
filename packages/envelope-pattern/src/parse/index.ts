/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Parser entry point
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust parse/mod.rs.
 *
 * Recursive-descent parser for the Gordian Envelope pattern syntax. The
 * parsing rules live under `parse/leaf/`, `parse/meta/`, and
 * `parse/structure/`, mirroring the Rust crate's module layout.
 *
 * @module envelope-pattern/parse
 */

import { parse as parseDcborPattern } from "@bcts/dcbor-pattern";
import {
  type Result,
  err,
  extraData,
  ok,
} from "../error";
import { type Pattern, convertDcborPatternToEnvelopePattern } from "../pattern";
import { Lexer } from "./token";
import { parseOr } from "./meta/or-parser";

// Re-export token types
export { type Token, Lexer } from "./token";

/**
 * Parse a pattern expression string into a Pattern.
 *
 * Mirrors Rust `Pattern::parse`: tries envelope-pattern parsing first;
 * on failure falls back to dcbor-pattern parsing and converts the
 * result into an envelope pattern via the
 * `dcbor_integration::convert_dcbor_pattern_to_envelope_pattern` bridge.
 */
export function parse(input: string): Result<Pattern> {
  const lexer = new Lexer(input);

  const result = parseOr(lexer);
  if (!result.ok) {
    const dcborResult = parseDcborPattern(input);
    if (dcborResult.ok) {
      return convertDcborPatternToEnvelopePattern(dcborResult.value);
    }
    return result;
  }

  const next = lexer.next();
  if (next !== undefined) {
    return err(extraData(next.span));
  }

  return result;
}

/**
 * Parse a pattern, allowing extra data after the pattern.
 *
 * Returns the parsed pattern and the byte offset at which parsing
 * stopped, mirroring `Pattern::parse_partial` in spirit.
 */
export function parsePartial(input: string): Result<[Pattern, number]> {
  const lexer = new Lexer(input);
  const result = parseOr(lexer);
  if (!result.ok) {
    return result;
  }
  return ok([result.value, lexer.position]);
}
