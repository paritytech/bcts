/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Digest parser — port of `bc-envelope-pattern-rust`
 * `parse/structure/digest_parser.rs`.
 *
 * Mirrors Rust exactly:
 *
 * - Requires `digest(...)` — bare `digest` is an `UnexpectedEndOfInput`
 *   error (the previous TS port silently returned `digest(any)`).
 * - Inside the parens, accepts either a UR string (`ur:digest/...`,
 *   parsed via `Digest.fromURString`) or a hex byte prefix.
 * - Hex prefixes must have even length and not exceed `Digest.DIGEST_SIZE`
 *   bytes; otherwise the parser surfaces `InvalidHexString`.
 *
 * @module envelope-pattern/parse/structure/digest-parser
 */

import { Digest } from "@bcts/envelope";
import {
  type Result,
  err,
  expectedCloseParen,
  invalidHexString,
  invalidUr,
  ok,
  unexpectedEndOfInput,
  unexpectedToken,
} from "../../error";
import { type Pattern, digest, digestPrefix } from "../../pattern";
import type { Lexer } from "../token";

const DIGEST_SIZE = Digest.DIGEST_SIZE;

export function parseDigest(lexer: Lexer): Result<Pattern> {
  const open = lexer.next();
  if (open === undefined) {
    return err(unexpectedEndOfInput());
  }
  if (open.token.type !== "ParenOpen") {
    return err(unexpectedToken(open.token, open.span));
  }

  const remainder = lexer.remainder();
  const innerResult = parseDigestInner(remainder, lexer.position);
  if (!innerResult.ok) return innerResult;
  const [pattern, consumed] = innerResult.value;
  lexer.bump(consumed);

  const close = lexer.next();
  if (close === undefined) {
    return err(expectedCloseParen(lexer.span()));
  }
  if (close.token.type !== "ParenClose") {
    return err(unexpectedToken(close.token, close.span));
  }
  return ok(pattern);
}

function parseDigestInner(src: string, basePos: number): Result<[Pattern, number]> {
  let pos = 0;
  pos = skipWs(src, pos);

  if (src.startsWith("ur:", pos)) {
    const start = pos;
    while (pos < src.length && src[pos] !== ")") {
      pos += 1;
    }
    const ur = src.slice(start, pos).trimEnd();
    let parsed: Digest;
    try {
      parsed = Digest.fromURString(ur);
    } catch {
      return err(invalidUr(ur, { start: basePos + start, end: basePos + pos }));
    }
    pos = skipWs(src, pos);
    return ok([digest(parsed), pos]);
  }

  const start = pos;
  while (pos < src.length && isAsciiHexDigit(src.charCodeAt(pos))) {
    pos += 1;
  }
  if (pos === start) {
    return err(invalidHexString({ start: basePos + pos, end: basePos + pos }));
  }
  const hexStr = src.slice(start, pos);
  if (hexStr.length % 2 !== 0) {
    return err(invalidHexString({ start: basePos + pos, end: basePos + pos }));
  }
  const bytes = decodeHex(hexStr);
  if (bytes === undefined) {
    return err(invalidHexString({ start: basePos + pos, end: basePos + pos }));
  }
  if (bytes.length > DIGEST_SIZE) {
    return err(invalidHexString({ start: basePos + pos, end: basePos + pos }));
  }
  pos = skipWs(src, pos);
  return ok([digestPrefix(bytes), pos]);
}

function skipWs(src: string, pos: number): number {
  while (pos < src.length) {
    const ch = src[pos];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
      pos += 1;
    } else {
      break;
    }
  }
  return pos;
}

function isAsciiHexDigit(c: number): boolean {
  return (
    (c >= 0x30 && c <= 0x39) /* 0-9 */ ||
    (c >= 0x41 && c <= 0x46) /* A-F */ ||
    (c >= 0x61 && c <= 0x66) /* a-f */
  );
}

function decodeHex(hex: string): Uint8Array | undefined {
  if (hex.length % 2 !== 0) return undefined;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const value = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(value)) return undefined;
    out[i / 2] = value;
  }
  return out;
}
