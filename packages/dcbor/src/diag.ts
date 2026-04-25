/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Enhanced diagnostic formatting for CBOR values.
 *
 * Provides multiple formatting options including
 * - Annotated diagnostics with tag names
 * - Summarized values using custom summarizers
 * - Flat (single-line) vs. pretty (multi-line) formatting
 * - Configurable tag store usage
 *
 * @module diag
 */

import { type Cbor, MajorType, type Simple } from "./cbor";
import { bytesToHex } from "./dump";
import type { CborMap } from "./map";
import { getGlobalTagsStore, type TagsStore } from "./tags-store";
import type { Tag } from "./tag";
import type { WalkElement } from "./walk";
import { flanked } from "./string-util";

/**
 * Options for diagnostic formatting.
 */
export interface DiagFormatOpts {
  /**
   * Add tag names as annotations.
   * When true, tagged values are displayed as "tagName(content)" instead of "tagValue(content)".
   *
   * @default false
   */
  annotate?: boolean;

  /**
   * Use custom summarizers for tagged values.
   * When true, calls registered summarizers for tagged values.
   *
   * @default false
   */
  summarize?: boolean;

  /**
   * Single-line (flat) output.
   * When true, arrays and maps are formatted without line breaks.
   *
   * @default false
   */
  flat?: boolean;

  /**
   * Tag store to use for tag name resolution.
   *
   * Mirrors Rust's `TagsStoreOpt<'a>` enum (`Custom(&'a dyn TagsStoreTrait)`,
   * `Global`, `None`). The TS port models the same three-way choice as a
   * string-literal union — semantically equivalent, just stringly-typed.
   *
   * - `TagsStore` instance: use this specific store (Rust `Custom`)
   * - `'global'`: use global singleton store (Rust `Global`)
   * - `'none'`: don't resolve names; print bare tag numbers (Rust `None`)
   *
   * @default 'global'
   */
  tags?: TagsStore | "global" | "none";

  /**
   * Current indentation level (internal use for recursion).
   * @internal
   */
  indent?: number;

  /**
   * Indentation string (spaces per level).
   * @internal
   */
  indentString?: string;
}

/**
 * Default formatting options.
 */
const DEFAULT_OPTS = {
  annotate: false,
  summarize: false,
  flat: false,
  tags: "global" as const,
  indent: 0,
  indentString: "    ", // 4 spaces to match Rust
} as const satisfies DiagFormatOpts;

/**
 * Format CBOR value as diagnostic notation with options.
 *
 * @param cbor - CBOR value to format
 * @param opts - Formatting options
 * @returns Diagnostic string
 *
 * @example
 * ```typescript
 * const value = cbor({ name: 'Alice', age: 30 });
 * console.log(diagnosticOpt(value, { flat: true }));
 * // {\"name\": \"Alice\", \"age\": 30}
 *
 * const tagged = createTaggedCbor({ ... });
 * console.log(diagnosticOpt(tagged, { annotate: true }));
 * // date(1234567890)
 * ```
 */
export function diagnosticOpt(cbor: Cbor, opts?: DiagFormatOpts): string {
  const options = { ...DEFAULT_OPTS, ...opts };
  // `summarize` implies `flat` per Rust `DiagFormatOpts::summarize`.
  if (options.summarize === true) options.flat = true;
  return diagFormat(diagItem(cbor, options), options);
}

/**
 * Format CBOR value as standard diagnostic notation.
 *
 * @param cbor - CBOR value to format
 * @returns Diagnostic string (pretty-printed with multiple lines for complex structures)
 *
 * @example
 * ```typescript
 * const value = cbor([1, 2, 3]);
 * console.log(diagnostic(value));
 * // For simple arrays: "[1, 2, 3]"
 * // For nested structures: multi-line formatted output
 * ```
 */
export function diagnostic(cbor: Cbor): string {
  return diagnosticOpt(cbor);
}

/**
 * Format CBOR value with tag name annotations.
 *
 * Tagged values are displayed with their registered names instead of numeric tags.
 *
 * @param cbor - CBOR value to format
 * @returns Annotated diagnostic string (pretty-printed format)
 *
 * @example
 * ```typescript
 * const date = CborDate.now().taggedCbor();
 * console.log(diagnosticAnnotated(date));
 * // date(1234567890) instead of 1(1234567890)
 * ```
 */
export function diagnosticAnnotated(cbor: Cbor): string {
  return diagnosticOpt(cbor, { annotate: true });
}

/**
 * Format CBOR value as flat (single-line) diagnostic notation.
 *
 * Arrays and maps are formatted without line breaks.
 *
 * @param cbor - CBOR value to format
 * @returns Flat diagnostic string
 *
 * @example
 * ```typescript
 * const nested = cbor([[1, 2], [3, 4]]);
 * console.log(diagnosticFlat(nested));
 * // "[[1, 2], [3, 4]]"
 * ```
 */
