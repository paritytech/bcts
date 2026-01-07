import { CborMap } from "./map";
import type { Simple } from "./simple";
import { simpleCborData, isFloat as isSimpleFloat } from "./simple";
import { hasFractionalPart } from "./float";
import { encodeVarInt } from "./varint";
import { concatBytes } from "./stdlib";
import { bytesToHex, hexOpt } from "./dump";
import { hexToBytes } from "./dump";
import type { Tag } from "./tag";
import type { ByteString } from "./byte-string";
import type { CborDate } from "./date";
import { diagnosticOpt } from "./diag";
import { decodeCbor } from "./decode";
import type { TagsStore } from "./tags-store";
import { getGlobalTagsStore } from "./tags-store";
import type { Visitor } from "./walk";
import { walk } from "./walk";
import { CborError } from "./error";

export type { Simple };

export const MajorType = {
  Unsigned: 0,
  Negative: 1,
  ByteString: 2,
  Text: 3,
  Array: 4,
  Map: 5,
  Tagged: 6,
  Simple: 7,
} as const;

// eslint-disable-next-line no-redeclare -- Intentionally using same name for value and type
export type MajorType = (typeof MajorType)[keyof typeof MajorType];

// Helper to get MajorType name from value (replaces enum reverse mapping)
const MajorTypeNames: Record<MajorType, string> = {
  [MajorType.Unsigned]: "Unsigned",
  [MajorType.Negative]: "Negative",
  [MajorType.ByteString]: "ByteString",
  [MajorType.Text]: "Text",
  [MajorType.Array]: "Array",
  [MajorType.Map]: "Map",
  [MajorType.Tagged]: "Tagged",
  [MajorType.Simple]: "Simple",
};

const getMajorTypeName = (type: MajorType): string => MajorTypeNames[type];

/**
 * Numeric type that can be encoded in CBOR.
 *
 * Supports both standard JavaScript numbers and BigInt for large integers.
 * Numbers are automatically encoded as either unsigned or negative integers
 * depending on their value, following dCBOR canonical encoding rules.
 *
 * @example
 * ```typescript
 * const smallNum: CborNumber = 42;
 * const largeNum: CborNumber = 9007199254740992n;
 * ```
 */
export type CborNumber = number | bigint;

/**
 * Type for values that can be converted to CBOR.
 *
 * This is a comprehensive union type representing all values that can be encoded
 * as CBOR using the `cbor()` function. It includes:
 * - Already-encoded CBOR values (`Cbor`)
 * - Primitive types: numbers, bigints, strings, booleans, null, undefined
 * - Binary data: `Uint8Array`, `ByteString`
 * - Dates: `CborDate`
 * - Collections: `CborMap`, arrays, JavaScript `Map`, JavaScript `Set`
 * - Objects: Plain objects are converted to CBOR maps
 *
 * Matches Rust's `From<T>` trait implementations for CBOR.
 *
 * @example
 * ```typescript
 * cbor(42);                              // number
 * cbor("hello");                         // string
 * cbor([1, 2, 3]);                       // array
 * cbor(new Map([["key", "value"]]));     // Map
 * cbor({ name: "Alice", age: 30 });      // plain object -> CborMap
 * ```
 */
export type CborInput =
  | Cbor
  | CborNumber
  | string
  | boolean
  | null
  | undefined
  | Uint8Array
  | ByteString
  | CborDate
  | CborMap
  | CborInput[]
  | Map<unknown, unknown>
  | Set<unknown>
  | Record<string, unknown>;

export const isCborNumber = (value: unknown): value is CborNumber => {
  return typeof value === "number" || typeof value === "bigint";
};

export const isCbor = (value: unknown): value is Cbor => {
  return value !== null && typeof value === "object" && "isCbor" in value && value.isCbor === true;
};

