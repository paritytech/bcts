/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Convenience utilities for working with CBOR values.
 *
 * Provides type-safe helpers for checking types, extracting values,
 * and working with arrays, maps, and tagged values.
 *
 * @module conveniences
 */

import {
  type Cbor,
  MajorType,
  type CborNumber,
  type CborInput,
  type CborUnsignedType,
  type CborNegativeType,
  type CborByteStringType,
  type CborTextType,
  type CborArrayType,
  type CborMapType,
  type CborTaggedType,
  type CborSimpleType,
  type CborMethods,
} from "./cbor";
import type { CborMap } from "./map";
import { isFloat as isSimpleFloat } from "./simple";
import { decodeCbor } from "./decode";
import { CborError } from "./error";

// ============================================================================
// Extraction
// ============================================================================

/**
 * Extract native JavaScript value from CBOR.
 * Converts CBOR types to their JavaScript equivalents.
 */
export const extractCbor = (cbor: Cbor | Uint8Array): unknown => {
  let c: Cbor;
  if (cbor instanceof Uint8Array) {
    c = decodeCbor(cbor);
  } else {
    c = cbor;
  }
  switch (c.type) {
    case MajorType.Unsigned:
      return c.value;
    case MajorType.Negative:
      if (typeof c.value === "bigint") {
        return -c.value - 1n;
      } else {
        return -c.value - 1;
      }
    case MajorType.ByteString:
      return c.value;
    case MajorType.Text:
      return c.value;
    case MajorType.Array:
      return c.value.map(extractCbor);
    case MajorType.Map:
      return c.value;
    case MajorType.Tagged:
      return c;
    case MajorType.Simple:
      if (c.value.type === "True") return true;
      if (c.value.type === "False") return false;
      if (c.value.type === "Null") return null;
      if (c.value.type === "Float") return c.value.value;
      return c;
  }
  return undefined;
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if CBOR value is an unsigned integer.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is unsigned integer
 *
 * @example
 * ```typescript
 * if (isUnsigned(value)) {
 *   console.log('Unsigned:', value.value);
 * }
 * ```
 */
export const isUnsigned = (cbor: Cbor): cbor is CborUnsignedType & CborMethods => {
  return cbor.type === MajorType.Unsigned;
};

/**
 * Check if CBOR value is a negative integer.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is negative integer
 */
export const isNegative = (cbor: Cbor): cbor is CborNegativeType & CborMethods => {
  return cbor.type === MajorType.Negative;
};

/**
 * Check if CBOR value is any integer (unsigned or negative).
 *
 * @param cbor - CBOR value to check
 * @returns True if value is an integer
 */
export const isInteger = (
  cbor: Cbor,
): cbor is (CborUnsignedType | CborNegativeType) & CborMethods => {
  return cbor.type === MajorType.Unsigned || cbor.type === MajorType.Negative;
};

/**
 * Check if CBOR value is a byte string.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is byte string
 */
export const isBytes = (cbor: Cbor): cbor is CborByteStringType & CborMethods => {
  return cbor.type === MajorType.ByteString;
};

/**
 * Check if CBOR value is a text string.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is text string
 */
export const isText = (cbor: Cbor): cbor is CborTextType & CborMethods => {
  return cbor.type === MajorType.Text;
};

/**
 * Check if CBOR value is an array.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is array
 */
export const isArray = (cbor: Cbor): cbor is CborArrayType & CborMethods => {
  return cbor.type === MajorType.Array;
};

/**
 * Check if CBOR value is a map.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is map
 */
export const isMap = (cbor: Cbor): cbor is CborMapType & CborMethods => {
  return cbor.type === MajorType.Map;
};

/**
 * Check if CBOR value is tagged.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is tagged
 */
export const isTagged = (cbor: Cbor): cbor is CborTaggedType & CborMethods => {
  return cbor.type === MajorType.Tagged;
};

/**
 * Check if CBOR value is a simple value.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is simple
 */
export const isSimple = (cbor: Cbor): cbor is CborSimpleType & CborMethods => {
  return cbor.type === MajorType.Simple;
};

/**
 * Check if CBOR value is a boolean (true or false).
 *
 * @param cbor - CBOR value to check
 * @returns True if value is boolean
 */
export const isBoolean = (
  cbor: Cbor,
): cbor is CborSimpleType &
  CborMethods & { readonly value: { readonly type: "False" } | { readonly type: "True" } } => {
  if (cbor.type !== MajorType.Simple) {
    return false;
  }
  return cbor.value.type === "False" || cbor.value.type === "True";
};

/**
 * Check if CBOR value is null.
 *
 * @param cbor - CBOR value to check
 * @returns True if value is null
 */
export const isNull = (
  cbor: Cbor,
): cbor is CborSimpleType & CborMethods & { readonly value: { readonly type: "Null" } } => {
  if (cbor.type !== MajorType.Simple) {
    return false;
  }
  return cbor.value.type === "Null";
};

/**
 * Check if CBOR value is a float (f16, f32, or f64).
 *
 * @param cbor - CBOR value to check
 * @returns True if value is float
 */
export const isFloat = (
  cbor: Cbor,
): cbor is CborSimpleType &
  CborMethods & { readonly value: { readonly type: "Float"; readonly value: number } } => {
  if (cbor.type !== MajorType.Simple) {
    return false;
  }
  return isSimpleFloat(cbor.value);
};

// ============================================================================
// Safe Extraction (returns undefined on type mismatch)
// ============================================================================

/**
 * Extract unsigned integer value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Unsigned integer or undefined
 */
export const asUnsigned = (cbor: Cbor): number | bigint | undefined => {
  if (cbor.type === MajorType.Unsigned) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract negative integer value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Negative integer or undefined
 */
export const asNegative = (cbor: Cbor): number | bigint | undefined => {
  if (cbor.type === MajorType.Negative) {
    // Convert stored magnitude back to actual negative value
    if (typeof cbor.value === "bigint") {
      return -cbor.value - 1n;
    } else {
      return -cbor.value - 1;
    }
  }
  return undefined;
};

/**
 * Extract any integer value (unsigned or negative) if type matches.
 *
 * @param cbor - CBOR value
 * @returns Integer or undefined
 */
export const asInteger = (cbor: Cbor): number | bigint | undefined => {
  if (cbor.type === MajorType.Unsigned) {
    return cbor.value;
  } else if (cbor.type === MajorType.Negative) {
    // Convert stored magnitude back to actual negative value
    if (typeof cbor.value === "bigint") {
      return -cbor.value - 1n;
    } else {
      return -cbor.value - 1;
    }
  }
  return undefined;
};

/**
 * Extract byte string value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Byte string or undefined
 */
export const asBytes = (cbor: Cbor): Uint8Array | undefined => {
  if (cbor.type === MajorType.ByteString) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract text string value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Text string or undefined
 */
export const asText = (cbor: Cbor): string | undefined => {
  if (cbor.type === MajorType.Text) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract array value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Array or undefined
 */
export const asArray = (cbor: Cbor): readonly Cbor[] | undefined => {
  if (cbor.type === MajorType.Array) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract map value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Map or undefined
 */
export const asMap = (cbor: Cbor): CborMap | undefined => {
  if (cbor.type === MajorType.Map) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract boolean value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Boolean or undefined
 */
export const asBoolean = (cbor: Cbor): boolean | undefined => {
  if (cbor.type !== MajorType.Simple) {
    return undefined;
  }
  if (cbor.value.type === "True") {
    return true;
  }
  if (cbor.value.type === "False") {
    return false;
  }
  return undefined;
};

/**
 * Extract float value if type matches.
 *
 * @param cbor - CBOR value
 * @returns Float or undefined
 */
export const asFloat = (cbor: Cbor): number | undefined => {
  if (cbor.type !== MajorType.Simple) {
    return undefined;
  }
  const simple = cbor.value;
  if (isSimpleFloat(simple)) {
    return simple.value;
  }
  return undefined;
};

/**
 * Extract any numeric value (integer or float).
 *
 * @param cbor - CBOR value
 * @returns Number or undefined
 */
export const asNumber = (cbor: Cbor): CborNumber | undefined => {
  if (cbor.type === MajorType.Unsigned) {
    return cbor.value;
  }
  if (cbor.type === MajorType.Negative) {
    // Convert stored magnitude back to actual negative value
    if (typeof cbor.value === "bigint") {
      return -cbor.value - 1n;
    } else {
      return -cbor.value - 1;
    }
  }
  if (cbor.type === MajorType.Simple) {
    const simple = cbor.value;
    if (isSimpleFloat(simple)) {
      return simple.value;
    }
  }
  return undefined;
};

// ============================================================================
// Expectations (throw on type mismatch)
// ============================================================================

/**
 * Extract unsigned integer value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Unsigned integer
 * @throws {CborError} With type 'WrongType' if cbor is not an unsigned integer
 */
export const expectUnsigned = (cbor: Cbor): number | bigint => {
  const value = asUnsigned(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract negative integer value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Negative integer
 * @throws {CborError} With type 'WrongType' if cbor is not a negative integer
 */
export const expectNegative = (cbor: Cbor): number | bigint => {
  const value = asNegative(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract any integer value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Integer
 * @throws {CborError} With type 'WrongType' if cbor is not an integer
 */
export const expectInteger = (cbor: Cbor): number | bigint => {
  const value = asInteger(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract byte string value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Byte string
 * @throws {CborError} With type 'WrongType' if cbor is not a byte string
 */
export const expectBytes = (cbor: Cbor): Uint8Array => {
  const value = asBytes(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract text string value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Text string
 * @throws {CborError} With type 'WrongType' if cbor is not a text string
 */
export const expectText = (cbor: Cbor): string => {
  const value = asText(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract array value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Array
 * @throws {CborError} With type 'WrongType' if cbor is not an array
 */
export const expectArray = (cbor: Cbor): readonly Cbor[] => {
  const value = asArray(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract map value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Map
 * @throws {CborError} With type 'WrongType' if cbor is not a map
 */
export const expectMap = (cbor: Cbor): CborMap => {
  const value = asMap(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract boolean value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Boolean
 * @throws {CborError} With type 'WrongType' if cbor is not a boolean
 */
export const expectBoolean = (cbor: Cbor): boolean => {
  const value = asBoolean(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract float value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Float
 * @throws {CborError} With type 'WrongType' if cbor is not a float
 */
export const expectFloat = (cbor: Cbor): number => {
  const value = asFloat(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

/**
 * Extract any numeric value, throwing if type doesn't match.
 *
 * @param cbor - CBOR value
 * @returns Number
 * @throws {CborError} With type 'WrongType' if cbor is not a number
 */
export const expectNumber = (cbor: Cbor): CborNumber => {
  const value = asNumber(cbor);
  if (value === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return value;
};

// ============================================================================
// Array Operations
// ============================================================================

/**
 * Get array item at index.
 *
 * @param cbor - CBOR value (must be array)
 * @param index - Array index
 * @returns Item at index or undefined
 */
export const arrayItem = (cbor: Cbor, index: number): Cbor | undefined => {
  if (cbor.type !== MajorType.Array) {
    return undefined;
  }
  const array = cbor.value;
  if (index < 0 || index >= array.length) {
    return undefined;
  }
  return array[index];
};

/**
 * Get array length.
 *
 * @param cbor - CBOR value (must be array)
 * @returns Array length or undefined
 */
export const arrayLength = (cbor: Cbor): number | undefined => {
  if (cbor.type !== MajorType.Array) {
    return undefined;
  }
  return cbor.value.length;
};

/**
 * Check if array is empty.
 *
 * @param cbor - CBOR value (must be array)
 * @returns True if empty, false if not empty, undefined if not array
 */
export const arrayIsEmpty = (cbor: Cbor): boolean | undefined => {
  if (cbor.type !== MajorType.Array) {
    return undefined;
  }
  return cbor.value.length === 0;
};

// ============================================================================
// Map Operations
// ============================================================================

/**
 * Get map value by key.
 *
 * @param cbor - CBOR value (must be map)
 * @param key - Map key
 * @returns Value for key or undefined
 */
export function mapValue<K extends CborInput, V>(cbor: Cbor, key: K): V | undefined {
  if (cbor.type !== MajorType.Map) {
    return undefined;
  }
  return cbor.value.get<K, V>(key);
}

/**
 * Check if map has key.
 *
 * @param cbor - CBOR value (must be map)
 * @param key - Map key
 * @returns True if key exists, false otherwise, undefined if not map
 */
export function mapHas<K extends CborInput>(cbor: Cbor, key: K): boolean | undefined {
  if (cbor.type !== MajorType.Map) {
    return undefined;
  }
  return cbor.value.has(key);
}

/**
 * Get all map keys.
 *
 * @param cbor - CBOR value (must be map)
 * @returns Array of keys or undefined
 */
export const mapKeys = (cbor: Cbor): Cbor[] | undefined => {
  if (cbor.type !== MajorType.Map) {
    return undefined;
  }
  return cbor.value.entriesArray.map((e) => e.key);
};

/**
 * Get all map values.
 *
 * @param cbor - CBOR value (must be map)
 * @returns Array of values or undefined
 */
export const mapValues = (cbor: Cbor): Cbor[] | undefined => {
  if (cbor.type !== MajorType.Map) {
    return undefined;
  }
  return cbor.value.entriesArray.map((e) => e.value);
};

/**
 * Get map size.
 *
 * @param cbor - CBOR value (must be map)
 * @returns Map size or undefined
 */
export const mapSize = (cbor: Cbor): number | undefined => {
  if (cbor.type !== MajorType.Map) {
    return undefined;
  }
  return cbor.value.size;
};

/**
 * Check if map is empty.
 *
 * @param cbor - CBOR value (must be map)
 * @returns True if empty, false if not empty, undefined if not map
 */
export const mapIsEmpty = (cbor: Cbor): boolean | undefined => {
  if (cbor.type !== MajorType.Map) {
    return undefined;
  }
  return cbor.value.size === 0;
};

// ============================================================================
// Tagged Value Operations
// ============================================================================

/**
 * Get tag value from tagged CBOR.
 *
 * @param cbor - CBOR value (must be tagged)
 * @returns Tag value or undefined
 */
export const tagValue = (cbor: Cbor): number | bigint | undefined => {
  if (cbor.type !== MajorType.Tagged) {
    return undefined;
  }
  return cbor.tag;
};

/**
 * Get content from tagged CBOR.
 *
 * @param cbor - CBOR value (must be tagged)
 * @returns Tagged content or undefined
 */
export const tagContent = (cbor: Cbor): Cbor | undefined => {
  if (cbor.type !== MajorType.Tagged) {
    return undefined;
  }
  return cbor.value;
};

/**
 * Check if CBOR has a specific tag.
 *
 * @param cbor - CBOR value
 * @param tag - Tag value to check
 * @returns True if has tag, false otherwise
 */
export const hasTag = (cbor: Cbor, tag: number | bigint): boolean => {
  if (cbor.type !== MajorType.Tagged) {
    return false;
  }
  return cbor.tag === tag;
};

/**
 * Extract content if has specific tag.
 *
 * @param cbor - CBOR value
 * @param tag - Expected tag value
 * @returns Tagged content or undefined
 */
export const getTaggedContent = (cbor: Cbor, tag: number | bigint): Cbor | undefined => {
  if (cbor.type === MajorType.Tagged && cbor.tag === tag) {
    return cbor.value;
  }
  return undefined;
};

/**
 * Extract content if has specific tag, throwing if not.
 *
 * @param cbor - CBOR value
 * @param tag - Expected tag value
 * @returns Tagged content
 * @throws {CborError} With type 'WrongType' if cbor is not tagged with the expected tag
 */
export const expectTaggedContent = (cbor: Cbor, tag: number | bigint): Cbor => {
  const content = getTaggedContent(cbor, tag);
  if (content === undefined) {
    throw new CborError({ type: "WrongType" });
  }
  return content;
};

// ============================================================================
// Envelope Compatibility Functions
// These functions provide the API expected by the envelope package
// ============================================================================

import type { Tag } from "./tag";

/**
 * Extract tagged value as tuple [Tag, Cbor] if CBOR is tagged.
 * This is used by envelope for decoding.
 *
 * @param cbor - CBOR value
 * @returns [Tag, Cbor] tuple or undefined
 */
export const asTaggedValue = (cbor: Cbor): [Tag, Cbor] | undefined => {
  if (cbor.type !== MajorType.Tagged) {
    return undefined;
  }
  const tag: Tag = { value: cbor.tag, name: `tag-${cbor.tag}` };
  return [tag, cbor.value];
};

/**
 * Alias for asBytes - extract byte string value if type matches.
 * Named asByteString for envelope compatibility.
 *
 * @param cbor - CBOR value
 * @returns Byte string or undefined
 */
export const asByteString = asBytes;

/**
 * A wrapper around CBOR arrays that provides a get(index) method
 * for envelope compatibility.
 */
export interface CborArrayWrapper {
  readonly length: number;
  get(index: number): Cbor | undefined;
  [Symbol.iterator](): Iterator<Cbor>;
}

/**
 * Extract array value with get() method for envelope compatibility.
 *
 * @param cbor - CBOR value
 * @returns Array wrapper with get() method or undefined
 */
export const asCborArray = (cbor: Cbor): CborArrayWrapper | undefined => {
  if (cbor.type !== MajorType.Array) {
    return undefined;
  }
  const arr = cbor.value;
  return {
    length: arr.length,
    get(index: number): Cbor | undefined {
      return arr[index];
    },
    [Symbol.iterator](): Iterator<Cbor> {
      return arr[Symbol.iterator]();
    },
  };
};

/**
 * Alias for asMap - extract map value if type matches.
 * Named asCborMap for envelope compatibility.
 *
 * @param cbor - CBOR value
 * @returns Map or undefined
 */
export const asCborMap = asMap;

/**
 * Check if CBOR value is any numeric type (unsigned, negative, or float).
 *
 * @param cbor - CBOR value
 * @returns True if value is numeric
 */
export const isNumber = (cbor: Cbor): boolean => {
  if (cbor.type === MajorType.Unsigned || cbor.type === MajorType.Negative) {
    return true;
  }
  if (cbor.type === MajorType.Simple) {
    return isSimpleFloat(cbor.value);
  }
  return false;
};
