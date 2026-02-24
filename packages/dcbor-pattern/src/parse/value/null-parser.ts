/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Null pattern parser.
 *
 * @module parse/value/null-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { nullPattern } from "../../pattern";

/**
 * Parse a null pattern from the `null` keyword.
 */
export const parseNull = (_lexer: Lexer): Result<Pattern> => {
  // `null` keyword was already consumed
  return Ok(nullPattern());
};
