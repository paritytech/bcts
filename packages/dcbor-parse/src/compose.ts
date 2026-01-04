/**
 * @bcts/dcbor-parse - Compose module
 *
 * This is a 1:1 TypeScript port of bc-dcbor-parse-rust compose.rs
 *
 * @module dcbor-parse/compose
 */

import { type Cbor, cbor, CborMap } from "@bcts/dcbor";
import type { ParseError } from "./error";
import { parseDcborItem } from "./parse";

/**
 * Compose error types.
 *
 * Corresponds to the Rust `Error` enum in compose.rs
 */
export type ComposeError =
  | { readonly type: "OddMapLength" }
  | { readonly type: "DuplicateMapKey" }
  | { readonly type: "ParseError"; readonly error: ParseError };

// ComposeError constructors (lowercase to differentiate from the type)
export const composeError = {
  oddMapLength(): ComposeError {
    return { type: "OddMapLength" };
  },

  duplicateMapKey(): ComposeError {
    return { type: "DuplicateMapKey" };
  },

  parseError(error: ParseError): ComposeError {
    return { type: "ParseError", error };
  },
};

/**
 * Gets the error message for a compose error.
 */
export function composeErrorMessage(error: ComposeError): string {
  switch (error.type) {
    case "OddMapLength":
      return "Invalid odd map length";
    case "DuplicateMapKey":
      return "Duplicate map key";
    case "ParseError":
      return `Invalid CBOR item: ${error.error.type}`;
  }
}

/**
 * Result type for compose operations.
 *
 * Corresponds to Rust `Result<T, Error>`
 */
export type ComposeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ComposeError };

/**
 * Creates a successful compose result.
 */
export function composeOk<T>(value: T): ComposeResult<T> {
  return { ok: true, value };
}

/**
 * Creates an error compose result.
 */
export function composeErr<T>(error: ComposeError): ComposeResult<T> {
  return { ok: false, error };
}

/**
 * Composes a dCBOR array from a slice of string slices, and returns a CBOR
 * object representing the array.
 *
 * Each string slice is parsed as a dCBOR item.
 *
 * @param array - Array of strings, each representing a dCBOR item
 * @returns A CBOR array containing all parsed items
 *
 * @example
 * ```typescript
 * const result = composeDcborArray(["1", "2", "3"]);
 * if (result.ok) {
 *   console.log(result.value.toDiagnostic()); // "[1, 2, 3]"
 * }
 * ```
 */
export function composeDcborArray(array: readonly string[]): ComposeResult<Cbor> {
  const result: Cbor[] = [];

  for (const item of array) {
    const parseResult = parseDcborItem(item);
    if (!parseResult.ok) {
      return composeErr(composeError.parseError(parseResult.error));
    }
    result.push(parseResult.value);
  }

  return composeOk(cbor(result));
}

/**
 * Composes a dCBOR map from a slice of string slices, and returns a CBOR
 * object representing the map.
 *
 * The length of the slice must be even, as each key must have a corresponding
 * value.
 *
 * Each string slice is parsed as a dCBOR item.
 *
 * @param array - Array of strings representing key-value pairs in alternating order
 * @returns A CBOR map containing all parsed key-value pairs
 *
 * @example
 * ```typescript
 * const result = composeDcborMap(["1", "2", "3", "4"]);
 * if (result.ok) {
 *   console.log(result.value.toDiagnostic()); // "{1: 2, 3: 4}"
 * }
 * ```
 */
export function composeDcborMap(array: readonly string[]): ComposeResult<Cbor> {
  if (array.length % 2 !== 0) {
    return composeErr(composeError.oddMapLength());
  }

  const map = new CborMap();

  for (let i = 0; i < array.length; i += 2) {
    const keyStr = array[i];
    const valueStr = array[i + 1];

    const keyResult = parseDcborItem(keyStr);
    if (!keyResult.ok) {
      return composeErr(composeError.parseError(keyResult.error));
    }

    const valueResult = parseDcborItem(valueStr);
    if (!valueResult.ok) {
      return composeErr(composeError.parseError(valueResult.error));
    }

    // Check for duplicate key
    if (map.has(keyResult.value)) {
      return composeErr(composeError.duplicateMapKey());
    }

    map.set(keyResult.value, valueResult.value);
  }

  return composeOk(cbor(map));
}
