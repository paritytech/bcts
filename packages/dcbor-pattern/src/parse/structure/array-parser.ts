/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Array pattern parser.
 *
 * @module parse/structure/array-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { sequence, or, and, not } from "../../pattern";
import {
  arrayPatternWithLengthInterval,
  arrayPatternWithElements,
} from "../../pattern/structure/array-pattern";
import { Interval } from "../../interval";
import { parseOrFromRegistry } from "../parse-registry";

/**
 * Parse a bracket array pattern: [pattern] or [{n}] etc.
 */
export const parseBracketArray = (lexer: Lexer): Result<Pattern> => {
  // Opening bracket was already consumed
  const peeked = lexer.peekToken();

  if (peeked === undefined) {
    return Err({ type: "UnexpectedEndOfInput" });
  }

  if (!peeked.ok) {
    return peeked;
  }

  const token = peeked.value;

  // Check for Range token (array length constraint like [{3}] or [{1,5}])
  if (token.type === "Range") {
    lexer.next(); // consume the Range token
    const pattern = arrayPatternWithLengthInterval(token.quantifier.interval());

    // Expect closing bracket
    const closeResult = lexer.next();
    if (closeResult === undefined) {
      return Err({ type: "ExpectedCloseBracket", span: lexer.span() });
    }
    if (!closeResult.ok) {
      return closeResult;
    }
    if (closeResult.value.token.type !== "BracketClose") {
      return Err({
        type: "ExpectedCloseBracket",
        span: closeResult.value.span,
      });
    }

    return Ok({
      kind: "Structure",
      pattern: { type: "Array", pattern },
    });
  }

  // Check for closing bracket (empty array pattern [] - matches array with 0 elements)
  if (token.type === "BracketClose") {
    lexer.next(); // consume the closing bracket
    return Ok({
      kind: "Structure",
      pattern: { type: "Array", pattern: arrayPatternWithLengthInterval(Interval.exactly(0)) },
    });
  }

  // Parse as array with element pattern(s)
  const elementPattern = parseArrayOr(lexer);
  if (!elementPattern.ok) {
    return elementPattern;
  }

  const pattern = arrayPatternWithElements(elementPattern.value);

  // Expect closing bracket
  const closeResult = lexer.next();
  if (closeResult === undefined) {
    return Err({ type: "ExpectedCloseBracket", span: lexer.span() });
  }
  if (!closeResult.ok) {
    return closeResult;
  }
  if (closeResult.value.token.type !== "BracketClose") {
    return Err({
      type: "ExpectedCloseBracket",
      span: closeResult.value.span,
    });
  }

  return Ok({
    kind: "Structure",
    pattern: { type: "Array", pattern },
  });
};

/**
 * Parse OR patterns within array context.
 */
const parseArrayOr = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseArrayAnd(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peekToken();
    if (peeked === undefined || !peeked.ok || peeked.value.type !== "Or") {
      break;
    }
    lexer.next(); // consume the OR token

    const next = parseArrayAnd(lexer);
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

/**
 * Parse AND patterns within array context.
 */
const parseArrayAnd = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseArrayNot(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peekToken();
    if (peeked === undefined || !peeked.ok || peeked.value.type !== "And") {
      break;
    }
    lexer.next(); // consume the AND token

    const next = parseArrayNot(lexer);
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

/**
 * Parse NOT patterns within array context.
 */
const parseArrayNot = (lexer: Lexer): Result<Pattern> => {
  const peeked = lexer.peekToken();
  if (peeked !== undefined && peeked.ok && peeked.value.type === "Not") {
    lexer.next(); // consume the NOT token
    const inner = parseArrayNot(lexer); // right associative
    if (!inner.ok) {
      return inner;
    }
    return Ok(not(inner.value));
  }
  return parseArraySequence(lexer);
};

/**
 * Parse sequence patterns within array context (comma-separated).
 */
const parseArraySequence = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseOrFromRegistry(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peekToken();
    if (peeked === undefined || !peeked.ok || peeked.value.type !== "Comma") {
      break;
    }
    lexer.next(); // consume the comma

    const next = parseOrFromRegistry(lexer);
    if (!next.ok) {
      return next;
    }
    patterns.push(next.value);
  }

  if (patterns.length === 1) {
    return Ok(patterns[0]);
  }

  return Ok(sequence(...patterns));
};
