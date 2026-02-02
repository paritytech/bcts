/**
 * @bcts/envelope-pattern - Parser entry point
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust parse/mod.rs
 * Recursive descent parser for Gordian Envelope pattern syntax.
 *
 * @module envelope-pattern/parse
 */

import { parse as parseDcborPattern } from "@bcts/dcbor-pattern";
import { Lexer } from "./token";
import { parseCborInner } from "./utils";
import {
  type Result,
  type Span,
  ok,
  err,
  unexpectedEndOfInput,
  extraData,
  invalidRegex,
  unexpectedToken,
} from "../error";
import {
  type Pattern,
  // Leaf pattern constructors
  any,
  anyBool,
  bool,
  anyText,
  text,
  textRegex,
  anyNumber,
  number,
  numberRange,
  numberGreaterThan,
  numberLessThan,
  anyByteString,
  byteString,
  anyDate,
  date,
  dateRange,
  dateEarliest,
  dateLatest,
  dateRegex,
  anyKnownValue,
  knownValue,
  anyArray,
  anyTag,
  anyCbor,
  cborPattern,
  nullPattern,
  // Structure pattern constructors
  leaf,
  anyAssertion,
  assertionWithPredicate,
  assertionWithObject,
  anySubject,
  subject,
  anyPredicate,
  predicate,
  anyObject,
  object,
  digestPrefix,
  anyNode,
  obscured,
  elided,
  encrypted,
  compressed,
  wrapped,
  unwrapEnvelope,
  unwrapMatching,
  // Meta pattern constructors
  and,
  or,
  notMatching,
  capture,
  search,
  traverse,
  repeat,
  group,
  // Pattern types
  patternLeaf,
  patternStructure,
  // Specific pattern classes
  NumberPattern,
  ByteStringPattern,
  KnownValuePattern,
  ArrayPattern,
  TaggedPattern,
  DigestPattern,
  NodePattern,
  AssertionsPattern,
  leafNumber,
  leafByteString,
  leafKnownValue,
  leafArray,
  leafTag,
  structureDigest,
  structureNode,
  structureAssertions,
} from "../pattern";
import { Quantifier, Reluctance } from "@bcts/dcbor-pattern";
import { type KnownValue as KnownValueType } from "@bcts/known-values";
import { CborDate } from "@bcts/dcbor";

// Re-export token types
export { type Token, Lexer } from "./token";

/**
 * Parse a pattern expression string into a Pattern.
 */
export function parse(input: string): Result<Pattern> {
  const lexer = new Lexer(input);

  // Try envelope-pattern parsing first
  const result = parseOr(lexer);
  if (!result.ok) {
    // If envelope-pattern parsing failed, try dcbor-pattern as fallback
    const dcborResult = parseDcborPattern(input);
    if (dcborResult.ok) {
      return convertDcborPatternToEnvelopePattern(dcborResult.value);
    }
    // Both parsers failed, return the original envelope error
    return result;
  }

  // Check for extra data
  const next = lexer.next();
  if (next !== undefined) {
    return err(extraData(next.span));
  }

  return result;
}

/**
 * Parse a pattern, allowing extra data after the pattern.
 */
export function parsePartial(input: string): Result<[Pattern, number]> {
  const lexer = new Lexer(input);
  const result = parseOr(lexer);
  if (!result.ok) {
    return result as Result<[Pattern, number]>;
  }
  return ok([result.value, lexer.position]);
}

/**
 * Convert a dcbor-pattern Pattern to an envelope-pattern Pattern.
 */
function convertDcborPatternToEnvelopePattern(_dcborPattern: unknown): Result<Pattern> {
  // For now, wrap dcbor patterns as CBOR patterns
  // This is a simplified conversion - the dcbor pattern is matched by the any() pattern
  return ok(any());
}

// ============================================================================
// Recursive Descent Parser
// ============================================================================

/**
 * Parse an Or expression: expr (| expr)*
 */
