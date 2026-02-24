/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Text pattern parser.
 *
 * @module parse/value/text-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { anyText, text, textRegex } from "../../pattern";

/**
 * Parse a text pattern from the `text` keyword.
 */
export const parseText = (lexer: Lexer): Result<Pattern> => {
  // `text` keyword was already consumed
  // Check if followed by a quoted value
  const peeked = lexer.peekToken();
  if (peeked?.ok === true) {
    const token = peeked.value;
    if (token.type === "SingleQuoted") {
      lexer.next(); // consume the token
      // Check if it's a regex (starts and ends with /)
      if (token.value.startsWith("/") && token.value.endsWith("/") && token.value.length > 2) {
        const regexBody = token.value.slice(1, -1);
        try {
          const regex = new RegExp(regexBody);
          return Ok(textRegex(regex));
        } catch {
          return Err({ type: "InvalidRegex", span: lexer.span() });
        }
      }
      // Otherwise it's a literal string match
      return Ok(text(token.value));
    }
    if (token.type === "StringLiteral") {
      lexer.next(); // consume the token
      return Ok(text(token.value));
    }
  }
  return Ok(anyText());
};
