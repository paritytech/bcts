/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

/// Envelope notation formatting.
///
/// This module provides functionality for formatting envelopes in human-readable
/// envelope notation, which shows the semantic structure of an envelope.
///
/// # Examples
///
/// ```typescript
/// const envelope = Envelope.new("Alice")
///     .addAssertion("knows", "Bob")
///     .addAssertion("knows", "Carol");
///
/// // Format the envelope as human-readable envelope notation
/// const formatted = envelope.format();
/// // Will output: "Alice" [ "knows": "Bob", "knows": "Carol" ]
/// ```

import type { Cbor } from "@bcts/dcbor";
import { isTagged, tagValue } from "@bcts/dcbor";
import { IS_A } from "@bcts/known-values";
import { Envelope } from "../base/envelope";
import type { Assertion } from "../base/assertion";
import {
  type FormatContextOpt,
  getGlobalFormatContext,
  formatContextGlobal,
} from "./format-context";
import { cborEnvelopeSummary } from "./envelope-summary";

// ============================================================================
// EnvelopeFormatOpts - Options for envelope formatting
// ============================================================================

/// Options for envelope notation formatting.
export interface EnvelopeFormatOpts {
  /// If true, format as a single line without indentation
  flat: boolean;
  /// The format context to use
  context: FormatContextOpt;
}

/// Create default format options
export const defaultFormatOpts = (): EnvelopeFormatOpts => ({
  flat: false,
  context: formatContextGlobal(),
});

/// Create format options with flat formatting
export const flatFormatOpts = (): EnvelopeFormatOpts => ({
  flat: true,
  context: formatContextGlobal(),
});

// ============================================================================
// EnvelopeFormatItem - Format item types
// ============================================================================

/// Type returned by EnvelopeFormat implementations.
export type EnvelopeFormatItem =
  | { type: "begin"; value: string }
  | { type: "end"; value: string }
  | { type: "item"; value: string }
  | { type: "separator" }
  | { type: "list"; items: EnvelopeFormatItem[] };

/// Create a Begin item
export const formatBegin = (value: string): EnvelopeFormatItem => ({
  type: "begin",
  value,
});

/// Create an End item
export const formatEnd = (value: string): EnvelopeFormatItem => ({
  type: "end",
  value,
});

/// Create an Item
export const formatItem = (value: string): EnvelopeFormatItem => ({
  type: "item",
  value,
});

/// Create a Separator
export const formatSeparator = (): EnvelopeFormatItem => ({ type: "separator" });

/// Create a List
export const formatList = (items: EnvelopeFormatItem[]): EnvelopeFormatItem => ({
  type: "list",
  items,
});

// ============================================================================
// EnvelopeFormatItem Utilities
// ============================================================================

/// Flatten a format item into a flat array
const flatten = (item: EnvelopeFormatItem): EnvelopeFormatItem[] => {
  if (item.type === "list") {
    return item.items.flatMap(flatten);
  }
  return [item];
};

/// Nicen the format items by combining adjacent End/Begin pairs
const nicen = (items: EnvelopeFormatItem[]): EnvelopeFormatItem[] => {
  const input = [...items];
  const result: EnvelopeFormatItem[] = [];

  while (input.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Array length checked above
    const current = input.shift()!;
    if (input.length === 0) {
      result.push(current);
      break;
    }

    if (current.type === "end" && input[0]?.type === "begin") {
      const endString = current.value;
      const beginString = input[0].value;
      result.push(formatEnd(`${endString} ${beginString}`));
      result.push(formatBegin(""));
      input.shift();
    } else {
      result.push(current);
    }
  }

  return result;
};

/// Create indentation string
const indent = (level: number): string => " ".repeat(level * 4);

/// Add space at end if needed
const addSpaceAtEndIfNeeded = (s: string): string => {
  if (s.length === 0) return " ";
  if (s.endsWith(" ")) return s;
  return `${s} `;
};

/// Format items in flat mode (single line)
const formatFlat = (item: EnvelopeFormatItem): string => {
  let line = "";
  const items = flatten(item);

  for (const i of items) {
    switch (i.type) {
      case "begin":
        if (!line.endsWith(" ")) line += " ";
        line += `${i.value} `;
        break;
      case "end":
        if (!line.endsWith(" ")) line += " ";
        line += `${i.value} `;
        break;
      case "item":
        line += i.value;
        break;
      case "separator":
        line = `${line.trimEnd()}, `;
        break;
      case "list":
        for (const subItem of i.items) {
          line += formatFlat(subItem);
        }
        break;
    }
  }

  return line;
};

