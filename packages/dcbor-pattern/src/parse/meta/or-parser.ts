/**
 * OR pattern parser - the top-level pattern parser.
 *
 * @module parse/meta/or-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { or } from "../../pattern";
import { parseAnd } from "./and-parser";

/**
 * Parse an OR pattern - the top-level pattern parser.
 *
 * This parser handles the OR operator (|) with left associativity.
 * It collects all patterns separated by | tokens and creates a single OR
 * pattern. If only one pattern is found, it returns that pattern directly.
 *
 * This is the entry point for the pattern parsing hierarchy:
 * OR -> AND -> NOT -> PRIMARY (atomic patterns)
 *
 * @example
 * - `bool | text` - matches values that are either boolean OR text
 * - `number | null` - matches values that are either numbers OR null
 * - `[*] | map` - matches values that are either arrays OR maps
 */
export const parseOr = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseAnd(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peek();
    if (!peeked.ok || !peeked.value || peeked.value.type !== "Or") {
      break;
    }
    lexer.next(); // consume the OR token

    const next = parseAnd(lexer);
    if (!next.ok) {
      return next;
    }
    patterns.push(next.value);
  }

  if (patterns.length === 1) {
    return Ok(patterns[0]);
  }

  return Ok(or(...patterns));
};
