/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 * Date content parser — port of `bc-envelope-pattern-rust`
 * `parse/leaf/date_parser.rs`.
 *
 * Mirrors Rust's `Date::from_string`, which accepts a strict ISO-8601
 * subset, by deferring to dcbor's `CborDate.fromString`. Falls back to JS
 * `Date.parse` only as a defensive shim — that branch is unreachable for
 * conformant inputs.
 *
 * @module envelope-pattern/parse/leaf/date-parser
 */

import { CborDate } from "@bcts/dcbor";
import {
  type Result,
  type Span,
  err,
  invalidDateFormat,
  invalidRegex,
  ok,
} from "../../error";
import {
  type Pattern,
  date,
  dateEarliest,
  dateLatest,
  dateRange,
  dateRegex,
} from "../../pattern";

/**
 * Parse a date pattern of one of the forms accepted by Rust:
 *
 * - `/regex/` (regex match against ISO-8601 string)
 * - `start...end` (inclusive range)
 * - `start...` (earliest)
 * - `...end` (latest)
 * - `iso-8601` (exact)
 *
 * Mirrors `parse_date_content` in Rust; uses `CborDate.fromString` so the
 * accepted formats match Rust's `bc_envelope::prelude::Date::from_string`
 * exactly rather than the looser JS `Date.parse`.
 */
export function parseDateContent(content: string, span: Span): Result<Pattern> {
  // Regex form: /pattern/
  if (content.startsWith("/") && content.endsWith("/") && content.length >= 2) {
    const regexStr = content.slice(1, -1);
    try {
      return ok(dateRegex(new RegExp(regexStr)));
    } catch {
      return err(invalidRegex(span));
    }
  }

  const ellipsisIdx = content.indexOf("...");
  if (ellipsisIdx !== -1) {
    const left = content.slice(0, ellipsisIdx);
    const right = content.slice(ellipsisIdx + 3);

    if (left.length === 0 && right.length > 0) {
      const parsed = parseIsoDateStrict(right);
      if (parsed === undefined) return err(invalidDateFormat(span));
      return ok(dateLatest(parsed));
    }
    if (left.length > 0 && right.length === 0) {
      const parsed = parseIsoDateStrict(left);
      if (parsed === undefined) return err(invalidDateFormat(span));
      return ok(dateEarliest(parsed));
    }
    if (left.length > 0 && right.length > 0) {
      const start = parseIsoDateStrict(left);
      const end = parseIsoDateStrict(right);
      if (start === undefined || end === undefined) return err(invalidDateFormat(span));
      return ok(dateRange(start, end));
    }
    return err(invalidDateFormat(span));
  }

  const parsed = parseIsoDateStrict(content);
  if (parsed === undefined) {
    return err(invalidDateFormat(span));
  }
  return ok(date(parsed));
}

function parseIsoDateStrict(value: string): CborDate | undefined {
  try {
    return CborDate.fromString(value);
  } catch {
    return undefined;
  }
}