export interface CborUnsignedType {
  readonly isCbor: true;
  readonly type: typeof MajorType.Unsigned;
  readonly value: CborNumber;
}
export interface CborNegativeType {
  readonly isCbor: true;
  readonly type: typeof MajorType.Negative;
  readonly value: CborNumber;
}
export interface CborByteStringType {
  readonly isCbor: true;
  readonly type: typeof MajorType.ByteString;
  readonly value: Uint8Array;
}
export interface CborTextType {
  readonly isCbor: true;
  readonly type: typeof MajorType.Text;
  readonly value: string;
}
export interface CborArrayType {
  readonly isCbor: true;
  readonly type: typeof MajorType.Array;
  readonly value: readonly Cbor[];
}
export interface CborMapType {
  readonly isCbor: true;
  readonly type: typeof MajorType.Map;
  readonly value: CborMap;
}
export interface CborTaggedType {
  readonly isCbor: true;
  readonly type: typeof MajorType.Tagged;
  readonly tag: CborNumber;
  readonly value: Cbor;
}
export interface CborSimpleType {
  readonly isCbor: true;
  readonly type: typeof MajorType.Simple;
  readonly value: Simple;
}

// Instance methods interface
export interface CborMethods {
  // Universal encoding/formatting
  toData(): Uint8Array;
  toHex(): string;
  toHexAnnotated(tagsStore?: TagsStore): string;
  toString(): string;
  toDebugString(): string;
  toDiagnostic(): string;
  toDiagnosticAnnotated(): string;

  // Type checking
  isByteString(): boolean;
  isText(): boolean;
  isArray(): boolean;
  isMap(): boolean;
  isTagged(): boolean;
  isSimple(): boolean;
  isBool(): boolean;
  isTrue(): boolean;
  isFalse(): boolean;
  isNull(): boolean;
  isNumber(): boolean;
  isInteger(): boolean;
  isUnsigned(): boolean;
  isNegative(): boolean;
  isNaN(): boolean;
  isFloat(): boolean;

  // Safe conversion (returns undefined on mismatch)
  asByteString(): Uint8Array | undefined;
  asText(): string | undefined;
  asArray(): readonly Cbor[] | undefined;
  asMap(): CborMap | undefined;
  asTagged(): [Tag, Cbor] | undefined;
  asBool(): boolean | undefined;
  asInteger(): (number | bigint) | undefined;
  asNumber(): (number | bigint) | undefined;
  asSimpleValue(): Simple | undefined;

  // Throwing conversion (throws on mismatch)
  /**
   * Convert to byte string, throwing if type doesn't match.
   * @throws {TypeError} If value is not a byte string type
   */
  toByteString(): Uint8Array;
  /**
   * Convert to text string, throwing if type doesn't match.
   * @throws {TypeError} If value is not a text string type
   */
  toText(): string;
  /**
   * Convert to array, throwing if type doesn't match.
   * @throws {TypeError} If value is not an array type
   */
  toArray(): readonly Cbor[];
  /**
   * Convert to map, throwing if type doesn't match.
   * @throws {TypeError} If value is not a map type
   */
  toMap(): CborMap;
  /**
   * Convert to tagged value, throwing if type doesn't match.
   * @throws {TypeError} If value is not a tagged type
   */
  toTagged(): [Tag, Cbor];
  /**
   * Convert to boolean, throwing if type doesn't match.
   * @throws {TypeError} If value is not a boolean (True/False) type
   */
  toBool(): boolean;
  /**
   * Convert to integer, throwing if type doesn't match.
   * @throws {TypeError} If value is not an integer (Unsigned or Negative) type
   */
  toInteger(): number | bigint;
  /**
   * Convert to number, throwing if type doesn't match.
   * @throws {TypeError} If value is not a numeric (Unsigned, Negative, or Float) type
   */
  toNumber(): number | bigint;
  /**
   * Convert to simple value, throwing if type doesn't match.
   * @throws {TypeError} If value is not a simple type
   */
  toSimpleValue(): Simple;
  /**
   * Expect specific tag and return content, throwing if tag doesn't match.
   * @param tag - Expected tag value
   * @throws {CborError} With type 'WrongType' if value is not tagged, or 'Custom' if tag doesn't match
   */
  expectTag(tag: CborNumber | Tag): Cbor;

