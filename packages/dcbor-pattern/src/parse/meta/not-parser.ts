/**
 * NOT pattern parser.
 *
 * @module parse/meta/not-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { not } from "../../pattern";
import { parsePrimary } from "./primary-parser";

/**
 * Parse a NOT pattern or delegate to primary parser.
 *
 * This parser handles the NOT operator (!) with right associativity.
 * If no NOT token is found, it delegates to the primary parser.
 *
 * @example
 * - `!bool` - matches anything that is not a boolean
 * - `!!text` - matches anything that is not (not text), i.e., matches text
 * - `![*]` - matches anything that is not an array
 */
export const parseNot = (lexer: Lexer): Result<Pattern> => {
  const peeked = lexer.peek();
  if (peeked.ok && peeked.value?.type === "Not") {
    lexer.next(); // consume the NOT token
    const inner = parseNot(lexer); // right associative recursion
    if (!inner.ok) {
      return inner;
    }
    return Ok(not(inner.value));
  }
  return parsePrimary(lexer);
};