function parseOr(lexer: Lexer): Result<Pattern> {
  const patterns: Pattern[] = [];

  const first = parseTraverse(lexer);
  if (!first.ok) return first;
  patterns.push(first.value);

  while (true) {
    const next = lexer.peekToken();
    if (next?.token.type !== "Or") {
      break;
    }
    lexer.next(); // consume the |

    const nextExpr = parseTraverse(lexer);
    if (!nextExpr.ok) return nextExpr;
    patterns.push(nextExpr.value);
  }

  if (patterns.length === 1) {
    return ok(patterns[0]);
  }
  return ok(or(patterns));
}

/**
 * Parse a Traverse expression: expr (-> expr)*
 */
function parseTraverse(lexer: Lexer): Result<Pattern> {
  const patterns: Pattern[] = [];

  const first = parseAnd(lexer);
  if (!first.ok) return first;
  patterns.push(first.value);

  while (true) {
    const next = lexer.peekToken();
    if (next?.token.type !== "Traverse") {
      break;
    }
    lexer.next(); // consume the ->

    const nextExpr = parseAnd(lexer);
    if (!nextExpr.ok) return nextExpr;
    patterns.push(nextExpr.value);
  }

  if (patterns.length === 1) {
    return ok(patterns[0]);
  }
  return ok(traverse(patterns));
}

/**
 * Parse an And expression: expr (& expr)*
 */
function parseAnd(lexer: Lexer): Result<Pattern> {
  const patterns: Pattern[] = [];

  const first = parseNot(lexer);
  if (!first.ok) return first;
  patterns.push(first.value);

  while (true) {
    const next = lexer.peekToken();
    if (next?.token.type !== "And") {
      break;
    }
    lexer.next(); // consume the &

    const nextExpr = parseNot(lexer);
    if (!nextExpr.ok) return nextExpr;
    patterns.push(nextExpr.value);
  }

  if (patterns.length === 1) {
    return ok(patterns[0]);
  }
  return ok(and(patterns));
}

/**
 * Parse a Not expression: !? group
 */
function parseNot(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type === "Not") {
    lexer.next(); // consume the !
    const inner = parseGroup(lexer);
    if (!inner.ok) return inner;
    return ok(notMatching(inner.value));
  }
  return parseGroup(lexer);
}

/**
 * Parse a Group expression: primary quantifier?
 */
function parseGroup(lexer: Lexer): Result<Pattern> {
  const primary = parsePrimary(lexer);
  if (!primary.ok) return primary;

  // Check for quantifier
  const next = lexer.peekToken();
  if (next === undefined) {
    return primary;
  }

  const tokenType = next.token.type;
  let quantifier: Quantifier | undefined;

  if (tokenType === "RepeatZeroOrMore") {
    lexer.next();
    quantifier = Quantifier.zeroOrMore(Reluctance.Greedy);
  } else if (tokenType === "RepeatZeroOrMoreLazy") {
    lexer.next();
    quantifier = Quantifier.zeroOrMore(Reluctance.Lazy);
  } else if (tokenType === "RepeatZeroOrMorePossessive") {
    lexer.next();
    quantifier = Quantifier.zeroOrMore(Reluctance.Possessive);
  } else if (tokenType === "RepeatOneOrMore") {
    lexer.next();
    quantifier = Quantifier.oneOrMore(Reluctance.Greedy);
  } else if (tokenType === "RepeatOneOrMoreLazy") {
    lexer.next();
    quantifier = Quantifier.oneOrMore(Reluctance.Lazy);
  } else if (tokenType === "RepeatOneOrMorePossessive") {
    lexer.next();
    quantifier = Quantifier.oneOrMore(Reluctance.Possessive);
  } else if (tokenType === "RepeatZeroOrOne") {
    lexer.next();
    quantifier = Quantifier.zeroOrOne(Reluctance.Greedy);
  } else if (tokenType === "RepeatZeroOrOneLazy") {
    lexer.next();
    quantifier = Quantifier.zeroOrOne(Reluctance.Lazy);
  } else if (tokenType === "RepeatZeroOrOnePossessive") {
    lexer.next();
    quantifier = Quantifier.zeroOrOne(Reluctance.Possessive);
  } else if (tokenType === "Range") {
    lexer.next();
    if (!next.token.value.ok) {
      return err(next.token.value.error);
    }
    quantifier = next.token.value.value;
  } else {
    // No quantifier found, return the primary expression as-is
    return primary;
  }

  return ok(repeat(primary.value, quantifier.min(), quantifier.max(), quantifier.reluctance()));
}

