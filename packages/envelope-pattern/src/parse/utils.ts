/**
 * @bcts/envelope-pattern - Parser utility functions
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust utils.rs
 *
 * @module envelope-pattern/parse/utils
 */

import type { Cbor } from "@bcts/dcbor";
import { type Pattern as DCBORPattern, parse as parseDcborPattern } from "@bcts/dcbor-pattern";

// Stub for cborFromDiagnostic - not implemented in dcbor yet
function cborFromDiagnostic(_src: string): { ok: false } {
  // TODO: Implement when dcbor adds diagnostic notation parsing
  return { ok: false };
}
import {
  type Result,
  ok,
  err,
  unterminatedRegex,
  invalidRegex,
  invalidRange,
  invalidNumberFormat,
  unexpectedEndOfInput,
  invalidPattern,
  unknown,
} from "../error";
import type { Pattern } from "../pattern";

// Forward declaration - will be imported from pattern module
// Using a registry pattern to avoid circular dependencies
let createCborPattern: ((cbor: Cbor) => Pattern) | undefined;
let createCborPatternFromDcbor: ((pattern: DCBORPattern) => Pattern) | undefined;
let createAnyArray: (() => Pattern) | undefined;
let createArrayWithCount: ((count: number) => Pattern) | undefined;
let createArrayWithRange: ((min: number, max?: number) => Pattern) | undefined;
let createArrayFromDcborPattern: ((pattern: DCBORPattern) => Pattern) | undefined;

/**
 * Register pattern factory functions.
 * This is called by the pattern module to avoid circular dependencies.
 */
export function registerPatternFactories(factories: {
  cborPattern: (cbor: Cbor) => Pattern;
  cborPatternFromDcbor: (pattern: DCBORPattern) => Pattern;
  anyArray: () => Pattern;
  arrayWithCount: (count: number) => Pattern;
  arrayWithRange: (min: number, max?: number) => Pattern;
  arrayFromDcborPattern: (pattern: DCBORPattern) => Pattern;
}): void {
  createCborPattern = factories.cborPattern;
  createCborPatternFromDcbor = factories.cborPatternFromDcbor;
  createAnyArray = factories.anyArray;
  createArrayWithCount = factories.arrayWithCount;
  createArrayWithRange = factories.arrayWithRange;
  createArrayFromDcborPattern = factories.arrayFromDcborPattern;
}

/**
 * Skips whitespace in the source string.
 *
 * @param src - The source string
 * @param pos - The current position (modified in place)
 */
export function skipWs(src: string, pos: { value: number }): void {
  while (pos.value < src.length) {
    const ch = src[pos.value];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f") {
      pos.value++;
    } else {
      break;
    }
  }
}

/**
 * Parses a text regex from the source.
 *
 * @param src - The source string (starting after initial whitespace)
 * @returns The parsed regex and consumed character count, or an error
 */
export function parseTextRegex(src: string): Result<[RegExp, number]> {
  const pos = { value: 0 };
  skipWs(src, pos);

  if (pos.value >= src.length || src[pos.value] !== "/") {
    return err(unterminatedRegex({ start: pos.value, end: pos.value }));
  }
  pos.value++; // skip opening '/'

  const start = pos.value;
  let escape = false;

  while (pos.value < src.length) {
    const b = src[pos.value];
    pos.value++;

    if (escape) {
      escape = false;
      continue;
    }

    if (b === "\\") {
      escape = true;
      continue;
    }

    if (b === "/") {
      const inner = src.slice(start, pos.value - 1);
      try {
        const regex = new RegExp(inner);
        skipWs(src, pos);
        return ok([regex, pos.value]);
      } catch {
        return err(invalidRegex({ start: pos.value, end: pos.value }));
      }
    }
  }

  return err(unterminatedRegex({ start: pos.value, end: pos.value }));
}

/**
 * Parses a CBOR value or dcbor-pattern expression.
 *
 * @param src - The source string
 * @returns The parsed pattern and consumed character count, or an error
 */
export function parseCborInner(src: string): Result<[Pattern, number]> {
  if (createCborPattern === undefined || createCborPatternFromDcbor === undefined) {
    return err(unknown());
  }

  const pos = { value: 0 };
  skipWs(src, pos);

  // Check if this is a dcbor-pattern expression (/patex/)
  if (src[pos.value] === "/") {
    pos.value++; // skip opening '/'
    const start = pos.value;
    let escape = false;

    // Find the closing '/'
    while (pos.value < src.length) {
      const b = src[pos.value];
      pos.value++;

      if (escape) {
        escape = false;
        continue;
      }

      if (b === "\\") {
        escape = true;
        continue;
      }

      if (b === "/") {
        const patternStr = src.slice(start, pos.value - 1);

        // Parse the dcbor-pattern expression
        const parseResult = parseDcborPattern(patternStr);
        if (!parseResult.ok) {
          return err(invalidPattern({ start, end: pos.value - 1 }));
        }

        skipWs(src, pos);
        return ok([createCborPatternFromDcbor(parseResult.value), pos.value]);
      }
    }

    return err(unterminatedRegex({ start: start - 1, end: pos.value }));
  }

  // Check if this is a UR (ur:type/value)
  if (src.slice(pos.value, pos.value + 3) === "ur:") {
    // For now, parse as CBOR diagnostic notation
    // TODO: Add proper UR parsing when available
  }

  // Default: parse as CBOR diagnostic notation
  const remaining = src.slice(pos.value);
  const cborResult = cborFromDiagnostic(remaining);
  if (!cborResult.ok) {
    return err(unknown());
  }

  // Count consumed characters (approximation - full string was consumed)
  const consumed = remaining.length;
  return ok([createCborPattern(cborResult.value), pos.value + consumed]);
}

