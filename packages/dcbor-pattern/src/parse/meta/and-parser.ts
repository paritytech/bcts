/**
 * AND pattern parser.
 *
 * @module parse/meta/and-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { and } from "../../pattern";
import { parseNot } from "./not-parser";

/**
 * Parse an AND pattern.
 *
 * This parser handles the AND operator (&) with left associativity.
 * It collects all patterns separated by & tokens and creates a single AND
 * pattern. If only one pattern is found, it returns that pattern directly.
 *
 * @example
 * - `bool & text` - matches values that are both boolean AND text (impossible)
 * - `number & (>= 0)` - matches numbers that are also >= 0
 */
export const parseAnd = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseNot(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peek();
    if (!peeked.ok || !peeked.value || peeked.value.type !== "And") {
      break;
    }
    lexer.next(); // consume the AND token

    const next = parseNot(lexer);
    if (!next.ok) {
      return next;
    }
    patterns.push(next.value);
  }

  if (patterns.length === 1) {
    return Ok(patterns[0]);
  }

  return Ok(and(...patterns));
};
