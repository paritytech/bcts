/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

// Core types
export { UR } from "./ur";
export { URType } from "./ur-type";

// Error types (matching Rust's Error enum variants)
export {
  URError,
  URDecodeError,
  InvalidSchemeError,
  TypeUnspecifiedError,
  InvalidTypeError,
  NotSinglePartError,
  UnexpectedTypeError,
  BytewordsError,
  CBORError,
  isError,
} from "./error";

export type { Result } from "./error";

// Traits/Interfaces
export {
  isUREncodable,
  urFromEncodable,
  urStringFromEncodable,
} from "./ur-encodable";
export type { UREncodable } from "./ur-encodable";
export {
  isURDecodable,
  decodableFromUR,
  decodableFromURString,
} from "./ur-decodable";
export type { URDecodable } from "./ur-decodable";
export { isURCodable } from "./ur-codable";
export type { URCodable } from "./ur-codable";

// Multipart encoding/decoding
export { MultipartEncoder } from "./multipart-encoder";
export { MultipartDecoder } from "./multipart-decoder";

// URType validation helpers (mirroring Rust's `URTypeChar` / `URTypeString`
// trait sugar in `bc-ur-rust/src/utils.rs`).
export { isURTypeChar, isValidURType, validateURType } from "./utils";

// Bytewords module (matching Rust's pub mod bytewords)
export {
  BYTEWORDS,
  BYTEMOJIS,
  BytewordsStyle,
  encodeBytewords,
  decodeBytewords,
  encodeBytewordsIdentifier,
  encodeBytemojisIdentifier,
  encodeToWords,
  encodeToBytemojis,
  encodeToMinimalBytewords,
  isValidBytemoji,
  canonicalizeByteword,
} from "./utils";

// Namespace-style re-export so callers can write `bytewords.encode(...)` /
// `bytewords.decode(...)` to mirror Rust's `bc_ur::bytewords::encode(...)` etc.
// Tracked in PARITY_AUDIT.md §3.1 / §4.5.
export * as bytewords from "./bytewords-namespace";
