/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Tagged pattern parser.
 *
 * Supports the following syntax:
 * - `tagged` - matches any tagged value
 * - `tagged(value, pattern)` - matches tagged value with specific u64 tag and content pattern
 * - `tagged(name, pattern)` - matches tagged value with named tag and content pattern
 * - `tagged(/regex/, pattern)` - matches tagged value with tag name matching regex and content pattern
 *
 * @module parse/structure/tagged-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { anyTagged } from "../../pattern";
import { createTag } from "@bcts/dcbor";
import {
  taggedPatternWithTag,
  taggedPatternWithName,
  taggedPatternWithRegex,
} from "../../pattern/structure/tagged-pattern";
import { parse } from "../index";

/**
 * Tag selector discriminated union.
 */
type TagSelector =
  | { type: "Value"; value: number }
  | { type: "Name"; name: string }
  | { type: "Regex"; regex: RegExp };

/**
 * Parse a tagged pattern from the `tagged` keyword.
 *
 * Supports:
 * - `tagged` - matches any tagged value
 * - `tagged(value, pattern)` - matches tagged value with specific tag number
 * - `tagged(name, pattern)` - matches tagged value with named tag
 * - `tagged(/regex/, pattern)` - matches tagged value with tag name matching regex
 */
export const parseTagged = (lexer: Lexer): Result<Pattern> => {
  // Check if followed by opening parenthesis
  const peeked = lexer.peekToken();

  if (peeked === undefined || !peeked.ok || peeked.value.type !== "ParenOpen") {
    // No parentheses, just "tagged" - matches any tagged value
    return Ok(anyTagged());
  }

  // Consume the opening parenthesis
  lexer.next();

  // Get the remainder of the input for manual parsing
  const remainder = lexer.remainder();
  const remainderStart = lexer.position();

  // Parse the tag selector and content pattern
  const innerResult = parseTaggedInner(remainder, remainderStart);
  if (!innerResult.ok) {
    return innerResult;
  }

  const [tagSelector, contentPattern, consumed] = innerResult.value;

  // Advance the lexer by the consumed amount
  lexer.bump(consumed);

  // Expect closing parenthesis
  const closeResult = lexer.next();
  if (closeResult === undefined) {
    return Err({ type: "ExpectedCloseParen", span: lexer.span() });
  }
  if (!closeResult.ok) {
    return closeResult;
  }
  if (closeResult.value.token.type !== "ParenClose") {
    return Err({
      type: "ExpectedCloseParen",
      span: closeResult.value.span,
    });
  }

  // Create the pattern based on tag selector type
  let taggedPattern;
  switch (tagSelector.type) {
    case "Value": {
      const tag = createTag(BigInt(tagSelector.value));
      taggedPattern = taggedPatternWithTag(tag, contentPattern);
      break;
    }
    case "Name":
      taggedPattern = taggedPatternWithName(tagSelector.name, contentPattern);
      break;
    case "Regex":
      taggedPattern = taggedPatternWithRegex(tagSelector.regex, contentPattern);
      break;
  }

  return Ok({
    kind: "Structure",
    pattern: { type: "Tagged", pattern: taggedPattern },
  });
};

/**
 * Parse the inner content of tagged(selector, pattern).
 * Returns [TagSelector, Pattern, consumed_bytes].
 */
const parseTaggedInner = (
  src: string,
  remainderStart: number,
): Result<[TagSelector, Pattern, number]> => {
  let pos = 0;
  skipWhitespace(src, (p) => (pos = p), pos);

  // Parse the tag selector (first parameter)
  let tagSelector: TagSelector;

  if (src[pos] === "/") {
    // Regex pattern
    const regexResult = parseTextRegex(src, pos);
    if (!regexResult.ok) {
      return regexResult;
    }
    const [regex, newPos] = regexResult.value;
    pos = newPos;
    tagSelector = { type: "Regex", regex };
  } else {
    // Could be a number or a name
    const wordResult = parseBareWord(src, pos);
    if (!wordResult.ok) {
      return wordResult;
    }
    const [word, newPos] = wordResult.value;
    pos = newPos;

    const numValue = parseInt(word, 10);
    if (!isNaN(numValue) && numValue.toString() === word) {
      tagSelector = { type: "Value", value: numValue };
    } else {
      tagSelector = { type: "Name", name: word };
    }
  }

  // Expect comma
  skipWhitespace(src, (p) => (pos = p), pos);
  if (pos >= src.length || src[pos] !== ",") {
    return Err({ type: "UnexpectedEndOfInput" });
  }
  pos += 1;
  skipWhitespace(src, (p) => (pos = p), pos);

  // Parse the content pattern (second parameter)
  // Handle nested parentheses to find the end of the pattern
  const patternStart = pos;
  let parenDepth = 0;
  while (pos < src.length) {
    const ch = src[pos];
    if (ch === "(") {
      parenDepth += 1;
    } else if (ch === ")") {
      if (parenDepth === 0) {
        break; // This is the closing paren for our tagged()
      }
      parenDepth -= 1;
    }
    pos += 1;
  }

  const patternSrc = src.slice(patternStart, pos);
  const trimmedPattern = patternSrc.trim();
  const trimOffset = patternSrc.length - patternSrc.trimStart().length;

  const contentResult = parse(trimmedPattern);
  if (!contentResult.ok) {
    // Adjust error spans to be relative to the original input
    const error = contentResult.error;
    if ("span" in error) {
      const offset = remainderStart + patternStart + trimOffset;
      const adjustedSpan = {
        start: error.span.start + offset,
        end: error.span.end + offset,
      };
      // Create a new error with the adjusted span
      return Err({ ...error, span: adjustedSpan } as typeof error);
    }
    return contentResult;
  }

  return Ok([tagSelector, contentResult.value, pos]);
};

/**
 * Parse a regex from the input string starting with /
 */
const parseTextRegex = (src: string, startPos: number): Result<[RegExp, number]> => {
  let pos = startPos;
  skipWhitespace(src, (p) => (pos = p), pos);

  if (pos >= src.length || src[pos] !== "/") {
    return Err({ type: "UnterminatedRegex", span: { start: pos, end: pos } });
  }
  pos += 1;
  const start = pos;
  let escape = false;

  while (pos < src.length) {
    const ch = src[pos];
    pos += 1;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === "/") {
      const inner = src.slice(start, pos - 1);
      try {
        const regex = new RegExp(inner);
        skipWhitespace(src, (p) => (pos = p), pos);
        return Ok([regex, pos]);
      } catch {
        return Err({ type: "InvalidRegex", span: { start, end: pos } });
      }
    }
  }

  return Err({ type: "UnterminatedRegex", span: { start: pos, end: pos } });
};

/**
 * Parse a bare word (alphanumeric with hyphens and underscores).
 */
const parseBareWord = (src: string, startPos: number): Result<[string, number]> => {
  let pos = startPos;
  skipWhitespace(src, (p) => (pos = p), pos);

  const start = pos;
  while (pos < src.length) {
    const ch = src[pos];
    if (" \t\n\r\f,)".includes(ch)) {
      break;
    }
    pos += 1;
  }

  if (start === pos) {
    return Err({ type: "UnexpectedEndOfInput" });
  }

  const word = src.slice(start, pos);
  skipWhitespace(src, (p) => (pos = p), pos);

  return Ok([word, pos]);
};

/**
 * Skip whitespace characters.
 */
const skipWhitespace = (src: string, setPos: (p: number) => void, pos: number): void => {
  while (pos < src.length && " \t\n\r\f".includes(src[pos])) {
    pos += 1;
  }
  setPos(pos);
};
