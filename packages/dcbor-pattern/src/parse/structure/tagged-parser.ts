/**
 * Tagged pattern parser.
 *
 * @module parse/structure/tagged-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { anyTagged } from "../../pattern";

/**
 * Parse a tagged pattern from the `tagged` keyword.
 */
export const parseTagged = (_lexer: Lexer): Result<Pattern> => {
  // `tagged` keyword was already consumed
  return Ok(anyTagged());
};
