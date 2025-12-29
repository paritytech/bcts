/**
 * Number pattern parser.
 *
 * @module parse/value/number-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { anyNumber } from "../../pattern";

/**
 * Parse a number pattern from the `number` keyword.
 */
export const parseNumber = (_lexer: Lexer): Result<Pattern> => {
  // `number` keyword was already consumed
  return Ok(anyNumber());
};