export function diagnosticFlat(cbor: Cbor): string;
// eslint-disable-next-line no-redeclare
export function diagnosticFlat(element: WalkElement): string;
// eslint-disable-next-line no-redeclare
export function diagnosticFlat(input: Cbor | WalkElement): string {
  // Check if it's a WalkElement by checking for 'type' property
  if (
    typeof input === "object" &&
    input !== null &&
    "type" in input &&
    (input.type === "single" || input.type === "keyvalue")
  ) {
    if (input.type === "single") {
      return diagnosticOpt(input.cbor, { flat: true });
    } else {
      return `${diagnosticOpt(input.key, { flat: true })}: ${diagnosticOpt(input.value, { flat: true })}`;
    }
  }
  // Otherwise treat as Cbor
  return diagnosticOpt(input, { flat: true });
}

/**
 * Format CBOR value using custom summarizers for tagged values.
 *
 * If a summarizer is registered for a tagged value, uses that instead of
 * showing the full content.
 *
 * @param cbor - CBOR value to format
 * @returns Summarized diagnostic string
 *
 * @example
 * ```typescript
 * // If a summarizer is registered for tag 123:
 * const tagged = cbor({ type: MajorType.Tagged, tag: 123, value: ... });
 * console.log(summary(tagged));
 * // "custom-summary" (instead of full content)
 * ```
 */
export function summary(cbor: Cbor): string {
  return diagnosticOpt(cbor, { summarize: true, flat: true });
}

// =====================================================================
// DiagItem AST
//
// Mirrors Rust `DiagItem` enum in `bc-dcbor-rust/src/diag.rs`. Building an
// AST first lets the formatter use Rust-identical multi-line heuristics
// (`contains_group || total_strings_len > 20 || greatest_strings_len > 20`)
// rather than ad-hoc thresholds applied at recursion time.
// =====================================================================

type DiagItem = DiagItemNode | DiagItemGroup;

interface DiagItemNode {
  kind: "item";
  value: string;
}

interface DiagItemGroup {
  kind: "group";
  begin: string;
  end: string;
  items: DiagItem[];
  /** True for maps (`{...}`) — items alternate key, value. */
  isPairs: boolean;
  /** Optional comment rendered as `   / comment /` after the line. */
  comment?: string;
}

const item = (value: string): DiagItemNode => ({ kind: "item", value });

const group = (
  begin: string,
  end: string,
  items: DiagItem[],
  isPairs: boolean,
  comment?: string,
): DiagItemGroup => {
  const g: DiagItemGroup = { kind: "group", begin, end, items, isPairs };
  if (comment !== undefined) g.comment = comment;
  return g;
};

const isGroup = (i: DiagItem): boolean => i.kind === "group";

const containsGroup = (i: DiagItem): boolean =>
  i.kind === "group" && i.items.some(isGroup);

const totalStringsLen = (i: DiagItem): number =>
  i.kind === "item" ? i.value.length : i.items.reduce((acc, c) => acc + totalStringsLen(c), 0);

const greatestStringsLen = (i: DiagItem): number =>
  i.kind === "item"
    ? i.value.length
    : i.items.reduce((acc, c) => Math.max(acc, totalStringsLen(c)), 0);

/**
 * Mirrors Rust `DiagItem::joined`: alternates between `pairSeparator`
 * (after even-indexed items — keys) and `itemSeparator` (after odd-indexed
 * items — values). Falls back to `itemSeparator` for non-pair groups.
 */
function joined(elements: string[], itemSeparator: string, pairSeparator?: string): string {
  const sep = pairSeparator ?? itemSeparator;
  let result = "";
  const len = elements.length;
  for (let i = 0; i < len; i++) {
    result += elements[i];
    if (i !== len - 1) {
      result += (i & 1) !== 0 ? itemSeparator : sep;
    }
  }
  return result;
}

const diagFormat = (i: DiagItem, opts: DiagFormatOpts): string =>
  diagFormatOpt(i, 0, "", opts);

function diagFormatOpt(i: DiagItem, level: number, separator: string, opts: DiagFormatOpts): string {
  if (i.kind === "item") {
    return formatLine(level, opts, i.value, separator, undefined);
  }
  if (
    opts.flat !== true &&
    (containsGroup(i) || totalStringsLen(i) > 20 || greatestStringsLen(i) > 20)
  ) {
    return multilineComposition(i, level, separator, opts);
  }
  return singleLineComposition(i, level, separator, opts);
}

function formatLine(
  level: number,
  opts: DiagFormatOpts,
  string: string,
  separator: string,
  comment: string | undefined,
): string {
  const indent = opts.flat === true ? "" : " ".repeat(level * 4);
  const result = `${indent}${string}${separator}`;
  if (comment !== undefined) {
    return `${result}   / ${comment} /`;
  }
  return result;
}

function singleLineComposition(
  i: DiagItem,
  level: number,
  separator: string,
  opts: DiagFormatOpts,
): string {
  let str: string;
  let comment: string | undefined;
  if (i.kind === "item") {
    str = i.value;
    comment = undefined;
  } else {
    const components = i.items.map((c) =>
      c.kind === "item" ? c.value : singleLineComposition(c, level + 1, separator, opts),
    );
    const pairSeparator = i.isPairs ? ": " : ", ";
    str = flanked(joined(components, ", ", pairSeparator), i.begin, i.end);
    comment = i.comment;
  }
  return formatLine(level, opts, str, separator, comment);
}

