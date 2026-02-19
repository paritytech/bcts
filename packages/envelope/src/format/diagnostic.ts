/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Envelope } from "../base/envelope";

// Type for CBOR values that can appear in diagnostic notation
type CborValue =
  | string
  | number
  | boolean
  | null
  | Uint8Array
  | CborValue[]
  | Map<CborValue, CborValue>
  | { tag: number; value: CborValue }
  | { type: number; value: unknown };

/// Diagnostic notation formatting for Gordian Envelopes.
///
/// This module provides methods for converting envelopes to CBOR diagnostic
/// notation, a human-readable text format defined in RFC 8949 §8.
///
/// See [RFC-8949 §8](https://www.rfc-editor.org/rfc/rfc8949.html#name-diagnostic-notation)
/// for information on CBOR diagnostic notation.

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

/// Converts a CBOR value to diagnostic notation
function cborToDiagnostic(cbor: CborValue, indent = 0): string {
  // Handle tagged values (CBOR tags)
  if (typeof cbor === "object" && cbor !== null && "tag" in cbor && "value" in cbor) {
    const tagged = cbor as { tag: number; value: CborValue };
    return `${tagged.tag}(${cborToDiagnostic(tagged.value, indent)})`;
  }

  // Handle arrays
  if (Array.isArray(cbor)) {
    if (cbor.length === 0) {
      return "[]";
    }
    const items = cbor.map((item) => cborToDiagnostic(item, indent + 2));
    return `[${items.join(", ")}]`;
  }

  // Handle Maps
  if (cbor instanceof Map) {
    if (cbor.size === 0) {
      return "{}";
    }
    const entries: string[] = [];
    for (const [key, value] of cbor) {
      const keyStr = cborToDiagnostic(key, indent + 2);
      const valueStr = cborToDiagnostic(value, indent + 2);
      entries.push(`${keyStr}: ${valueStr}`);
    }
    return `{${entries.join(", ")}}`;
  }

  // Handle Uint8Array (byte strings)
  if (cbor instanceof Uint8Array) {
    const hex = Array.from(cbor)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `h'${hex}'`;
  }

  // Handle strings
  if (typeof cbor === "string") {
    return JSON.stringify(cbor);
  }

  // Handle CBOR objects with type information
  if (typeof cbor === "object" && cbor !== null && "type" in cbor) {
    const typed = cbor as { type: number; value: unknown };
    switch (typed.type) {
      case 0: // Unsigned
        return String(typed.value);
      case 1: // Negative
        return String(-1 - Number(typed.value));
      case 7: {
        // Simple
        const simpleValue = typed.value;
        if (simpleValue !== null && typeof simpleValue === "object" && "type" in simpleValue) {
          const floatValue = simpleValue as { type: string; value: unknown };
          if (floatValue.type === "Float") {
            return String(floatValue.value);
          }
        }
        if (simpleValue === 20) return "false";
        if (simpleValue === 21) return "true";
        if (simpleValue === 22) return "null";
        if (simpleValue === 23) return "undefined";
        return `simple(${String(simpleValue)})`;
      }
    }
  }

  // Fallback for primitives
  if (typeof cbor === "boolean") return String(cbor);
  if (typeof cbor === "number") return String(cbor);
  if (typeof cbor === "bigint") return String(cbor);
  if (cbor === null) return "null";
  if (cbor === undefined) return "undefined";

  // Unknown type - try JSON stringify
  try {
    return JSON.stringify(cbor);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(cbor);
  }
}

/// Implementation of diagnostic()
Envelope.prototype.diagnostic = function (this: Envelope): string {
  const cbor = this.taggedCbor();
  return cborToDiagnostic(cbor);
};
