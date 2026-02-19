/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * CBOR Simple Values (Major Type 7).
 *
 * @module simple
 */

import { MajorType } from "./cbor";
import { encodeVarInt } from "./varint";
import { f64CborData } from "./float";

/**
 * Represents CBOR simple values (major type 7).
 *
 * In CBOR, simple values are a special category that includes booleans (`true`
 * and `false`), `null`, and floating point numbers.
 *
 * Per Section 2.4 of the dCBOR specification, only these specific simple
 * values are valid in dCBOR. All other major type 7 values (such as undefined
 * or other simple values) are invalid and will be rejected by dCBOR decoders.
 *
 * When encoding floating point values, dCBOR follows specific numeric
 * reduction rules detailed in Section 2.3 of the dCBOR specification,
 * including
 * - Integral floating point values must be reduced to integers when possible
 * - NaN values must be normalized to the canonical form `f97e00`
 */
export type Simple =
  | { readonly type: "False" }
  | { readonly type: "True" }
  | { readonly type: "Null" }
  | { readonly type: "Float"; readonly value: number };

/**
 * Returns the standard name of the simple value as a string.
 *
 * For `False`, `True`, and `Null`, this returns their lowercase string
 * representation. For `Float` values, it returns their numeric representation.
 */
export const simpleName = (simple: Simple): string => {
  switch (simple.type) {
    case "False":
      return "false";
    case "True":
      return "true";
    case "Null":
      return "null";
    case "Float": {
      const v = simple.value;
      if (Number.isNaN(v)) {
        return "NaN";
      } else if (!Number.isFinite(v)) {
        return v > 0 ? "Infinity" : "-Infinity";
      } else {
        return String(v);
      }
    }
  }
};

/**
 * Checks if the simple value is a floating point number.
 */
export const isFloat = (simple: Simple): simple is { type: "Float"; value: number } =>
  simple.type === "Float";

/**
 * Checks if the simple value is the NaN (Not a Number) representation.
 */
export const isNaN = (simple: Simple): boolean =>
  simple.type === "Float" && Number.isNaN(simple.value);

/**
 * Encodes the simple value to its raw CBOR byte representation.
 *
 * Returns the CBOR bytes that represent this simple value according to the
 * dCBOR deterministic encoding rules:
 * - `False` encodes as `0xf4`
 * - `True` encodes as `0xf5`
 * - `Null` encodes as `0xf6`
 * - `Float` values encode according to the IEEE 754 floating point rules,
 *   using the shortest representation that preserves precision.
 */
export const simpleCborData = (simple: Simple): Uint8Array => {
  switch (simple.type) {
    case "False":
      return encodeVarInt(20, MajorType.Simple);
    case "True":
      return encodeVarInt(21, MajorType.Simple);
    case "Null":
      return encodeVarInt(22, MajorType.Simple);
    case "Float":
      return f64CborData(simple.value);
  }
};

/**
 * Compare two Simple values for equality.
 *
 * Two `Simple` values are equal if they're the same variant. For `Float`
 * variants, the contained floating point values are compared for equality,
 * with NaN values considered equal to each other.
 */
export const simpleEquals = (a: Simple, b: Simple): boolean => {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case "False":
    case "True":
    case "Null":
      return true;
    case "Float": {
      const bFloat = b as { type: "Float"; value: number };
      const v1 = a.value;
      const v2 = bFloat.value;
      return v1 === v2 || (Number.isNaN(v1) && Number.isNaN(v2));
    }
  }
};

/**
 * Hash a Simple value.
 *
 * Matches Rust's Hash trait implementation.
 */
export const simpleHash = (simple: Simple): number => {
  // Simple FNV-1a hash
  let hash = 2166136261;

  switch (simple.type) {
    case "False":
      hash ^= 0;
      break;
    case "True":
      hash ^= 1;
      break;
    case "Null":
      hash ^= 2;
      break;
    case "Float": {
      // Hash the bit representation of the float
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setFloat64(0, simple.value, true);
      for (let i = 0; i < 8; i++) {
        hash ^= view.getUint8(i);
        hash = Math.imul(hash, 16777619);
      }
      break;
    }
  }

  return hash >>> 0;
};