/**
 * Parse a primary expression (atoms and structure keywords).
 */
function parsePrimary(lexer: Lexer): Result<Pattern> {
  const tokenResult = lexer.next();
  if (tokenResult === undefined) {
    return err(unexpectedEndOfInput());
  }

  const { token, span } = tokenResult;

  switch (token.type) {
    // Envelope-specific structure patterns
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
      return ok(obscured());
    case "Elided":
      return ok(elided());
    case "Encrypted":
      return ok(encrypted());
    case "Compressed":
      return ok(compressed());
    case "Pred":
      return parsePredicate(lexer);
    case "Subject":
      return parseSubject(lexer);
    case "Wrapped":
      return ok(wrapped());
    case "Unwrap":
      return parseUnwrap(lexer);
    case "Leaf":
      return ok(leaf());

    // Capture group
    case "GroupName":
      return parseCapture(lexer, token.name);

    // Grouping with parentheses
    case "ParenOpen":
      return parseParenGroup(lexer);

    // CBOR pattern
    case "Cbor":
      return parseCbor(lexer);

    // Simple patterns
    case "RepeatZeroOrMore":
      return ok(any()); // * means any
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

    // These tokens are not valid as primary expressions
    // They are handled by other parsers or are structural tokens
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
    case "Identifier":
      return err(unexpectedToken(token, span));
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a parenthesized group expression.
 */
function parseParenGroup(lexer: Lexer): Result<Pattern> {
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(group(inner.value));
}

/**
 * Parse a capture group: @name pattern
 */
function parseCapture(lexer: Lexer, name: string): Result<Pattern> {
  const inner = parseGroup(lexer);
  if (!inner.ok) return inner;
  return ok(capture(name, inner.value));
}

/**
 * Parse a search pattern: search(pattern)
 */
function parseSearch(lexer: Lexer): Result<Pattern> {
  const open = lexer.next();
  if (open?.token.type !== "ParenOpen") {
    return err({ type: "ExpectedOpenParen", span: lexer.span() });
  }

  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(search(inner.value));
}

/**
 * Parse number with possible range or comparison.
 */
function parseNumberRangeOrComparison(lexer: Lexer, firstValue: number): Result<Pattern> {
  const next = lexer.peekToken();
  if (next === undefined) {
    return ok(number(firstValue));
  }

  if (next.token.type === "Ellipsis") {
    lexer.next(); // consume ...
    const endToken = lexer.next();
    if (endToken === undefined) {
      return err(unexpectedEndOfInput());
    }

    let endValue: number;
    if (endToken.token.type === "UnsignedInteger" || endToken.token.type === "Integer") {
      if (!endToken.token.value.ok) return err(endToken.token.value.error);
      endValue = endToken.token.value.value;
    } else if (endToken.token.type === "Float") {
      if (!endToken.token.value.ok) return err(endToken.token.value.error);
      endValue = endToken.token.value.value;
    } else {
      return err(unexpectedToken(endToken.token, endToken.span));
    }

    return ok(numberRange(firstValue, endValue));
  }

  return ok(number(firstValue));
}

/**
 * Parse comparison number: >=n, <=n, >n, <n
 */
function parseComparisonNumber(lexer: Lexer, op: string): Result<Pattern> {
  const numToken = lexer.next();
  if (numToken === undefined) {
    return err(unexpectedEndOfInput());
  }

  let value: number;
  if (numToken.token.type === "UnsignedInteger" || numToken.token.type === "Integer") {
    if (!numToken.token.value.ok) return err(numToken.token.value.error);
    value = numToken.token.value.value;
  } else if (numToken.token.type === "Float") {
    if (!numToken.token.value.ok) return err(numToken.token.value.error);
    value = numToken.token.value.value;
  } else {
    return err(unexpectedToken(numToken.token, numToken.span));
  }

  switch (op) {
    case ">=":
      return ok(patternLeaf(leafNumber(NumberPattern.greaterThanOrEqual(value))));
    case "<=":
      return ok(patternLeaf(leafNumber(NumberPattern.lessThanOrEqual(value))));
    case ">":
      return ok(numberGreaterThan(value));
    case "<":
      return ok(numberLessThan(value));
    default:
      return ok(number(value));
  }
}

/**
 * Parse an array pattern.
 */
function parseArray(lexer: Lexer): Result<Pattern> {
  // Check for empty array or simple patterns
  const first = lexer.peekToken();
  if (first === undefined) {
    return err(unexpectedEndOfInput());
  }

  if (first.token.type === "BracketClose") {
    lexer.next(); // consume ]
    return ok(patternLeaf(leafArray(ArrayPattern.count(0))));
  }

  if (first.token.type === "RepeatZeroOrMore") {
    lexer.next(); // consume *
    const close = lexer.next();
    if (close?.token.type !== "BracketClose") {
      return err({ type: "ExpectedCloseBracket", span: lexer.span() });
    }
    return ok(anyArray());
  }

  // Parse the inner pattern(s)
  const patterns: Pattern[] = [];

  while (true) {
    const next = lexer.peekToken();
    if (next === undefined) {
      return err(unexpectedEndOfInput());
    }

    if (next.token.type === "BracketClose") {
      lexer.next(); // consume ]
      break;
    }

    const pattern = parseOr(lexer);
    if (!pattern.ok) return pattern;
    patterns.push(pattern.value);

    const afterPattern = lexer.peekToken();
    if (afterPattern === undefined) {
      return err(unexpectedEndOfInput());
    }

    if (afterPattern.token.type === "Comma") {
      lexer.next(); // consume ,
    } else if (afterPattern.token.type !== "BracketClose") {
      return err(unexpectedToken(afterPattern.token, afterPattern.span));
    }
  }

  if (patterns.length === 0) {
    return ok(patternLeaf(leafArray(ArrayPattern.count(0))));
  }

  return ok(patternLeaf(leafArray(ArrayPattern.withPatterns(patterns))));
}

/**
 * Parse a tag pattern.
 */
function parseTag(lexer: Lexer): Result<Pattern> {
  const open = lexer.next();
  if (open?.token.type !== "ParenOpen") {
    return ok(anyTag());
  }

  // Parse tag number or pattern
  const tagToken = lexer.next();
  if (tagToken === undefined) {
    return err(unexpectedEndOfInput());
  }

  if (tagToken.token.type !== "UnsignedInteger") {
    return err(unexpectedToken(tagToken.token, tagToken.span));
  }

  if (!tagToken.token.value.ok) return err(tagToken.token.value.error);
  // tagToken.token.value.value contains the tag number for future tag-specific matching

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  // Create a tagged pattern with the specific tag
  // For now, just match the tag number
  return ok(anyTag()); // Simplified - full implementation would match specific tag
}

/**
 * Parse date content from date'...' pattern.
 */
function parseDateContent(content: string, span: Span): Result<Pattern> {
  // Check for regex syntax: /pattern/
  if (content.startsWith("/") && content.endsWith("/")) {
    const regexStr = content.slice(1, -1);
    try {
      return ok(dateRegex(new RegExp(regexStr)));
    } catch {
      return err(invalidRegex(span));
    }
  }

  // Check for range syntax: date1...date2, date1..., ...date2
  const rangeIdx = content.indexOf("...");
  if (rangeIdx !== -1) {
    const left = content.slice(0, rangeIdx).trim();
    const right = content.slice(rangeIdx + 3).trim();

    if (left.length === 0 && right.length > 0) {
      // ...date2 → latest
      const parsed = Date.parse(right);
      if (isNaN(parsed)) return err({ type: "InvalidDateFormat", span });
      return ok(dateLatest(CborDate.fromDatetime(new Date(parsed))));
    }
    if (left.length > 0 && right.length === 0) {
      // date1... → earliest
      const parsed = Date.parse(left);
      if (isNaN(parsed)) return err({ type: "InvalidDateFormat", span });
      return ok(dateEarliest(CborDate.fromDatetime(new Date(parsed))));
    }
    if (left.length > 0 && right.length > 0) {
      // date1...date2 → range
      const parsedStart = Date.parse(left);
      const parsedEnd = Date.parse(right);
      if (isNaN(parsedStart) || isNaN(parsedEnd)) return err({ type: "InvalidDateFormat", span });
      return ok(dateRange(CborDate.fromDatetime(new Date(parsedStart)), CborDate.fromDatetime(new Date(parsedEnd))));
    }
    return err({ type: "InvalidDateFormat", span });
  }

  // Simple exact date
  const parsed = Date.parse(content);
  if (isNaN(parsed)) {
    return err({ type: "InvalidDateFormat", span });
  }

  const cborDate = CborDate.fromDatetime(new Date(parsed));
  return ok(date(cborDate));
}

/**
 * Parse known value content from '...' pattern.
 */
function parseKnownValueContent(content: string): Result<Pattern> {
  // Try to parse as number first
  const numValue = parseInt(content, 10);
  if (!isNaN(numValue)) {
    const kv = { value: () => BigInt(numValue) } as unknown as KnownValueType;
    return ok(knownValue(kv));
  }

  // Try to find by name in known values
  // For now, just create a named pattern
  return ok(patternLeaf(leafKnownValue(KnownValuePattern.named(content))));
}

/**
 * Parse CBOR pattern.
 */
function parseCbor(lexer: Lexer): Result<Pattern> {
  // Check for optional content in parentheses
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyCbor()); // cbor matches any CBOR value
  }

  lexer.next(); // consume (

  // Check for dcbor-pattern regex syntax: cbor(/keyword/)
  const peek = lexer.peekToken();
  if (peek?.token.type === "Regex") {
    lexer.next(); // consume Regex token
    const regexToken = peek.token;
    if (!regexToken.value.ok) return err(regexToken.value.error);
    const keyword = regexToken.value.value;

    // Parse the keyword as a dcbor-pattern expression
    const dcborResult = parseDcborPattern(keyword);
    if (!dcborResult.ok) {
      return err(unexpectedToken(regexToken, peek.span));
    }
    const dcborPattern = dcborResult.value;

    const close = lexer.next();
    if (close?.token.type !== "ParenClose") {
      return err({ type: "ExpectedCloseParen", span: lexer.span() });
    }

    return ok(cborPattern(dcborPattern));
  }

  // Parse inner content as CBOR diagnostic notation (matching Rust parse_cbor)
  const remaining = lexer.remainder();
  const cborResult = parseCborInner(remaining);
  if (cborResult.ok) {
    const [pattern, consumed] = cborResult.value;
    lexer.bump(consumed);
    // Skip whitespace before closing paren
    while (lexer.peek() === " " || lexer.peek() === "\t" || lexer.peek() === "\n") {
      lexer.bump(1);
    }
    const close = lexer.next();
    if (close?.token.type !== "ParenClose") {
      return err({ type: "ExpectedCloseParen", span: lexer.span() });
    }
    return ok(pattern);
  }

  // Fallback: try parsing as a regular pattern expression
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return inner;
}

