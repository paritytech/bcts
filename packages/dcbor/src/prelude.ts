/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Prelude module - Re-exports commonly used types and classes.
 *
 * This module provides a curated set of imports matching Rust's prelude.rs.
 * Exports only types, interfaces, and core classes - not convenience functions.
 *
 * Equivalent to Rust's prelude.rs
 *
 * @module prelude
 *
 * @example
 * ```typescript
 * import { Cbor, CborMap, ByteString, Tag } from './prelude';
 * ```
 */

// Core types
export { Cbor, MajorType } from "./cbor";
export type { Simple } from "./simple";
export type {
  CborUnsignedType,
  CborNegativeType,
  CborByteStringType,
  CborTextType,
  CborArrayType,
  CborMapType,
  CborTaggedType,
  CborSimpleType,
  CborNumber,
} from "./cbor";

// Codable interfaces
export type { CborEncodable, CborDecodable, CborCodable } from "./cbor-codable";

// Tagged value interfaces
export type {
  CborTagged,
  CborTaggedEncodable,
  CborTaggedDecodable,
  CborTaggedCodable,
} from "./cbor-tagged";

// Map and Set classes
export { CborMap } from "./map";
export { CborSet } from "./set";

// ByteString class
export { ByteString } from "./byte-string";

// Date class
export { CborDate } from "./date";

// Tag handling
export type { Tag } from "./tag";
export { createTag } from "./tag";
export { TagsStore, getGlobalTagsStore, withTags, withTagsMut } from "./tags-store";
export type { TagsStoreTrait } from "./tags-store";
export { tagsForValues } from "./tags";

// Format options
export type { DiagFormatOpts } from "./diag";
export type { HexFormatOpts } from "./dump";

// Walk/traversal
export { EdgeType } from "./walk";
export type { WalkElement, EdgeTypeVariant, Visitor } from "./walk";

// BigNum support
export { biguintToCbor, bigintToCbor, cborToBiguint, cborToBigint } from "./bignum";

// Error handling
export type { Error, Result } from "./error";
export { Ok, Err, errorMsg, errorToString, CborError } from "./error";
