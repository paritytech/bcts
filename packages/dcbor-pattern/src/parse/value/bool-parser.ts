/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Bool pattern parser.
 *
 * @module parse/value/bool-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { anyBool, bool } from "../../pattern";

/**
 * Parse a boolean pattern from the `bool` keyword.
 */
export const parseBool = (_lexer: Lexer): Result<Pattern> => {
  // `bool` keyword was already consumed, just return the pattern
  return Ok(anyBool());
};

/**
 * Parse a `true` literal.
 */
export const parseBoolTrue = (_lexer: Lexer): Result<Pattern> => {
  return Ok(bool(true));
};

/**
 * Parse a `false` literal.
 */
export const parseBoolFalse = (_lexer: Lexer): Result<Pattern> => {
  return Ok(bool(false));
};