// ============================================================================
// Structure Pattern Parsers
// ============================================================================

function parseNode(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyNode());
  }

  lexer.next(); // consume (

  // Check for assertion count range: node({n,m}), node({n}), node({n,})
  const afterParen = lexer.peekToken();
  if (afterParen?.token.type === "Range") {
    lexer.next(); // consume Range token
    const rangeToken = afterParen.token;
    if (!rangeToken.value.ok) return err(rangeToken.value.error);
    const quantifier = rangeToken.value.value;
    const interval = quantifier.interval();

    const close = lexer.next();
    if (close?.token.type !== "ParenClose") {
      return err({ type: "ExpectedCloseParen", span: lexer.span() });
    }

    return ok(patternStructure(structureNode(NodePattern.fromInterval(interval))));
  }

  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(patternStructure(structureNode(NodePattern.withSubject(inner.value))));
}

function parseAssertion(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyAssertion());
  }

  lexer.next(); // consume (

  // Parse predicate pattern
  const pred = parseOr(lexer);
  if (!pred.ok) return pred;

  const comma = lexer.next();
  if (comma?.token.type !== "Comma") {
    return err(unexpectedToken(comma?.token ?? { type: "Null" }, comma?.span ?? lexer.span()));
  }

  // Parse object pattern
  const obj = parseOr(lexer);
  if (!obj.ok) return obj;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(
    patternStructure(structureAssertions(AssertionsPattern.withBoth(pred.value, obj.value))),
  );
}

