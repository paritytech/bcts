/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Group parser — port of `bc-envelope-pattern-rust`
 * `parse/meta/group_parser.rs`.
 *
 * Called from `parse_primary` after the opening `(` has been consumed.
 *
 * Mirrors Rust exactly:
 *
 * - Parse the inner expression with `parse_or`.
 * - Expect `)`. If missing, surface `ExpectedCloseParen`.
 * - Lookahead **once** for a quantifier suffix. If present, consume it
 *   and wrap as `Pattern::repeat(inner, …)`. Otherwise return the inner
 *   expression unchanged.
 *
 * The previous TS port wrapped every parenthesised expression in a
 * dedicated `GroupPattern` and applied quantifiers to bare primaries —
 * both broke `format(parse(s)) === s` round-tripping.
 *
 * @module envelope-pattern/parse/meta/group-parser
 */

import { Quantifier, Reluctance } from "@bcts/dcbor-pattern";
import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedToken,
} from "../../error";
import { type Pattern, repeat } from "../../pattern";
import type { Lexer } from "../token";
import { parseOr } from "./or-parser";

export function parseGroup(lexer: Lexer): Result<Pattern> {
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  if (close.token.type !== "ParenClose") {
    return err(unexpectedToken(close.token, close.span));
  }

  const next = lexer.peekToken();
  if (next === undefined) {
    return inner;
  }

  let quantifier: Quantifier | undefined;
  const tokenType = next.token.type;
  if (tokenType === "RepeatZeroOrMore") {
    quantifier = Quantifier.zeroOrMore(Reluctance.Greedy);
  } else if (tokenType === "RepeatZeroOrMoreLazy") {
    quantifier = Quantifier.zeroOrMore(Reluctance.Lazy);
  } else if (tokenType === "RepeatZeroOrMorePossessive") {
    quantifier = Quantifier.zeroOrMore(Reluctance.Possessive);
  } else if (tokenType === "RepeatOneOrMore") {
    quantifier = Quantifier.oneOrMore(Reluctance.Greedy);
  } else if (tokenType === "RepeatOneOrMoreLazy") {
    quantifier = Quantifier.oneOrMore(Reluctance.Lazy);
  } else if (tokenType === "RepeatOneOrMorePossessive") {
    quantifier = Quantifier.oneOrMore(Reluctance.Possessive);
  } else if (tokenType === "RepeatZeroOrOne") {
    quantifier = Quantifier.zeroOrOne(Reluctance.Greedy);
  } else if (tokenType === "RepeatZeroOrOneLazy") {
    quantifier = Quantifier.zeroOrOne(Reluctance.Lazy);
  } else if (tokenType === "RepeatZeroOrOnePossessive") {
    quantifier = Quantifier.zeroOrOne(Reluctance.Possessive);
  } else if (tokenType === "Range") {
    if (!next.token.value.ok) return err(next.token.value.error);
    quantifier = next.token.value.value;
  } else {
    return inner;
  }

  lexer.next(); // consume the quantifier token
  return ok(
    repeat(inner.value, quantifier.min(), quantifier.max(), quantifier.reluctance()),
  );
}
