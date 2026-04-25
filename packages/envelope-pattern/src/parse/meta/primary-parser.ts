/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Primary parser — port of `bc-envelope-pattern-rust`
 * `parse/meta/primary_parser.rs`.
 *
 * Dispatches on the next token to the appropriate leaf/structure/meta
 * parser. When a `(` is encountered the open paren is consumed here and
 * `parse_group` handles the rest (paren'd expression + optional
 * quantifier suffix).
 *
 * @module envelope-pattern/parse/meta/primary-parser
 */

import {
  type Result,
  err,
  invalidRegex,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
  unrecognizedToken,
} from "../../error";
import {
  type Pattern,
  ByteStringPattern,
  KnownValuePattern,
  NumberPattern,
  any,
  anyBool,
  anyByteString,
  anyDate,
  anyKnownValue,
  anyNumber,
  anyText,
  bool,
  byteString,
  leaf,
  leafByteString,
  leafKnownValue,
  leafNumber,
  number,
  nullPattern,
  patternLeaf,
  text,
  textRegex,
} from "../../pattern";
import type { Lexer } from "../token";
import { parseArray } from "../leaf/array-parser";
import { parseCbor } from "../leaf/cbor-parser";
import { parseDateContent } from "../leaf/date-parser";
import { parseKnownValueContent } from "../leaf/known-value-parser";
import {
  parseComparisonNumber,
  parseNumberRangeOrComparison,
} from "../leaf/number-parser";
import { parseTag } from "../leaf/tag-parser";
import { parseAssertion } from "../structure/assertion-parser";
import { parseAssertionObj } from "../structure/assertion-obj-parser";
import { parseAssertionPred } from "../structure/assertion-pred-parser";
import { parseCompressed } from "../structure/compressed-parser";
import { parseDigest } from "../structure/digest-parser";
import { parseElided } from "../structure/elided-parser";
import { parseEncrypted } from "../structure/encrypted-parser";
import { parseNode } from "../structure/node-parser";
import { parseObject } from "../structure/object-parser";
import { parseObscured } from "../structure/obscured-parser";
import { parsePredicate } from "../structure/predicate-parser";
import { parseSubject } from "../structure/subject-parser";
import { parseUnwrap, parseWrapped } from "../structure/wrapped-parser";
import { parseCapture } from "./capture-parser";
import { parseGroup } from "./group-parser";
import { parseSearch } from "./search-parser";

export function parsePrimary(lexer: Lexer): Result<Pattern> {
  const tokenResult = lexer.next();
  if (tokenResult === undefined) {
    return err(unexpectedEndOfInput());
  }

  const { token, span } = tokenResult;

  switch (token.type) {
    case "Search":
      return parseSearch(lexer);
    case "Node":
      return parseNode(lexer);
    case "Assertion":
      return parseAssertion(lexer);
    case "AssertionPred":
      return parseAssertionPred(lexer);
    case "AssertionObj":
      return parseAssertionObj(lexer);
    case "Digest":
      return parseDigest(lexer);
    case "Obj":
      return parseObject(lexer);
    case "Obscured":
      return parseObscured(lexer);
    case "Elided":
      return parseElided(lexer);
    case "Encrypted":
      return parseEncrypted(lexer);
    case "Compressed":
      return parseCompressed(lexer);
    case "Pred":
      return parsePredicate(lexer);
    case "Subject":
      return parseSubject(lexer);
    case "Wrapped":
      return parseWrapped(lexer);
    case "Unwrap":
      return parseUnwrap(lexer);
    case "Leaf":
      return ok(leaf());

    case "GroupName":
      return parseCapture(lexer, token.name);

    case "ParenOpen":
      return parseGroup(lexer);

    case "Cbor":
      return parseCbor(lexer);

    case "RepeatZeroOrMore":
      return ok(any());
    case "BoolKeyword":
      return ok(anyBool());
    case "BoolTrue":
      return ok(bool(true));
    case "BoolFalse":
      return ok(bool(false));
    case "NumberKeyword":
      return ok(anyNumber());
    case "TextKeyword":
      return ok(anyText());
    case "StringLiteral":
      if (!token.value.ok) return err(token.value.error);
      return ok(text(token.value.value));
    case "UnsignedInteger":
      if (!token.value.ok) return err(token.value.error);
      return parseNumberRangeOrComparison(lexer, token.value.value);
    case "Integer":
      if (!token.value.ok) return err(token.value.error);
      return parseNumberRangeOrComparison(lexer, token.value.value);
    case "Float":
      if (!token.value.ok) return err(token.value.error);
      return parseNumberRangeOrComparison(lexer, token.value.value);
    case "GreaterThanOrEqual":
      return parseComparisonNumber(lexer, ">=");
    case "LessThanOrEqual":
      return parseComparisonNumber(lexer, "<=");
    case "GreaterThan":
      return parseComparisonNumber(lexer, ">");
    case "LessThan":
      return parseComparisonNumber(lexer, "<");
    case "NaN":
      return ok(patternLeaf(leafNumber(NumberPattern.nan())));
    case "Infinity":
      return ok(number(Infinity));
    case "NegativeInfinity":
      return ok(number(-Infinity));
    case "Regex":
      if (!token.value.ok) return err(token.value.error);
      try {
        return ok(textRegex(new RegExp(token.value.value)));
      } catch {
        return err(invalidRegex(span));
      }
    case "BracketOpen":
      return parseArray(lexer);
    case "ByteString":
      return ok(anyByteString());
    case "HexPattern":
      if (!token.value.ok) return err(token.value.error);
      return ok(byteString(token.value.value));
    case "HexBinaryRegex":
      if (!token.value.ok) return err(token.value.error);
      try {
        return ok(
          patternLeaf(leafByteString(ByteStringPattern.regex(new RegExp(token.value.value)))),
        );
      } catch {
        return err(invalidRegex(span));
      }
    case "DateKeyword":
      return ok(anyDate());
    case "DatePattern":
      if (!token.value.ok) return err(token.value.error);
      return parseDateContent(token.value.value, span);
    case "Tagged":
      return parseTag(lexer);
    case "Known":
      return ok(anyKnownValue());
    case "SingleQuotedPattern":
      if (!token.value.ok) return err(token.value.error);
      return parseKnownValueContent(token.value.value);
    case "SingleQuotedRegex":
      if (!token.value.ok) return err(token.value.error);
      try {
        return ok(
          patternLeaf(leafKnownValue(KnownValuePattern.regex(new RegExp(token.value.value)))),
        );
      } catch {
        return err(invalidRegex(span));
      }
    case "Null":
      return ok(nullPattern());

    case "Identifier":
      // Rust's logos lexer never produces `Identifier` for unknown
      // words; it errors with `UnrecognizedToken`. Mirror that behaviour
      // here so error positions line up with Rust.
      return err(unrecognizedToken(span));

    case "And":
    case "Or":
    case "Not":
    case "Traverse":
    case "RepeatZeroOrMoreLazy":
    case "RepeatZeroOrMorePossessive":
    case "RepeatOneOrMore":
    case "RepeatOneOrMoreLazy":
    case "RepeatOneOrMorePossessive":
    case "RepeatZeroOrOne":
    case "RepeatZeroOrOneLazy":
    case "RepeatZeroOrOnePossessive":
    case "ParenClose":
    case "BracketClose":
    case "Comma":
    case "Ellipsis":
    case "Range":
      return err(unexpectedToken(token, span));
  }
}
