/**
 * Date pattern parser.
 *
 * @module parse/value/date-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";

// Import date pattern constructor
import { datePatternAny } from "../../pattern/value/date-pattern";

/**
 * Parse a date pattern from the `date` keyword.
 */
export const parseDate = (_lexer: Lexer): Result<Pattern> => {
  // `date` keyword was already consumed
  return Ok({
    kind: "Value",
    pattern: { type: "Date", pattern: datePatternAny() },
  });
};
