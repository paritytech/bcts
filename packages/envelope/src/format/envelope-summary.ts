/// Envelope summary functionality for generating short text representations.
///
/// This module provides the EnvelopeSummary interface and implementations
/// for generating concise text summaries of CBOR values and envelopes.

import type { Cbor } from "@bcts/dcbor";
import {
  isUnsigned,
  isNegative,
  isBytes,
  isText,
  isSimple,
  isArray,
  isMap,
  isTagged,
  asText,
  diagnosticOpt,
  type DiagFormatOpts,
} from "@bcts/dcbor";
import { Envelope } from "../base/envelope";
import {
  type FormatContext,
  type FormatContextOpt,
  getGlobalFormatContext,
} from "./format-context";

// ============================================================================
// EnvelopeSummary Interface
// ============================================================================

/// Interface for types that can produce envelope summary strings.
export interface EnvelopeSummary {
  envelopeSummary(maxLength: number, context: FormatContextOpt): string;
}

// ============================================================================
// CBOR Summary Implementation
// ============================================================================

/// Helper to flank a string with prefix and suffix
const flankedBy = (s: string, prefix: string, suffix: string): string => {
  return `${prefix}${s}${suffix}`;
};

/// Generate an envelope summary for a CBOR value.
export const cborEnvelopeSummary = (
  cbor: Cbor,
  maxLength: number,
  context: FormatContextOpt,
): string => {
  // Handle unsigned integers
  if (isUnsigned(cbor)) {
    return String(cbor);
  }

  // Handle negative integers
  if (isNegative(cbor)) {
    // In CBOR, negative integers are stored as -(n+1), so we need to compute the actual value
    const n = cbor as unknown as bigint;
    return String(-1n - n);
  }

  // Handle byte strings
  if (isBytes(cbor)) {
    const bytes = cbor as unknown as Uint8Array;
    return `Bytes(${bytes.length})`;
  }

  // Handle text strings
  if (isText(cbor)) {
    let text = asText(cbor) ?? "";
    if (text.length > maxLength) {
      text = `${text.substring(0, maxLength)}…`;
    }
    // Replace newlines with escaped version
    text = text.replace(/\n/g, "\\n");
    return flankedBy(text, '"', '"');
  }

  // Handle simple values (bool, null, undefined, float)
  if (isSimple(cbor)) {
    const value = cbor as unknown;
    if (value === true) return "true";
    if (value === false) return "false";
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "number") {
      if (Number.isNaN(value)) return "NaN";
      if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
      return String(value);
    }
    return String(value);
  }

  // Handle arrays, maps, and tagged values - use diagnostic notation
  if (isArray(cbor) || isMap(cbor) || isTagged(cbor)) {
    const opts: DiagFormatOpts = { summarize: true };

    // Get appropriate tags store based on context
    if (context.type === "custom") {
      return diagnosticOpt(cbor, { ...opts, tags: context.context.tags() });
    } else if (context.type === "global") {
      const ctx = getGlobalFormatContext();
      return diagnosticOpt(cbor, { ...opts, tags: ctx.tags() });
    } else {
      return diagnosticOpt(cbor, opts);
    }
  }

  // Fallback
  return String(cbor);
};

// ============================================================================
// Envelope Summary Method Extension
// ============================================================================

// Extend Envelope prototype with summary method that uses FormatContext
declare module "../base/envelope" {
  interface Envelope {
    /// Returns a short summary of the envelope's content with a maximum length.
    summaryWithContext(maxLength: number, context: FormatContext): string;
  }
}

/// Implementation of summaryWithContext
Envelope.prototype.summaryWithContext = function (
  this: Envelope,
  maxLength: number,
  context: FormatContext,
): string {
  const c = this.case();

  switch (c.type) {
    case "node":
      return "NODE";

    case "leaf":
      return cborEnvelopeSummary(c.cbor, maxLength, {
        type: "custom",
        context,
      });

    case "wrapped":
      return "WRAPPED";

    case "assertion":
      return "ASSERTION";

    case "elided":
      return "ELIDED";

    case "knownValue": {
      const knownValues = context.knownValues();
      const name = knownValues.name(c.value);
      return flankedBy(name, "'", "'");
    }

    case "encrypted":
      return "ENCRYPTED";

    case "compressed":
      return "COMPRESSED";

    default:
      return "UNKNOWN";
  }
};

// ============================================================================
// Exports
// ============================================================================

export { cborEnvelopeSummary as envelopeSummary };
