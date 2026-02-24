/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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
 */
export const parseNot = (lexer: Lexer): Result<Pattern> => {
  const peeked = lexer.peekToken();
  if (peeked !== undefined && peeked.ok && peeked.value.type === "Not") {
    lexer.next(); // consume the NOT token
    const inner = parseNot(lexer); // right associative recursion
    if (!inner.ok) {
      return inner;
    }
    return Ok(not(inner.value));
  }
  return parsePrimary(lexer);
};
