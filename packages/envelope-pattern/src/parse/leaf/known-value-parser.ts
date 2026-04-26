/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Helpers for parsing the body of a `'…'` (single-quoted) known-value
 * literal. Mirrors the inline body of Rust's `Token::SingleQuotedPattern`
 * branch in `parse_primary`:
 *
 * - If the contents are a valid `u64`, build `Pattern::known_value(...)`.
 * - Otherwise, build `Pattern::known_value_named(...)`.
 *
 * The earlier port duck-typed a fake `KnownValue`; this version uses the
 * real `KnownValue` constructor so all subsequent KnownValue methods work
 * (e.g., `taggedCbor()`, `name()`, etc.).
 *
 * @module envelope-pattern/parse/leaf/known-value-parser
 */

import { KnownValue } from "@bcts/known-values";
import { type Result, ok } from "../../error";
import {
  type Pattern,
  KnownValuePattern,
  knownValue,
  leafKnownValue,
  patternLeaf,
} from "../../pattern";

/**
 * Maximum value of a Rust `u64`. Used to reject literals that would
 * silently wrap or lose precision when constructing a `KnownValue`.
 */
const U64_MAX = 0xffffffffffffffffn;

/**
 * Parse the inner contents of a `'…'` known-value pattern token.
 *
 * Mirrors the Rust dispatch
 * ```ignore
 * if let Ok(value) = content.parse::<u64>() {
 *     Pattern::known_value(KnownValue::new(value))
 * } else {
 *     Pattern::known_value_named(content)
 * }
 * ```
 * but uses BigInt parsing to preserve full `u64` range — the previous
 * `parseInt(...)` path silently truncated above `2^53-1`.
 */
export function parseKnownValueContent(content: string): Result<Pattern> {
  if (isU64Literal(content)) {
    const value = BigInt(content);
    return ok(knownValue(new KnownValue(value)));
  }
  return ok(patternLeaf(leafKnownValue(KnownValuePattern.named(content))));
}

function isU64Literal(content: string): boolean {
  if (content.length === 0) return false;
  // Rust's `u64::from_str_radix(s, 10)` (used by `parse::<u64>`) accepts
  // ASCII digits only — no leading sign, whitespace, or underscores —
  // and tolerates leading zeros. Anything else falls back to a named
  // KnownValue.
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    if (c < 0x30 || c > 0x39) return false;
  }
  try {
    const value = BigInt(content);
    return value >= 0n && value <= U64_MAX;
  } catch {
    return false;
  }
}