/**
 * Parses an array pattern inner content.
 *
 * @param src - The source string (content between [ and ])
 * @returns The parsed pattern and consumed character count, or an error
 */
export function parseArrayInner(src: string): Result<[Pattern, number]> {
  if (
    createAnyArray === undefined ||
    createArrayWithCount === undefined ||
    createArrayWithRange === undefined ||
    createArrayFromDcborPattern === undefined
  ) {
    return err(unknown());
  }

  const pos = { value: 0 };
  skipWs(src, pos);

  // Check for the simple "*" pattern first - matches any array
  if (src[pos.value] === "*") {
    pos.value++;
    skipWs(src, pos);
    return ok([createAnyArray(), pos.value]);
  }

  // Check for length patterns like {n}, {n,m}, {n,}
  if (src[pos.value] === "{") {
    pos.value++;
    skipWs(src, pos);

    // Parse the first number
    const startPos = pos.value;
    while (pos.value < src.length && src[pos.value] !== undefined && /\d/.test(src[pos.value]!)) {
      pos.value++;
    }
    if (startPos === pos.value) {
      return err(invalidRange({ start: pos.value, end: pos.value }));
    }

    const firstNum = parseInt(src.slice(startPos, pos.value), 10);
    if (Number.isNaN(firstNum)) {
      return err(invalidNumberFormat({ start: startPos, end: pos.value }));
    }

    skipWs(src, pos);

    if (pos.value >= src.length) {
      return err(unexpectedEndOfInput());
    }

    const ch = src[pos.value];

    if (ch === "}") {
      // {n} - exact count
      pos.value++;
      skipWs(src, pos);
      return ok([createArrayWithCount(firstNum), pos.value]);
    }

    if (ch === ",") {
      pos.value++;
      skipWs(src, pos);

      if (pos.value >= src.length) {
        return err(unexpectedEndOfInput());
      }

      const nextCh = src[pos.value];

      if (nextCh === "}") {
        // {n,} - at least n
        pos.value++;
        skipWs(src, pos);
        return ok([createArrayWithRange(firstNum, undefined), pos.value]);
      }

      if (nextCh !== undefined && /\d/.test(nextCh)) {
        // {n,m} - range
        const secondStart = pos.value;
        while (pos.value < src.length && src[pos.value] !== undefined && /\d/.test(src[pos.value]!)) {
          pos.value++;
        }
        const secondNum = parseInt(src.slice(secondStart, pos.value), 10);
        if (Number.isNaN(secondNum)) {
          return err(invalidNumberFormat({ start: secondStart, end: pos.value }));
        }

        skipWs(src, pos);
        if (pos.value >= src.length || src[pos.value] !== "}") {
          return err(unexpectedEndOfInput());
        }
        pos.value++;
        skipWs(src, pos);
        return ok([createArrayWithRange(firstNum, secondNum), pos.value]);
      }

      return err(invalidRange({ start: pos.value, end: pos.value }));
    }

    return err(invalidRange({ start: pos.value, end: pos.value }));
  }

  // For any other pattern content, delegate to dcbor-pattern
  const patternStr = `[${src.slice(pos.value)}]`;
  const parseResult = parseDcborPattern(patternStr);
  if (!parseResult.ok) {
    return err(invalidPattern({ start: pos.value, end: src.length }));
  }

  // Create an array pattern that wraps the dcbor-pattern
  const consumed = src.length - pos.value;
  return ok([createArrayFromDcborPattern(parseResult.value), consumed]);
}

/**
 * Parses a bare word (identifier-like token).
 *
 * @param src - The source string
 * @returns The parsed word and consumed character count, or an error
 */
export function parseBareWord(src: string): Result<[string, number]> {
  const pos = { value: 0 };
  skipWs(src, pos);

  const start = pos.value;
  while (pos.value < src.length) {
    const ch = src[pos.value];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === ")") {
      break;
    }
    pos.value++;
  }

  if (start === pos.value) {
    return err(unexpectedEndOfInput());
  }

  const word = src.slice(start, pos.value);
  skipWs(src, pos);
  return ok([word, pos.value]);
}
