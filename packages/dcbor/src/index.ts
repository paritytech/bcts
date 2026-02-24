/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * BC-DCBOR TypeScript Library
 *
 * A TypeScript implementation of Blockchain Commons' Deterministic CBOR (dCBOR).
 *
 * @module bc-dcbor
 */

// Core CBOR types and encoding/decoding
export {
  Cbor,
  type CborInput,
  type CborNumber,
  type CborMethods,
  MajorType,
  type CborUnsignedType,
  type CborNegativeType,
  type CborByteStringType,
  type CborTextType,
  type CborArrayType,
  type CborMapType,
  type CborTaggedType,
  type CborSimpleType,
} from "./cbor";

// Simple value types
export { type Simple, simpleName, isNaN } from "./simple";

// Encoding/Decoding
export { cbor, cborData } from "./cbor";
export { decodeCbor } from "./decode";

// Factory functions (static creators)
export { toByteString, toByteStringFromHex, toTaggedValue } from "./cbor";

// Map and Set
export { CborMap, type MapEntry } from "./map";
export { CborSet } from "./set";

// Tags and Tagged values
export { type Tag, createTag } from "./tag";
export {
  type CborTagged,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  type CborTaggedCodable,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
} from "./cbor-tagged";
export {
  TagsStore,
  type TagsStoreTrait,
  type CborSummarizer,
  type SummarizerResult,
  getGlobalTagsStore,
} from "./tags-store";
export * from "./tags";
export { registerTags, registerTagsIn, tagsForValues } from "./tags";

// Date utilities
export { CborDate } from "./date";

// Diagnostic formatting
export { diagnosticOpt, summary, type DiagFormatOpts } from "./diag";

// Hex formatting
export { hexOpt, hexToBytes, bytesToHex, type HexFormatOpts } from "./dump";

// Walk/Traversal functionality
export {
  type EdgeType,
  type EdgeTypeVariant,
  type WalkElement,
  type Visitor,
  walk,
  asSingle,
  asKeyValue,
  edgeLabel,
} from "./walk";

// Codable interfaces
export { type CborCodable, type CborEncodable, type CborDecodable } from "./cbor-codable";

// Error types (matches Rust's Error enum)
export { type Error, type Result, Ok, Err, errorMsg, errorToString, CborError } from "./error";

// Note: conveniences.ts is an internal module (not exported in Rust either)
// The main convenience functions are exported from cbor.ts above

// BigNum support (CBOR tags 2/3, RFC 8949 §3.4.3)
export {
  biguintToCbor,
  bigintToCbor,
  cborToBiguint,
  cborToBigint,
  biguintFromUntaggedCbor,
  bigintFromNegativeUntaggedCbor,
} from "./bignum";

// Float utilities
export { hasFractionalPart } from "./float";

// Varint utilities
export { encodeVarInt, decodeVarInt, decodeVarIntData } from "./varint";

// Type utilities
export { ByteString } from "./byte-string";

// Convenience utilities - type guards
export {
  isUnsigned,
  isNegative,
  isInteger,
  isBytes,
  isText,
  isArray,
  isMap,
  isTagged,
  isSimple,
  isBoolean,
  isNull,
  isFloat,
} from "./conveniences";

// Convenience utilities - safe extraction (returns undefined on type mismatch)
export {
  asUnsigned,
  asNegative,
  asInteger,
  asBytes,
  asText,
  asArray,
  asMap,
  asBoolean,
  asFloat,
  asNumber,
} from "./conveniences";

// Convenience utilities - expectations (throw on type mismatch)
export {
  expectUnsigned,
  expectNegative,
  expectInteger,
  expectBytes,
  expectText,
  expectArray,
  expectMap,
  expectBoolean,
  expectFloat,
  expectNumber,
  // Aliases for envelope compatibility
  expectText as tryIntoText,
  expectBoolean as tryIntoBool,
  expectBytes as tryIntoByteString,
} from "./conveniences";

// Convenience utilities - array operations
export { arrayItem, arrayLength, arrayIsEmpty } from "./conveniences";

// Convenience utilities - map operations
export { mapValue, mapHas, mapKeys, mapValues, mapSize, mapIsEmpty } from "./conveniences";

// Convenience utilities - tagged value operations
export {
  tagValue,
  tagContent,
  hasTag,
  getTaggedContent,
  expectTaggedContent,
  // Alias for envelope compatibility
  expectTaggedContent as tryExpectedTaggedValue,
} from "./conveniences";

// Extract native JavaScript value from CBOR
export { extractCbor } from "./conveniences";

// Envelope compatibility functions
export {
  asTaggedValue,
  asByteString,
  asCborArray,
  type CborArrayWrapper,
  asCborMap,
  isNumber,
} from "./conveniences";
