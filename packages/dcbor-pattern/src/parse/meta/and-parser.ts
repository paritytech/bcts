/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
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
 */
export const parseAnd = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseNot(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peekToken();
    if (peeked?.ok !== true) {
      break;
    }
    if (peeked.value.type !== "And") {
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