  // Advanced operations
  /**
   * Walk the CBOR structure with a visitor function.
   * @param initialState - Initial state for the visitor
   * @param visitor - Visitor function called for each element
   */
  walk<State>(initialState: State, visitor: Visitor<State>): void;
  /**
   * Validate that value has one of the expected tags.
   * @param expectedTags - Array of expected tag values
   * @throws {CborError} With type 'WrongType' if value is not tagged, or 'Custom' if tag doesn't match any expected value
   */
  validateTag(expectedTags: Tag[]): Tag;
  /**
   * Remove one level of tagging, returning the inner content.
   */
  untagged(): Cbor;
}

export type Cbor = (
  | CborUnsignedType
  | CborNegativeType
  | CborByteStringType
  | CborTextType
  | CborArrayType
  | CborMapType
  | CborTaggedType
  | CborSimpleType
) &
  CborMethods;

// ============================================================================
// Encoding Functions (matches Rust CBOR conversion logic)
// ============================================================================

export interface ToCbor {
  toCbor(): Cbor;
}

export interface TaggedCborEncodable {
  taggedCbor(): Cbor;
}

/**
 * Type guard to check if value has taggedCbor method.
 */
const hasTaggedCbor = (value: unknown): value is TaggedCborEncodable => {
  return (
    typeof value === "object" &&
    value !== null &&
    "taggedCbor" in value &&
    typeof (value as TaggedCborEncodable).taggedCbor === "function"
  );
};

/**
 * Type guard to check if value has toCbor method.
 */
const hasToCbor = (value: unknown): value is ToCbor => {
  return (
    typeof value === "object" &&
    value !== null &&
    "toCbor" in value &&
    typeof (value as ToCbor).toCbor === "function"
  );
};

/**
 * Convert any value to a CBOR representation.
 * Matches Rust's `From` trait implementations for CBOR.
 */
export const cbor = (value: CborInput): Cbor => {
  // If already CBOR and has methods, return as-is
  if (isCbor(value) && "toData" in value) {
    return value;
  }

  // If CBOR but no methods, attach them
  if (isCbor(value)) {
    return attachMethods(value as Omit<Cbor, keyof CborMethods>) as Cbor;
  }

  let result: Omit<Cbor, keyof CborMethods>;

  if (isCborNumber(value)) {
    if (typeof value === "number" && Number.isNaN(value)) {
      result = { isCbor: true, type: MajorType.Simple, value: { type: "Float", value: NaN } };
    } else if (typeof value === "number" && hasFractionalPart(value)) {
      result = { isCbor: true, type: MajorType.Simple, value: { type: "Float", value: value } };
    } else if (value == Infinity) {
      result = { isCbor: true, type: MajorType.Simple, value: { type: "Float", value: Infinity } };
    } else if (value == -Infinity) {
      result = { isCbor: true, type: MajorType.Simple, value: { type: "Float", value: -Infinity } };
    } else if (value < 0) {
      // Store the magnitude to encode, matching Rust's representation
      // For a negative value n, CBOR encodes it as -1-n, so we store -n-1
      if (typeof value === "bigint") {
        result = { isCbor: true, type: MajorType.Negative, value: -value - 1n };
      } else {
        result = { isCbor: true, type: MajorType.Negative, value: -value - 1 };
      }
    } else {
      result = { isCbor: true, type: MajorType.Unsigned, value: value };
    }
  } else if (typeof value === "string") {
    // dCBOR requires all text strings to be in Unicode Normalization Form C (NFC)
    // This ensures deterministic encoding regardless of how the string was composed
    const normalized = value.normalize("NFC");
    result = { isCbor: true, type: MajorType.Text, value: normalized };
  } else if (value === null || value === undefined) {
    result = { isCbor: true, type: MajorType.Simple, value: { type: "Null" } };
  } else if (value === true) {
    result = { isCbor: true, type: MajorType.Simple, value: { type: "True" } };
  } else if (value === false) {
    result = { isCbor: true, type: MajorType.Simple, value: { type: "False" } };
  } else if (Array.isArray(value)) {
    result = { isCbor: true, type: MajorType.Array, value: value.map(cbor) };
  } else if (value instanceof Uint8Array) {
    result = { isCbor: true, type: MajorType.ByteString, value: value };
  } else if (value instanceof CborMap) {
    result = { isCbor: true, type: MajorType.Map, value: value };
  } else if (value instanceof Map) {
    result = { isCbor: true, type: MajorType.Map, value: new CborMap(value) };
  } else if (value instanceof Set) {
    result = {
      isCbor: true,
      type: MajorType.Array,
      value: Array.from(value).map((v) => cbor(v as CborInput)),
    };
  } else if (hasTaggedCbor(value)) {
    return value.taggedCbor();
  } else if (hasToCbor(value)) {
    return value.toCbor();
  } else if (typeof value === "object" && value !== null && "tag" in value && "value" in value) {
    // Handle plain tagged value format: { tag: number, value: unknown }
    const keys = Object.keys(value);
    const objValue = value as { tag: unknown; value: unknown; [key: string]: unknown };
    if (keys.length === 2 && keys.includes("tag") && keys.includes("value")) {
      return taggedCbor(objValue.tag, objValue.value as CborInput);
    }
    // Not a tagged value, fall through to map handling
    const map = new CborMap();
    for (const [key, val] of Object.entries(value)) {
      map.set(cbor(key as CborInput), cbor(val as CborInput));
    }
    result = { isCbor: true, type: MajorType.Map, value: map };
  } else if (typeof value === "object" && value !== null) {
    // Handle plain objects by converting to CborMap
    const map = new CborMap();
    for (const [key, val] of Object.entries(value)) {
      map.set(cbor(key as CborInput), cbor(val as CborInput));
    }
    result = { isCbor: true, type: MajorType.Map, value: map };
  } else {
    throw new CborError({ type: "Custom", message: "Unsupported type for CBOR encoding" });
  }

  return attachMethods(result) as Cbor;
};

