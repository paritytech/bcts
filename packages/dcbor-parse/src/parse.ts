/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/dcbor-parse - Parse module
 *
 * This is a 1:1 TypeScript port of bc-dcbor-parse-rust parse.rs
 *
 * @module dcbor-parse/parse
 */

import { type Cbor, cbor, CborMap, getGlobalTagsStore } from "@bcts/dcbor";
import { KnownValue, KNOWN_VALUES } from "@bcts/known-values";
import type { UR } from "@bcts/uniform-resources";
import {
  type Span,
  span,
  parseError as PE,
  type ParseResult,
  ok,
  err,
  isDefaultError,
} from "./error";
import { type Token, Lexer } from "./token";

/**
 * Parses a dCBOR item from a string input.
 *
 * This function takes a string slice containing a dCBOR diagnostic notation
 * encoded value and attempts to parse it into a `Cbor` object. If the input
 * contains extra tokens after a valid item, an error is returned.
 *
 * @param src - A string containing the dCBOR-encoded data.
 * @returns `Ok(Cbor)` if parsing is successful and the input contains exactly one
 *   valid dCBOR item, which itself might be an atomic value like a number or
 *   string, or a complex value like an array or map.
 *   `Err(ParseError)` if parsing fails or if extra tokens are found after the item.
 *
 * @example
 * ```typescript
 * const result = parseDcborItem("[1, 2, 3]");
 * if (result.ok) {
 *   console.log(result.value.toDiagnostic()); // "[1, 2, 3]"
 * }
 * ```
 */
export function parseDcborItem(src: string): ParseResult<Cbor> {
  const lexer = new Lexer(src);
  const firstTokenResult = expectToken(lexer);

  if (!firstTokenResult.ok) {
    if (firstTokenResult.error.type === "UnexpectedEndOfInput") {
      return err(PE.emptyInput());
    }
    return firstTokenResult;
  }

  const parseResult = parseItemToken(firstTokenResult.value, lexer);
  if (!parseResult.ok) {
    return parseResult;
  }

  // Check for extra data
  const nextToken = lexer.next();
  if (nextToken !== undefined) {
    return err(PE.extraData(lexer.span()));
  }

  return parseResult;
}

/**
 * Parses a dCBOR item from the beginning of a string and returns the parsed
 * `Cbor` along with the number of bytes consumed.
 *
 * Unlike `parseDcborItem`, this function succeeds even if additional
 * characters follow the first item. The returned index points to the first
 * unparsed character after skipping any trailing whitespace or comments.
 *
 * @param src - A string containing the dCBOR-encoded data.
 * @returns `Ok([Cbor, number])` with the parsed item and bytes consumed.
 *
 * @example
 * ```typescript
 * const result = parseDcborItemPartial("true )");
 * if (result.ok) {
 *   const [cbor, used] = result.value;
 *   console.log(cbor.toDiagnostic()); // "true"
 *   console.log(used); // 5
 * }
 * ```
 */
export function parseDcborItemPartial(src: string): ParseResult<[Cbor, number]> {
  const lexer = new Lexer(src);
  const firstTokenResult = expectToken(lexer);

  if (!firstTokenResult.ok) {
    if (firstTokenResult.error.type === "UnexpectedEndOfInput") {
      return err(PE.emptyInput());
    }
    return firstTokenResult;
  }

  const parseResult = parseItemToken(firstTokenResult.value, lexer);
  if (!parseResult.ok) {
    return parseResult;
  }

  // Determine consumed bytes
  const nextToken = lexer.next();
  const consumed = nextToken !== undefined ? lexer.span().start : src.length;

  return ok([parseResult.value, consumed]);
}

// === Private Functions ===

function parseItem(lexer: Lexer): ParseResult<Cbor> {
  const tokenResult = expectToken(lexer);
  if (!tokenResult.ok) {
    return tokenResult;
  }
  return parseItemToken(tokenResult.value, lexer);
}

function expectToken(lexer: Lexer): ParseResult<Token> {
  const spanBefore = lexer.span();
  const result = lexer.next();

  if (result === undefined) {
    return err(PE.unexpectedEndOfInput());
  }

  if (!result.ok) {
    if (isDefaultError(result.error)) {
      return err(PE.unrecognizedToken(spanBefore));
    }
    return result;
  }

  return result;
}

function parseItemToken(token: Token, lexer: Lexer): ParseResult<Cbor> {
  switch (token.type) {
    case "Bool":
      return ok(cbor(token.value));

    case "Null":
      return ok(cbor(null));

    case "ByteStringHex":
      return ok(cbor(token.value));

    case "ByteStringBase64":
      return ok(cbor(token.value));

    case "DateLiteral":
      return ok(cbor(token.value));

    case "Number":
      return ok(cbor(token.value));

    case "NaN":
      return ok(cbor(Number.NaN));

    case "Infinity":
      return ok(cbor(Number.POSITIVE_INFINITY));

    case "NegInfinity":
      return ok(cbor(Number.NEGATIVE_INFINITY));

    case "String":
      return parseString(token.value, lexer.span());

    case "UR":
      return parseUr(token.value, lexer.span());

    case "TagValue":
      return parseNumberTag(token.value, lexer);

    case "TagName":
      return parseNameTag(token.value, lexer);

    case "KnownValueNumber":
      return ok(new KnownValue(token.value).taggedCbor());

    case "KnownValueName": {
      // Empty string means Unit (value 0)
      if (token.value === "") {
        return ok(new KnownValue(0).taggedCbor());
      }

      const knownValue = knownValueForName(token.value);
      if (knownValue !== undefined) {
        return ok(knownValue.taggedCbor());
      }
      const tokenSpan = lexer.span();
      return err(
        PE.unknownKnownValueName(token.value, span(tokenSpan.start + 1, tokenSpan.end - 1)),
      );
    }

    case "Unit":
      return ok(new KnownValue(0).taggedCbor());

    case "BracketOpen":
      return parseArray(lexer);

    case "BraceOpen":
      return parseMap(lexer);

    // Syntactic tokens that cannot start an item
    case "BraceClose":
    case "BracketClose":
    case "ParenthesisOpen":
    case "ParenthesisClose":
    case "Colon":
    case "Comma":
      return err(PE.unexpectedToken(token, lexer.span()));
  }
}