/// Format items in hierarchical mode (with indentation)
const formatHierarchical = (item: EnvelopeFormatItem): string => {
  const lines: string[] = [];
  let level = 0;
  let currentLine = "";
  const items = nicen(flatten(item));

  for (const i of items) {
    switch (i.type) {
      case "begin": {
        const delimiter = i.value;
        if (delimiter.length > 0) {
          const c =
            currentLine.length === 0
              ? delimiter
              : `${addSpaceAtEndIfNeeded(currentLine)}${delimiter}`;
          lines.push(`${indent(level)}${c}\n`);
        }
        level += 1;
        currentLine = "";
        break;
      }
      case "end": {
        const delimiter = i.value;
        if (currentLine.length > 0) {
          lines.push(`${indent(level)}${currentLine}\n`);
          currentLine = "";
        }
        level -= 1;
        lines.push(`${indent(level)}${delimiter}\n`);
        break;
      }
      case "item":
        currentLine += i.value;
        break;
      case "separator":
        if (currentLine.length > 0) {
          lines.push(`${indent(level)}${currentLine}\n`);
          currentLine = "";
        }
        break;
      case "list":
        lines.push("<list>");
        break;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("");
};

/// Format a format item according to options
const formatFormatItem = (item: EnvelopeFormatItem, opts: EnvelopeFormatOpts): string => {
  if (opts.flat) {
    return formatFlat(item);
  }
  return formatHierarchical(item);
};

// ============================================================================
// EnvelopeFormat Interface and Implementations
// ============================================================================

/// Format a CBOR value as an envelope format item
export const formatCbor = (cbor: Cbor, opts: EnvelopeFormatOpts): EnvelopeFormatItem => {
  // Check if this is a tagged envelope
  if (isTagged(cbor)) {
    const tag = tagValue(cbor);
    // Envelope tag is 200
    if (tag === 200n || tag === 200) {
      try {
        const envelope = Envelope.fromTaggedCbor(cbor);
        return formatEnvelope(envelope, opts);
      } catch {
        return formatItem("<error>");
      }
    }
  }

  // For non-envelope CBOR, use summary
  const summary = cborEnvelopeSummary(cbor, Number.MAX_SAFE_INTEGER, opts.context);
  return formatItem(summary);
};

/// Format an Assertion as an envelope format item
export const formatAssertion = (
  assertion: Assertion,
  opts: EnvelopeFormatOpts,
): EnvelopeFormatItem => {
  return formatList([
    formatEnvelope(assertion.predicate(), opts),
    formatItem(": "),
    formatEnvelope(assertion.object(), opts),
  ]);
};

/// Format an Envelope as an envelope format item
export const formatEnvelope = (
  envelope: Envelope,
  opts: EnvelopeFormatOpts,
): EnvelopeFormatItem => {
  const c = envelope.case();

  switch (c.type) {
    case "leaf":
      return formatCbor(c.cbor, opts);

    case "wrapped":
      return formatList([formatBegin("{"), formatEnvelope(c.envelope, opts), formatEnd("}")]);

    case "assertion":
      return formatAssertion(c.assertion, opts);

    case "knownValue": {
      // Get the name from context
      let name: string;
      if (opts.context.type === "custom") {
        const knownValues = opts.context.context.knownValues();
        const assignedName = knownValues.assignedName(c.value);
        name = assignedName ?? c.value.name();
      } else if (opts.context.type === "global") {
        const ctx = getGlobalFormatContext();
        const knownValues = ctx.knownValues();
        const assignedName = knownValues.assignedName(c.value);
        name = assignedName ?? c.value.name();
      } else {
        name = c.value.name();
      }
      return formatItem(`'${name}'`);
    }

    case "encrypted":
      return formatItem("ENCRYPTED");

    case "compressed":
      return formatItem("COMPRESSED");

    case "elided":
      return formatItem("ELIDED");

    case "node": {
      const items: EnvelopeFormatItem[] = [];
      const subjectItem = formatEnvelope(c.subject, opts);

      let elidedCount = 0;
      let encryptedCount = 0;
      let compressedCount = 0;
      const typeAssertionItems: EnvelopeFormatItem[][] = [];
      const assertionItems: EnvelopeFormatItem[][] = [];

      for (const assertion of c.assertions) {
        const assertionCase = assertion.case();

        switch (assertionCase.type) {
          case "elided":
            elidedCount += 1;
            break;
          case "encrypted":
            encryptedCount += 1;
            break;
          case "compressed":
            compressedCount += 1;
            break;
          case "node":
          case "leaf":
          case "wrapped":
          case "assertion":
          case "knownValue": {
            const item = [formatEnvelope(assertion, opts)];

            // Check if this is a type assertion (isA predicate)
            let isTypeAssertion = false;
            const predicate = assertion.asPredicate();
            if (predicate?.subject().asKnownValue()?.equals(IS_A) === true) {
              isTypeAssertion = true;
            }

            if (isTypeAssertion) {
              typeAssertionItems.push(item);
            } else {
              assertionItems.push(item);
            }
            break;
          }
        }
      }

      // Sort assertion items
      typeAssertionItems.sort((a, b) => compareFormatItems(a[0], b[0]));
      assertionItems.sort((a, b) => compareFormatItems(a[0], b[0]));

      // Add type assertions first
      const allAssertionItems = [...typeAssertionItems, ...assertionItems];

      // Add compressed count
      if (compressedCount > 1) {
        allAssertionItems.push([formatItem(`COMPRESSED (${compressedCount})`)]);
      } else if (compressedCount > 0) {
        allAssertionItems.push([formatItem("COMPRESSED")]);
      }

      // Add elided count
      if (elidedCount > 1) {
        allAssertionItems.push([formatItem(`ELIDED (${elidedCount})`)]);
      } else if (elidedCount > 0) {
        allAssertionItems.push([formatItem("ELIDED")]);
      }

      // Add encrypted count
      if (encryptedCount > 1) {
        allAssertionItems.push([formatItem(`ENCRYPTED (${encryptedCount})`)]);
      } else if (encryptedCount > 0) {
        allAssertionItems.push([formatItem("ENCRYPTED")]);
      }

      // Intersperse with separators
      const joinedAssertionItems: EnvelopeFormatItem[] = [];
      for (let i = 0; i < allAssertionItems.length; i++) {
        if (i > 0) {
          joinedAssertionItems.push(formatSeparator());
        }
        joinedAssertionItems.push(...allAssertionItems[i]);
      }

      // Check if subject needs braces (if it's an assertion)
      const needsBraces = c.subject.isSubjectAssertion();

      if (needsBraces) {
        items.push(formatBegin("{"));
      }
      items.push(subjectItem);
      if (needsBraces) {
        items.push(formatEnd("}"));
      }
      items.push(formatBegin("["));
      items.push(...joinedAssertionItems);
      items.push(formatEnd("]"));

      return formatList(items);
    }
  }
};

/// Compare format items for sorting
const compareFormatItems = (a: EnvelopeFormatItem, b: EnvelopeFormatItem): number => {
  const getIndex = (item: EnvelopeFormatItem): number => {
    switch (item.type) {
      case "begin":
        return 1;
      case "end":
        return 2;
      case "item":
        return 3;
      case "separator":
        return 4;
      case "list":
        return 5;
    }
  };

  const aIndex = getIndex(a);
  const bIndex = getIndex(b);

  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }

  // Same type, compare values
  if (a.type === "item" && b.type === "item") {
    return a.value.localeCompare(b.value);
  }
  if (a.type === "begin" && b.type === "begin") {
    return a.value.localeCompare(b.value);
  }
  if (a.type === "end" && b.type === "end") {
    return a.value.localeCompare(b.value);
  }

  return 0;
};

// ============================================================================
// Envelope Prototype Extensions
// ============================================================================

/// Implementation of formatOpt
Envelope.prototype.formatOpt = function (this: Envelope, opts: EnvelopeFormatOpts): string {
  const item = formatEnvelope(this, opts);
  return formatFormatItem(item, opts).trim();
};

/// Implementation of format
Envelope.prototype.format = function (this: Envelope): string {
  return this.formatOpt(defaultFormatOpts());
};

/// Implementation of formatFlat
Envelope.prototype.formatFlat = function (this: Envelope): string {
  return this.formatOpt(flatFormatOpts());
};

// All exports are done inline above with 'export const' and 'export interface'