export const cborHex = (value: CborInput): string => {
  return bytesToHex(cborData(value));
};

/**
 * Encode a CBOR value to binary data.
 * Matches Rust's `CBOR::to_cbor_data()` method.
 */
export const cborData = (value: CborInput): Uint8Array => {
  const c = cbor(value);
  switch (c.type) {
    case MajorType.Unsigned: {
      return encodeVarInt(c.value, MajorType.Unsigned);
    }
    case MajorType.Negative: {
      // Value is already stored as the magnitude to encode (matching Rust)
      return encodeVarInt(c.value, MajorType.Negative);
    }
    case MajorType.ByteString: {
      if (c.value instanceof Uint8Array) {
        const lengthBytes = encodeVarInt(c.value.length, MajorType.ByteString);
        return new Uint8Array([...lengthBytes, ...c.value]);
      }
      break;
    }
    case MajorType.Text: {
      if (typeof c.value === "string") {
        const utf8Bytes = new TextEncoder().encode(c.value);
        const lengthBytes = encodeVarInt(utf8Bytes.length, MajorType.Text);
        return new Uint8Array([...lengthBytes, ...utf8Bytes]);
      }
      break;
    }
    case MajorType.Tagged: {
      if (typeof c.tag === "bigint" || typeof c.tag === "number") {
        const tagBytes = encodeVarInt(c.tag, MajorType.Tagged);
        const valueBytes = cborData(c.value);
        return new Uint8Array([...tagBytes, ...valueBytes]);
      }
      break;
    }
    case MajorType.Simple: {
      // Use the simpleCborData function from simple.ts
      return simpleCborData(c.value);
    }
    case MajorType.Array: {
      const arrayBytes = c.value.map(cborData);
      const flatArrayBytes = concatBytes(arrayBytes);
      const lengthBytes = encodeVarInt(c.value.length, MajorType.Array);
      return new Uint8Array([...lengthBytes, ...flatArrayBytes]);
    }
    case MajorType.Map: {
      const entries = c.value.entriesArray;
      const arrayBytes = entries.map(({ key, value }) =>
        concatBytes([cborData(key), cborData(value)]),
      );
      const flatArrayBytes = concatBytes(arrayBytes);
      const lengthBytes = encodeVarInt(entries.length, MajorType.Map);
      return new Uint8Array([...lengthBytes, ...flatArrayBytes]);
    }
  }
  throw new CborError({ type: "WrongType" });
};

export const encodeCbor = (value: CborInput): Uint8Array => {
  return cborData(cbor(value));
};

