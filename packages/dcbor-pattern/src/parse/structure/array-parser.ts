/**
 * Array pattern parser.
 *
 * @module parse/structure/array-parser
 */

import type { Lexer, Token } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { anyArray, sequence } from "../../pattern";
import {
  arrayPatternWithLengthInterval,
  arrayPatternWithElements,
} from "../../pattern/structure/array-pattern";
import { Interval } from "../../interval";

// Forward declare to avoid circular dependency
let parseOr: (lexer: Lexer) => Result<Pattern>;

/**
 * Initialize the parser with the or-parser to avoid circular dependency.
 */
export const initArrayParser = (orParser: (lexer: Lexer) => Result<Pattern>) => {
  parseOr = orParser;
};

/**
 * Parse a bracket array pattern: [pattern] or [{n}] etc.
 */
export const parseBracketArray = (lexer: Lexer): Result<Pattern> => {
  // Lazy load to avoid circular dependency
  if (!parseOr) {
    parseOr = require("../meta/or-parser").parseOr;
  }

  // Opening bracket was already consumed
  // Peek at the next token to determine what we're parsing
  const peeked = lexer.peek();

  if (!peeked.ok) {
    return Err({ type: "UnexpectedEndOfInput" });
  }

  const token = peeked.value;

  // Check for Range token (array length constraint like [{3}] or [{1,5}])
  if (token?.type === "Range" && token.value.ok) {
    lexer.next(); // consume the Range token
    const quantifier = token.value.value;
    const pattern = arrayPatternWithLengthInterval(quantifier.interval());

    // Expect closing bracket
    const next = lexer.next();
    if (!next.ok || next.value?.type !== "BracketClose") {
      return Err({
        type: "ExpectedCloseBracket",
        span: lexer.span(),
      });
    }

    return Ok({
      kind: "Structure",
      pattern: { type: "Array", pattern },
    });
  }

  // Check for closing bracket (empty array pattern - matches array with default length)
  if (token?.type === "BracketClose") {
    lexer.next(); // consume the closing bracket
    return Ok({
      kind: "Structure",
      pattern: { type: "Array", pattern: arrayPatternWithLengthInterval(Interval.exactly(1)) },
    });
  }

  // Parse as array with element pattern(s)
  const elementPattern = parseArrayOr(lexer);
  if (!elementPattern.ok) {
    return elementPattern;
  }

  const pattern = arrayPatternWithElements(elementPattern.value);

  // Expect closing bracket
  const next = lexer.next();
  if (!next.ok || next.value?.type !== "BracketClose") {
    return Err({
      type: "ExpectedCloseBracket",
      span: lexer.span(),
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
    const peeked = lexer.peek();
    if (!peeked.ok || !peeked.value || peeked.value.type !== "Or") {
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

  const { or } = require("../../pattern");
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
    const peeked = lexer.peek();
    if (!peeked.ok || !peeked.value || peeked.value.type !== "And") {
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

  const { and } = require("../../pattern");
  return Ok(and(...patterns));
};

/**
 * Parse NOT patterns within array context.
 */
const parseArrayNot = (lexer: Lexer): Result<Pattern> => {
  const peeked = lexer.peek();
  if (peeked.ok && peeked.value?.type === "Not") {
    lexer.next(); // consume the NOT token
    const inner = parseArrayNot(lexer); // right associative
    if (!inner.ok) {
      return inner;
    }
    const { not } = require("../../pattern");
    return Ok(not(inner.value));
  }
  return parseArraySequence(lexer);
};

/**
 * Parse sequence patterns within array context (comma-separated).
 */
const parseArraySequence = (lexer: Lexer): Result<Pattern> => {
  const patterns: Pattern[] = [];
  const first = parseOr(lexer);
  if (!first.ok) {
    return first;
  }
  patterns.push(first.value);

  while (true) {
    const peeked = lexer.peek();
    if (!peeked.ok || !peeked.value || peeked.value.type !== "Comma") {
      break;
    }
    lexer.next(); // consume the comma

    const next = parseOr(lexer);
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
