/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
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
 */
export const parseOr = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseAnd(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peekToken();
    if (peeked?.ok !== true) {
      break;
    }
    if (peeked.value.type !== "Or") {
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
