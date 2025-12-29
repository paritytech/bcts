/**
 * KnownValue pattern parser.
 *
 * @module parse/value/known-value-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";

// Import known value pattern constructor
import { knownValuePatternAny } from "../../pattern/value/known-value-pattern";

/**
 * Parse a known value pattern from the `known` keyword.
 */
export const parseKnownValue = (_lexer: Lexer): Result<Pattern> => {
  // `known` keyword was already consumed
  return Ok({
    kind: "Value",
    pattern: { type: "KnownValue", pattern: knownValuePatternAny() },
  });
};
