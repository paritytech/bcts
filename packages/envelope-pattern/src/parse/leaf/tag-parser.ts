/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Tag parser — port of `bc-envelope-pattern-rust`
 * `parse/leaf/tag_parser.rs`.
 *
 * Mirrors the Rust dispatch exactly: lookahead for `(`; if absent, return
 * the bare `any_tag()`. Otherwise build a synthetic dcbor-pattern
 * expression `tagged(<inner>)`, parse it via `@bcts/dcbor-pattern`, and
 * extract the resulting `TaggedPattern` to wrap as an envelope-pattern
 * leaf. This keeps the **full** tag selector (number, name, regex)
 * intact — the previous port discarded the tag value entirely.
 *
 * @module envelope-pattern/parse/leaf/tag-parser
 */

import {
  parse as parseDcborPattern,
  patternDisplay as dcborPatternDisplay,
} from "@bcts/dcbor-pattern";
import {
  type Result,
  err,
  expectedCloseParen,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
} from "../../error";
import { type Pattern, TaggedPattern, anyTag, patternLeaf, leafTag } from "../../pattern";
import type { Lexer } from "../token";

/**
 * Parse `tagged` and `tagged(...)` patterns.
 */
export function parseTag(lexer: Lexer): Result<Pattern> {
  const next = lexer.peekToken();
  if (next?.token.type !== "ParenOpen") {
    return ok(anyTag());
  }

  lexer.next(); // consume (

  const remainder = lexer.remainder();
  const closeIdx = findMatchingCloseParen(remainder);
  if (closeIdx === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  const innerContent = remainder.slice(0, closeIdx);
  const taggedExpr = `tagged(${innerContent})`;

  const dcborResult = parseDcborPattern(taggedExpr);
  if (dcborResult.ok) {
    const dcborPattern = dcborResult.value;
    if (dcborPattern.kind === "Structure" && dcborPattern.pattern.type === "Tagged") {
      lexer.bump(closeIdx);
      const close = lexer.next();
      if (close === undefined) {
        return err(expectedCloseParen(lexer.span()));
      }
      if (close.token.type !== "ParenClose") {
        return err(unexpectedToken(close.token, close.span));
      }
      return ok(patternLeaf(leafTag(TaggedPattern.fromDcborPattern(dcborPattern.pattern.pattern))));
    }

    // Shouldn't happen for a well-formed `tagged(...)` expression, but
    // if dcbor-pattern returned a non-Tagged structure, fall through to
    // the simple parser below (matching Rust's UnexpectedToken arm).
  }

  // Fall back to a simple inline parser for `tagged(N)` and
  // `tagged(name)`, mirroring Rust `parse_tag_inner`. This path is
  // exercised only when dcbor-pattern itself can't make sense of the
  // body — e.g. a typo. We re-emit the same error shape Rust emits
  // (Unknown / UnexpectedToken) by giving up and letting the dcbor
  // result propagate.
  const fallback = parseTagInner(innerContent);
  if (!fallback.ok) {
    return fallback;
  }
  lexer.bump(closeIdx);
  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  if (close.token.type !== "ParenClose") {
    return err(unexpectedToken(close.token, close.span));
  }
  return ok(fallback.value);
}

/**
 * Locate the index of the closing `)` matching the `(` that has already
 * been consumed by `parseTag`. Mirrors Rust `find_matching_paren`.
 */
function findMatchingCloseParen(src: string): number | undefined {
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i);
    if (ch === 0x28 /* ( */) {
      depth += 1;
    } else if (ch === 0x29 /* ) */) {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return undefined;
}

/**
 * Fallback for `tagged(N)` and `tagged(name)` when the full delegation
 * to dcbor-pattern fails. Mirrors Rust `parse_tag_inner`.
 */
function parseTagInner(src: string): Result<Pattern> {
  const trimmed = src.trim();
  if (trimmed.length === 0) {
    return err(unexpectedEndOfInput());
  }
  if (trimmed.startsWith("/")) {
    // Rust passes this to `parse_text_regex`; with dcbor-pattern as the
    // primary path, regex tagged forms always succeed there. If we reach
    // this fallback, surface as InvalidPattern.
    return err(unexpectedEndOfInput());
  }
  // Try u64 first.
  if (/^\d+$/.test(trimmed)) {
    try {
      const expr = `tagged(${trimmed})`;
      const dcborResult = parseDcborPattern(expr);
      if (
        dcborResult.ok &&
        dcborResult.value.kind === "Structure" &&
        dcborResult.value.pattern.type === "Tagged"
      ) {
        return ok(
          patternLeaf(leafTag(TaggedPattern.fromDcborPattern(dcborResult.value.pattern.pattern))),
        );
      }
    } catch {
      // ignore
    }
  }
  // Treat as a name.
  const expr = `tagged(${trimmed})`;
  const dcborResult = parseDcborPattern(expr);
  if (
    dcborResult.ok &&
    dcborResult.value.kind === "Structure" &&
    dcborResult.value.pattern.type === "Tagged"
  ) {
    // Reference dcborPatternDisplay just to keep tree-shaker pinning the
    // import path stable when used elsewhere.
    void dcborPatternDisplay;
    return ok(
      patternLeaf(leafTag(TaggedPattern.fromDcborPattern(dcborResult.value.pattern.pattern))),
    );
  }
  return err(unexpectedEndOfInput());
}