function multilineComposition(
  i: DiagItem,
  level: number,
  separator: string,
  opts: DiagFormatOpts,
): string {
  if (i.kind === "item") return i.value;
  const lines: string[] = [];
  // Opening line: print `begin` (with comment) at this level, never flat.
  const openOpts: DiagFormatOpts = { ...opts, flat: false };
  lines.push(formatLine(level, openOpts, i.begin, "", i.comment));
  for (let idx = 0; idx < i.items.length; idx++) {
    const sep =
      idx === i.items.length - 1
        ? ""
        : i.isPairs && (idx & 1) === 0
          ? ":"
          : ",";
    lines.push(diagFormatOpt(i.items[idx], level + 1, sep, opts));
  }
  // Closing line: print `end` at the parent level, with the outer separator.
  lines.push(formatLine(level, opts, i.end, separator, undefined));
  return lines.join("\n");
}

// =====================================================================
// AST construction (`diag_item` in Rust)
// =====================================================================

function diagItem(cbor: Cbor, opts: DiagFormatOpts): DiagItem {
  switch (cbor.type) {
    case MajorType.Unsigned:
      return item(formatUnsigned(cbor.value));
    case MajorType.Negative:
      return item(formatNegative(cbor.value));
    case MajorType.ByteString:
      return item(formatBytes(cbor.value));
    case MajorType.Text:
      return item(formatText(cbor.value));
    case MajorType.Array:
      return item_array(cbor.value, opts);
    case MajorType.Map:
      return item_map(cbor.value, opts);
    case MajorType.Tagged:
      return item_tagged(cbor.tag, cbor.value, opts);
    case MajorType.Simple:
      return item(formatSimple(cbor.value));
  }
}

function item_array(items: readonly Cbor[], opts: DiagFormatOpts): DiagItem {
  return group(
    "[",
    "]",
    items.map((it) => diagItem(it, opts)),
    false,
  );
}

function item_map(map: CborMap, opts: DiagFormatOpts): DiagItem {
  const entries = map?.entriesArray ?? [];
  const flatItems: DiagItem[] = [];
  for (const e of entries) {
    flatItems.push(diagItem(e.key, opts));
    flatItems.push(diagItem(e.value, opts));
  }
  return group("{", "}", flatItems, true);
}

function item_tagged(tag: number | bigint, content: Cbor, opts: DiagFormatOpts): DiagItem {
  // Summarizer path — matches Rust's summarization branch.
  if (opts.summarize === true) {
    const store = resolveTagsStore(opts.tags);
    const summarizer = store?.summarizer(tag);
    if (summarizer !== undefined) {
      const result = summarizer(content, opts.flat ?? false);
      if (result.ok) {
        return item(result.value);
      }
      const errorMsg =
        result.error.type === "Custom"
          ? result.error.message
          : result.error.type === "WrongTag"
            ? `expected CBOR tag ${result.error.expected.value}, but got ${result.error.actual.value}`
            : result.error.type;
      return item(`<error: ${errorMsg}>`);
    }
  }

  let comment: string | undefined;
  if (opts.annotate === true) {
    const store = resolveTagsStore(opts.tags);
    const tagObj: Tag = { value: tag };
    const assignedName = store?.assignedNameForTag(tagObj);
    if (assignedName !== undefined) {
      comment = assignedName;
    }
  }

  return group(`${String(tag)}(`, ")", [diagItem(content, opts)], false, comment);
}

// Primitive formatters reused by both single- and multi-line paths.
function formatUnsigned(value: number | bigint): string {
  return String(value);
}

function formatNegative(value: number | bigint): string {
  if (typeof value === "bigint") return String(-value - 1n);
  return String(-value - 1);
}

function formatBytes(value: Uint8Array): string {
  return `h'${bytesToHex(value)}'`;
}

function formatText(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

function formatSimple(value: Simple): string {
  switch (value.type) {
    case "True":
      return "true";
    case "False":
      return "false";
    case "Null":
      return "null";
    case "Float":
      return formatFloat(value.value);
  }
}

/**
 * Format a finite CBOR float to match Rust `Simple::format!("{:?}", v)`.
 *
 * - `1.0` → `"1.0"` (Rust Debug). JS `String(1.0)` gives `"1"` so we append `.0`.
 * - `1.5` → `"1.5"`.
 * - `1e100` → `"1e100"` (Rust uses no `+` sign in the exponent). JS uses `1e+100`.
 * - Specials (NaN / ±Infinity) produce the exact Rust strings.
 */
function formatFloat(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
  let str = String(value);
  // Strip the JS-only `+` in scientific exponents to match Rust Debug format.
  str = str.replace(/e\+/, "e");
  if (!str.includes(".") && !str.includes("e")) {
    str = `${str}.0`;
  }
  return str;
}

function resolveTagsStore(tags?: TagsStore | "global" | "none"): TagsStore | undefined {
  if (tags === "none") return undefined;
  if (tags === "global" || tags === undefined) return getGlobalTagsStore();
  return tags;
}