function parseString(s: string, tokenSpan: Span): ParseResult<Cbor> {
  if (s.startsWith('"') && s.endsWith('"')) {
    // Remove quotes and return the inner string
    const inner = s.slice(1, -1);
    return ok(cbor(inner));
  }
  return err(PE.unrecognizedToken(tokenSpan));
}

function tagForName(name: string): number | bigint | undefined {
  return getGlobalTagsStore().tagForName(name)?.value;
}

function knownValueForName(name: string): KnownValue | undefined {
  return KNOWN_VALUES.get().knownValueNamed(name);
}

function parseUr(ur: UR, tokenSpan: Span): ParseResult<Cbor> {
  const urType = ur.urTypeStr();
  const tag = tagForName(urType);

  if (tag !== undefined) {
    return ok(cbor({ tag, value: ur.cbor() }));
  }

  return err(
    PE.unknownUrType(urType, span(tokenSpan.start + 3, tokenSpan.start + 3 + urType.length)),
  );
}

function parseNumberTag(tagValue: number, lexer: Lexer): ParseResult<Cbor> {
  const itemResult = parseItem(lexer);
  if (!itemResult.ok) {
    return itemResult;
  }

  const closeResult = expectToken(lexer);
  if (!closeResult.ok) {
    if (closeResult.error.type === "UnexpectedEndOfInput") {
      return err(PE.unmatchedParentheses(lexer.span()));
    }
    return closeResult;
  }

  if (closeResult.value.type === "ParenthesisClose") {
    return ok(cbor({ tag: tagValue, value: itemResult.value }));
  }

  return err(PE.unmatchedParentheses(lexer.span()));
}

function parseNameTag(name: string, lexer: Lexer): ParseResult<Cbor> {
  const tagSpan = span(lexer.span().start, lexer.span().end - 1);

  const itemResult = parseItem(lexer);
  if (!itemResult.ok) {
    return itemResult;
  }

  const closeResult = expectToken(lexer);
  if (!closeResult.ok) {
    return closeResult;
  }

  if (closeResult.value.type === "ParenthesisClose") {
    const tag = tagForName(name);
    if (tag !== undefined) {
      return ok(cbor({ tag, value: itemResult.value }));
    }
    return err(PE.unknownTagName(name, tagSpan));
  }

  return err(PE.unmatchedParentheses(lexer.span()));
}

function parseArray(lexer: Lexer): ParseResult<Cbor> {
  const items: Cbor[] = [];
  let awaitsComma = false;
  let awaitsItem = false;

  while (true) {
    const tokenResult = expectToken(lexer);
    if (!tokenResult.ok) {
      return tokenResult;
    }

    const token = tokenResult.value;

    // Handle closing bracket
    if (token.type === "BracketClose" && !awaitsItem) {
      return ok(cbor(items));
    }

    // Handle comma
    if (token.type === "Comma" && awaitsComma) {
      awaitsItem = true;
      awaitsComma = false;
      continue;
    }

    // Expect an item when not awaiting comma
    if (awaitsComma) {
      return err(PE.expectedComma(lexer.span()));
    }

    // Parse the item
    const itemResult = parseItemToken(token, lexer);
    if (!itemResult.ok) {
      return itemResult;
    }

    items.push(itemResult.value);
    awaitsItem = false;
    awaitsComma = true;
  }
}

function parseMap(lexer: Lexer): ParseResult<Cbor> {
  const map = new CborMap();
  let awaitsComma = false;
  let awaitsKey = false;

  while (true) {
    const tokenResult = expectToken(lexer);
    if (!tokenResult.ok) {
      if (tokenResult.error.type === "UnexpectedEndOfInput") {
        return err(PE.unmatchedBraces(lexer.span()));
      }
      return tokenResult;
    }

    const token = tokenResult.value;

    // Handle closing brace
    if (token.type === "BraceClose" && !awaitsKey) {
      return ok(cbor(map));
    }

    // Handle comma
    if (token.type === "Comma" && awaitsComma) {
      awaitsKey = true;
      awaitsComma = false;
      continue;
    }

    // Expect a key when not awaiting comma
    if (awaitsComma) {
      return err(PE.expectedComma(lexer.span()));
    }

    // Parse the key
    const keyResult = parseItemToken(token, lexer);
    if (!keyResult.ok) {
      return keyResult;
    }

    const key = keyResult.value;
    const keySpan = lexer.span();

    // Check for duplicate key
    if (map.has(key)) {
      return err(PE.duplicateMapKey(keySpan));
    }

    // Expect colon
    const colonResult = expectToken(lexer);
    if (!colonResult.ok) {
      return colonResult;
    }

    if (colonResult.value.type !== "Colon") {
      return err(PE.expectedColon(lexer.span()));
    }

    // Parse the value
    const valueResult = parseItem(lexer);
    if (!valueResult.ok) {
      if (valueResult.error.type === "UnexpectedToken") {
        const unexpectedToken = (valueResult.error as { token: Token }).token;
        if (unexpectedToken.type === "BraceClose") {
          return err(PE.expectedMapKey(lexer.span()));
        }
      }
      return valueResult;
    }

    map.set(key, valueResult.value);
    awaitsKey = false;
    awaitsComma = true;
  }
}
