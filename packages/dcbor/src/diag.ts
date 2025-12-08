/**
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
   * - TagsStore instance: Use specific store
   * - 'global': Use global singleton store
   * - 'none': Don't use any store (show tag numbers)
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
  return formatDiagnostic(cbor, options);
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
    const element = input as WalkElement;
    if (element.type === "single") {
      return diagnosticOpt(element.cbor, { flat: true });
    } else {
      return `${diagnosticOpt(element.key, { flat: true })}: ${diagnosticOpt(element.value, { flat: true })}`;
    }
  }
  // Otherwise treat as Cbor
  return diagnosticOpt(input as Cbor, { flat: true });
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

/**
 * Internal recursive formatter.
 *
 * @internal
 */
function formatDiagnostic(cbor: Cbor, opts: DiagFormatOpts): string {
  switch (cbor.type) {
    case MajorType.Unsigned:
      return formatUnsigned(cbor.value);

    case MajorType.Negative:
      return formatNegative(cbor.value);

    case MajorType.ByteString:
      return formatBytes(cbor.value);

    case MajorType.Text:
      return formatText(cbor.value);

    case MajorType.Array:
      return formatArray(cbor.value, opts);

    case MajorType.Map:
      return formatMap(cbor.value, opts);

    case MajorType.Tagged:
      return formatTagged(cbor.tag, cbor.value, opts);

    case MajorType.Simple:
      return formatSimple(cbor.value);
  }
}

/**
 * Format unsigned integer.
 */
function formatUnsigned(value: number | bigint): string {
  return String(value);
}

/**
 * Format negative integer.
 */
function formatNegative(value: number | bigint): string {
  // Value is stored as magnitude, convert to actual negative value for display
  if (typeof value === "bigint") {
    return String(-value - 1n);
  } else {
    return String(-value - 1);
  }
}

/**
 * Format byte string.
 */
function formatBytes(value: Uint8Array): string {
  return `h'${bytesToHex(value)}'`;
}

/**
 * Format text string.
 */
function formatText(value: string): string {
  // Escape special characters
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

/**
 * Format array.
 */
function formatArray(items: readonly Cbor[], opts: DiagFormatOpts): string {
  if (items.length === 0) {
    return "[]";
  }

  // Format items first to check their lengths
  const formatted = items.map((item) => formatDiagnostic(item, opts));

  // Decide between single-line and multi-line based on complexity
  const shouldUseMultiLine =
    opts.flat !== true &&
    (containsComplexStructure(items) ||
      formatted.join(", ").length > 20 ||
      formatted.some((s) => s.length > 20));

  if (shouldUseMultiLine) {
    // Multi-line formatting
    const indent = opts.indent ?? 0;
    const indentStr = (opts.indentString ?? "    ").repeat(indent);
    const itemIndentStr = (opts.indentString ?? "    ").repeat(indent + 1);

    const formattedWithIndent = items.map((item) => {
      const childOpts = { ...opts, indent: indent + 1 };
      const itemStr = formatDiagnostic(item, childOpts);
      return `${itemIndentStr}${itemStr}`;
    });

    return `[\n${formattedWithIndent.join(",\n")}\n${indentStr}]`;
  } else {
    // Single-line formatting
    return `[${formatted.join(", ")}]`;
  }
}

/**
 * Check if items contain complex structures (arrays or maps).
 */
function containsComplexStructure(items: readonly Cbor[]): boolean {
  return items.some((item) => item.type === MajorType.Array || item.type === MajorType.Map);
}

/**
 * Format map.
 */
function formatMap(map: CborMap, opts: DiagFormatOpts): string {
  // Extract entries from CborMap or use empty array
  const entries = map?.entriesArray ?? [];

  if (entries.length === 0) {
    return "{}";
  }

  interface FormattedPair {
    key: string;
    value: string;
  }

  // Format each key-value pair
  const formattedPairs: FormattedPair[] = entries.map((entry: { key: Cbor; value: Cbor }) => ({
    key: formatDiagnostic(entry.key, opts),
    value: formatDiagnostic(entry.value, opts),
  }));

  // Decide between single-line and multi-line based on complexity
  const totalLength = formattedPairs.reduce(
    (sum: number, pair: FormattedPair) => sum + pair.key.length + pair.value.length + 2,
    0,
  ); // +2 for ": "

  const shouldUseMultiLine =
    opts.flat !== true &&
    (entries.some(
      (e: { key: Cbor; value: Cbor }) =>
        e.key.type === MajorType.Array ||
        e.key.type === MajorType.Map ||
        e.value.type === MajorType.Array ||
        e.value.type === MajorType.Map,
    ) ||
      totalLength > 40 ||
      entries.length > 3);

  if (shouldUseMultiLine) {
    // Multi-line formatting
    const indent = opts.indent ?? 0;
    const indentStr = (opts.indentString ?? "    ").repeat(indent);
    const itemIndentStr = (opts.indentString ?? "    ").repeat(indent + 1);

    const formattedEntries = formattedPairs.map((pair: FormattedPair) => {
      return `${itemIndentStr}${pair.key}:\n${itemIndentStr}${pair.value}`;
    });

    return `{\n${formattedEntries.join(",\n")}\n${indentStr}}`;
  } else {
    // Single-line formatting
    const pairs = formattedPairs.map((pair: FormattedPair) => `${pair.key}: ${pair.value}`);
    return `{${pairs.join(", ")}}`;
  }
}

/**
 * Format tagged value.
 */
function formatTagged(tag: number | bigint, content: Cbor, opts: DiagFormatOpts): string {
  // Check for summarizer first
  if (opts.summarize === true) {
    const store = resolveTagsStore(opts.tags);
    const summarizer = store?.summarizer(tag);
    if (summarizer !== undefined) {
      return summarizer(content, opts.flat ?? false);
    }
  }

  // Get tag name as comment if annotation is enabled
  let comment: string | undefined;
  if (opts.annotate === true) {
    const store = resolveTagsStore(opts.tags);
    const tagObj: Tag = { value: tag };
    const assignedName = store?.assignedNameForTag(tagObj);
    if (assignedName !== undefined) {
      comment = assignedName;
    }
  }

  // Always use tag number (not name) in the output
  const tagStr = String(tag);

  // Format content
  const contentStr = formatDiagnostic(content, opts);

  // Add comment if present
  const result = `${tagStr}(${contentStr})`;
  if (comment !== undefined) {
    return `${result}   / ${comment} /`;
  }
  return result;
}

/**
 * Format simple value.
 */
function formatSimple(value: Simple): string {
  // Handle discriminated union
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
 * Format float value.
 */
function formatFloat(value: number): string {
  if (isNaN(value)) {
    return "NaN";
  } else if (!isFinite(value)) {
    return value > 0 ? "Infinity" : "-Infinity";
  } else {
    // Show decimal point for clarity, unless already in scientific notation
    const str = String(value);
    // Scientific notation (contains 'e') or already has decimal point
    if (str.includes(".") || str.includes("e")) {
      return str;
    }
    return `${str}.0`;
  }
}

/**
 * Resolve tags store from option.
 */
function resolveTagsStore(tags?: TagsStore | "global" | "none"): TagsStore | undefined {
  if (tags === "none") {
    return undefined;
  } else if (tags === "global" || tags === undefined) {
    return getGlobalTagsStore();
  } else {
    return tags;
  }
}