export const taggedCbor = (tag: unknown, value: CborInput): Cbor => {
  // Validate and convert tag to CborNumber
  const tagNumber: CborNumber =
    typeof tag === "number" || typeof tag === "bigint" ? tag : Number(tag);
  return attachMethods({
    isCbor: true,
    type: MajorType.Tagged,
    tag: tagNumber,
    value: cbor(value),
  });
};

// ============================================================================
// Static Factory Functions
// (Keep only essential creation functions)
// ============================================================================

export const toByteString = (data: Uint8Array): Cbor => {
  return cbor(data);
};

export const toByteStringFromHex = (hex: string): Cbor => {
  return toByteString(hexToBytes(hex));
};

export const toTaggedValue = (tag: CborNumber | Tag, item: CborInput): Cbor => {
  const tagValue = typeof tag === "object" && "value" in tag ? tag.value : tag;
  return attachMethods({
    isCbor: true,
    type: MajorType.Tagged,
    tag: tagValue,
    value: cbor(item),
  });
};

export const cborFalse = (): Cbor => {
  return attachMethods({ isCbor: true, type: MajorType.Simple, value: { type: "False" } });
};

export const cborTrue = (): Cbor => {
  return attachMethods({ isCbor: true, type: MajorType.Simple, value: { type: "True" } });
};

export const cborNull = (): Cbor => {
  return attachMethods({ isCbor: true, type: MajorType.Simple, value: { type: "Null" } });
};

export const cborNaN = (): Cbor => {
  return attachMethods({
    isCbor: true,
    type: MajorType.Simple,
    value: { type: "Float", value: NaN },
  });
};

// ============================================================================
// Method Attachment System
// ============================================================================

/**
 * Attaches instance methods to a CBOR value.
 * This enables method chaining like cbor.toHex() instead of Cbor.toHex(cbor).
 * @internal
 */