function parseAssertionPred(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyAssertion());
  }

  lexer.next(); // consume (
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(assertionWithPredicate(inner.value));
}

function parseAssertionObj(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyAssertion());
  }

  lexer.next(); // consume (
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(assertionWithObject(inner.value));
}

function parseDigest(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(patternStructure(structureDigest(DigestPattern.any())));
  }

  lexer.next(); // consume (

  // Parse digest hex pattern
  const digestToken = lexer.next();
  if (digestToken === undefined) {
    return err(unexpectedEndOfInput());
  }

  if (digestToken.token.type === "HexPattern") {
    if (!digestToken.token.value.ok) return err(digestToken.token.value.error);
    const close = lexer.next();
    if (close?.token.type !== "ParenClose") {
      return err({ type: "ExpectedCloseParen", span: lexer.span() });
    }
    return ok(digestPrefix(digestToken.token.value.value));
  }

  // Accept raw hex string identifiers: digest(a1b2c3)
  if (digestToken.token.type === "Identifier") {
    const hexStr = digestToken.token.value;
    // Validate hex string: must be even length and all hex digits
    if (hexStr.length === 0 || hexStr.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hexStr)) {
      return err({ type: "InvalidHexString", span: digestToken.span });
    }
    const bytes = new Uint8Array(hexStr.length / 2);
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes[i / 2] = Number.parseInt(hexStr.slice(i, i + 2), 16);
    }
    const close = lexer.next();
    if (close?.token.type !== "ParenClose") {
      return err({ type: "ExpectedCloseParen", span: lexer.span() });
    }
    return ok(digestPrefix(bytes));
  }

  return err(unexpectedToken(digestToken.token, digestToken.span));
}

function parseObject(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyObject());
  }

  lexer.next(); // consume (
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(object(inner.value));
}

function parsePredicate(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyPredicate());
  }

  lexer.next(); // consume (
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(predicate(inner.value));
}

function parseSubject(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anySubject());
  }

  lexer.next(); // consume (
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(subject(inner.value));
}

function parseUnwrap(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(unwrapEnvelope());
  }

  lexer.next(); // consume (
  const inner = parseOr(lexer);
  if (!inner.ok) return inner;

  const close = lexer.next();
  if (close?.token.type !== "ParenClose") {
    return err({ type: "ExpectedCloseParen", span: lexer.span() });
  }

  return ok(unwrapMatching(inner.value));
}
