/**
 * Repeat pattern parser (quantifiers).
 *
 * @module parse/meta/repeat-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { Quantifier } from "../../quantifier";
import { Reluctance } from "../../reluctance";
import { repeatPattern } from "../../pattern/meta/repeat-pattern";

/**
 * Parse quantifier tokens that follow a grouped pattern.
 *
 * This function assumes that a pattern has been parsed and we're now
 * looking for quantifier operators like *, +, ?, or {n,m}.
 *
 * @param pattern - The pattern to apply the quantifier to
 * @param lexer - The lexer positioned after the pattern
 * @param forceRepeat - If true, always wrap in RepeatPattern even without explicit quantifier
 * @returns The pattern wrapped with the appropriate quantifier
 */
export const parseQuantifier = (
  pattern: Pattern,
  lexer: Lexer,
  forceRepeat: boolean,
): Result<Pattern> => {
  const peeked = lexer.peek();

  if (!peeked.ok || !peeked.value) {
    // No quantifier found
    if (forceRepeat) {
      return Ok(wrapInRepeat(pattern, Quantifier.exactly(1)));
    }
    return Ok(pattern);
  }

  const token = peeked.value;

  switch (token.type) {
    case "RepeatZeroOrMore":
      lexer.next();
      return Ok(wrapInRepeat(pattern, Quantifier.zeroOrMore()));

    case "RepeatZeroOrMoreLazy":
      lexer.next();
      return Ok(wrapInRepeat(pattern, new Quantifier(0, undefined, Reluctance.Lazy)));

    case "RepeatZeroOrMorePossessive":
      lexer.next();
      return Ok(wrapInRepeat(pattern, new Quantifier(0, undefined, Reluctance.Possessive)));

    case "RepeatOneOrMore":
      lexer.next();
      return Ok(wrapInRepeat(pattern, Quantifier.oneOrMore()));

    case "RepeatOneOrMoreLazy":
      lexer.next();
      return Ok(wrapInRepeat(pattern, new Quantifier(1, undefined, Reluctance.Lazy)));

    case "RepeatOneOrMorePossessive":
      lexer.next();
      return Ok(wrapInRepeat(pattern, new Quantifier(1, undefined, Reluctance.Possessive)));

    case "RepeatZeroOrOne":
      lexer.next();
      return Ok(wrapInRepeat(pattern, Quantifier.zeroOrOne()));

    case "RepeatZeroOrOneLazy":
      lexer.next();
      return Ok(wrapInRepeat(pattern, new Quantifier(0, 1, Reluctance.Lazy)));

    case "RepeatZeroOrOnePossessive":
      lexer.next();
      return Ok(wrapInRepeat(pattern, new Quantifier(0, 1, Reluctance.Possessive)));

    case "Range":
      if (token.value.ok) {
        lexer.next();
        return Ok(wrapInRepeat(pattern, token.value.value));
      }
      // Fall through if range parsing failed
      break;
  }

  // No quantifier found
  if (forceRepeat) {
    return Ok(wrapInRepeat(pattern, Quantifier.exactly(1)));
  }
  return Ok(pattern);
};

/**
 * Wrap a pattern in a RepeatPattern with the given quantifier.
 */
const wrapInRepeat = (pattern: Pattern, quantifier: Quantifier): Pattern => ({
  kind: "Meta",
  pattern: { type: "Repeat", pattern: repeatPattern(pattern, quantifier) },
});