export const attachMethods = <T extends Omit<Cbor, keyof CborMethods>>(obj: T): T & CborMethods => {
  return Object.assign(obj, {
    // Universal encoding/formatting
    toData(this: Cbor): Uint8Array {
      return cborData(this);
    },
    toHex(this: Cbor): string {
      return bytesToHex(cborData(this));
    },
    toHexAnnotated(this: Cbor, tagsStore?: TagsStore): string {
      tagsStore = tagsStore ?? getGlobalTagsStore();
      return hexOpt(this, { annotate: true, tagsStore });
    },
    toString(this: Cbor): string {
      return diagnosticOpt(this, { flat: true });
    },
    toDebugString(this: Cbor): string {
      return diagnosticOpt(this, { flat: false });
    },
    toDiagnostic(this: Cbor): string {
      return diagnosticOpt(this, { flat: false });
    },
    toDiagnosticAnnotated(this: Cbor): string {
      return diagnosticOpt(this, { annotate: true });
    },

    // Type checking
    isByteString(this: Cbor): boolean {
      return this.type === MajorType.ByteString;
    },
    isText(this: Cbor): boolean {
      return this.type === MajorType.Text;
    },
    isArray(this: Cbor): boolean {
      return this.type === MajorType.Array;
    },
    isMap(this: Cbor): boolean {
      return this.type === MajorType.Map;
    },
    isTagged(this: Cbor): boolean {
      return this.type === MajorType.Tagged;
    },
    isSimple(this: Cbor): boolean {
      return this.type === MajorType.Simple;
    },
    isBool(this: Cbor): boolean {
      return (
        this.type === MajorType.Simple &&
        (this.value.type === "True" || this.value.type === "False")
      );
    },
    isTrue(this: Cbor): boolean {
      return this.type === MajorType.Simple && this.value.type === "True";
    },
    isFalse(this: Cbor): boolean {
      return this.type === MajorType.Simple && this.value.type === "False";
    },
    isNull(this: Cbor): boolean {
      return this.type === MajorType.Simple && this.value.type === "Null";
    },
    isNumber(this: Cbor): boolean {
      if (this.type === MajorType.Unsigned || this.type === MajorType.Negative) {
        return true;
      }
      if (this.type === MajorType.Simple) {
        return isSimpleFloat(this.value);
      }
      return false;
    },
    isInteger(this: Cbor): boolean {
      return this.type === MajorType.Unsigned || this.type === MajorType.Negative;
    },
    isUnsigned(this: Cbor): boolean {
      return this.type === MajorType.Unsigned;
    },
    isNegative(this: Cbor): boolean {
      return this.type === MajorType.Negative;
    },
    isNaN(this: Cbor): boolean {
      return (
        this.type === MajorType.Simple &&
        this.value.type === "Float" &&
        Number.isNaN(this.value.value)
      );
    },
    isFloat(this: Cbor): boolean {
      return this.type === MajorType.Simple && isSimpleFloat(this.value);
    },

    // Safe conversion (returns undefined on mismatch)
    asByteString(this: Cbor): Uint8Array | undefined {
      return this.type === MajorType.ByteString ? this.value : undefined;
    },
    asText(this: Cbor): string | undefined {
      return this.type === MajorType.Text ? this.value : undefined;
    },
    asArray(this: Cbor): readonly Cbor[] | undefined {
      return this.type === MajorType.Array ? this.value : undefined;
    },
    asMap(this: Cbor): CborMap | undefined {
      return this.type === MajorType.Map ? this.value : undefined;
    },
    asTagged(this: Cbor): [Tag, Cbor] | undefined {
      if (this.type !== MajorType.Tagged) {
        return undefined;
      }
      const tag: Tag = { value: this.tag, name: `tag-${this.tag}` };
      return [tag, this.value];
    },
    asBool(this: Cbor): boolean | undefined {
      if (this.type !== MajorType.Simple) return undefined;
      if (this.value.type === "True") return true;
      if (this.value.type === "False") return false;
      return undefined;
    },
    asInteger(this: Cbor): (number | bigint) | undefined {
      if (this.type === MajorType.Unsigned) {
        return this.value;
      } else if (this.type === MajorType.Negative) {
        if (typeof this.value === "bigint") {
          return -this.value - 1n;
        } else {
          return -this.value - 1;
        }
      }
      return undefined;
    },
    asNumber(this: Cbor): (number | bigint) | undefined {
      if (this.type === MajorType.Unsigned) {
        return this.value;
      } else if (this.type === MajorType.Negative) {
        if (typeof this.value === "bigint") {
          return -this.value - 1n;
        } else {
          return -this.value - 1;
        }
      } else if (this.type === MajorType.Simple && isSimpleFloat(this.value)) {
        return this.value.value;
      }
      return undefined;
    },
    asSimpleValue(this: Cbor): Simple | undefined {
      return this.type === MajorType.Simple ? this.value : undefined;
    },

    // Throwing conversion (throws on mismatch)
    toByteString(this: Cbor): Uint8Array {
      if (this.type !== MajorType.ByteString) {
        throw new TypeError(
          `Cannot convert CBOR to ByteString: expected ByteString type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return this.value;
    },
    toText(this: Cbor): string {
      if (this.type !== MajorType.Text) {
        throw new TypeError(
          `Cannot convert CBOR to Text: expected Text type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return this.value;
    },
    toArray(this: Cbor): readonly Cbor[] {
      if (this.type !== MajorType.Array) {
        throw new TypeError(
          `Cannot convert CBOR to Array: expected Array type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return this.value;
    },
    toMap(this: Cbor): CborMap {
      if (this.type !== MajorType.Map) {
        throw new TypeError(
          `Cannot convert CBOR to Map: expected Map type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return this.value;
    },
    toTagged(this: Cbor): [Tag, Cbor] {
      if (this.type !== MajorType.Tagged) {
        throw new TypeError(
          `Cannot convert CBOR to Tagged: expected Tagged type, got ${getMajorTypeName(this.type)}`,
        );
      }
      const tag: Tag = { value: this.tag, name: `tag-${this.tag}` };
      return [tag, this.value];
    },
    toBool(this: Cbor): boolean {
      const result = this.asBool();
      if (result === undefined) {
        throw new TypeError(
          `Cannot convert CBOR to boolean: expected Simple(True/False) type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return result;
    },
    toInteger(this: Cbor): number | bigint {
      const result = this.asInteger();
      if (result === undefined) {
        throw new TypeError(
          `Cannot convert CBOR to integer: expected Unsigned or Negative type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return result;
    },
    toNumber(this: Cbor): number | bigint {
      const result = this.asNumber();
      if (result === undefined) {
        throw new TypeError(
          `Cannot convert CBOR to number: expected Unsigned, Negative, or Float type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return result;
    },
    toSimpleValue(this: Cbor): Simple {
      if (this.type !== MajorType.Simple) {
        throw new TypeError(
          `Cannot convert CBOR to Simple: expected Simple type, got ${getMajorTypeName(this.type)}`,
        );
      }
      return this.value;
    },
    expectTag(this: Cbor, expectedTag: CborNumber | Tag): Cbor {
      if (this.type !== MajorType.Tagged) {
        throw new CborError({ type: "WrongType" });
      }
      const expectedValue =
        typeof expectedTag === "object" && "value" in expectedTag ? expectedTag.value : expectedTag;
      if (this.tag !== expectedValue) {
        throw new CborError({
          type: "Custom",
          message: `Wrong tag: expected ${expectedValue}, got ${this.tag}`,
        });
      }
      return this.value;
    },

    // Advanced operations
    walk<State>(this: Cbor, initialState: State, visitor: Visitor<State>): void {
      walk(this, initialState, visitor);
    },
    validateTag(this: Cbor, expectedTags: Tag[]): Tag {
      if (this.type !== MajorType.Tagged) {
        throw new CborError({ type: "WrongType" });
      }
      const expectedValues = expectedTags.map((t) => t.value);
      const tagValue = this.tag;
      const matchingTag = expectedTags.find((t) => t.value === tagValue);
      if (matchingTag === undefined) {
        const expectedStr = expectedValues.join(" or ");
        throw new CborError({
          type: "Custom",
          message: `Wrong tag: expected ${expectedStr}, got ${tagValue}`,
        });
      }
      return matchingTag;
    },
    untagged(this: Cbor): Cbor {
      if (this.type !== MajorType.Tagged) {
        throw new CborError({ type: "WrongType" });
      }
      return this.value;
    },
  });
};

// ============================================================================
// Cbor Namespace - Static Constants and Factory Methods
// ============================================================================

/**
 * CBOR constants and helper methods.
 *
 * Provides constants for common simple values (False, True, Null) and static methods
 * matching the Rust CBOR API for encoding/decoding.
 */
// eslint-disable-next-line no-redeclare
export const Cbor = {
  // Static CBOR simple values (matching Rust naming) - with methods attached
  False: attachMethods({ isCbor: true, type: MajorType.Simple, value: { type: "False" } }),
  True: attachMethods({ isCbor: true, type: MajorType.Simple, value: { type: "True" } }),
  Null: attachMethods({ isCbor: true, type: MajorType.Simple, value: { type: "Null" } }),
  NaN: attachMethods({
    isCbor: true,
    type: MajorType.Simple,
    value: { type: "Float", value: NaN },
  }),

  // ============================================================================
  // Static Factory/Decoding Methods (matches Rust CBOR static methods)
  // ============================================================================

  /**
   * Creates a CBOR value from any JavaScript value.
   *
   * Matches Rust's `CBOR::from()` behavior for various types.
   *
   * @param value - Any JavaScript value (number, string, boolean, null, array, object, etc.)
   * @returns A CBOR symbolic representation with instance methods
   */
  from(value: CborInput): Cbor {
    return cbor(value);
  },

  /**
   * Decodes binary data into CBOR symbolic representation.
   *
   * Matches Rust's `CBOR::try_from_data()` method.
   *
   * @param data - The binary data to decode
   * @returns A CBOR value with instance methods
   * @throws Error if the data is not valid CBOR or violates dCBOR encoding rules
   */
  tryFromData(data: Uint8Array): Cbor {
    return decodeCbor(data);
  },

  /**
   * Decodes a hexadecimal string into CBOR symbolic representation.
   *
   * Matches Rust's `CBOR::try_from_hex()` method.
   *
   * @param hex - A string containing hexadecimal characters
   * @returns A CBOR value with instance methods
   * @throws Error if the hex string is invalid or the resulting data is not valid dCBOR
   */
  tryFromHex(hex: string): Cbor {
    const data = hexToBytes(hex);
    return this.tryFromData(data);
  },
};
