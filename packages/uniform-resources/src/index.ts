/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
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
export { isUREncodable } from "./ur-encodable";
export type { UREncodable } from "./ur-encodable";
export { isURDecodable } from "./ur-decodable";
export type { URDecodable } from "./ur-decodable";
export { isURCodable } from "./ur-codable";
export type { URCodable } from "./ur-codable";

// Multipart encoding/decoding
export { MultipartEncoder } from "./multipart-encoder";
export { MultipartDecoder } from "./multipart-decoder";

// Bytewords module (matching Rust's pub mod bytewords)
export {
  BYTEWORDS,
  BYTEMOJIS,
  BytewordsStyle,
  encodeBytewords,
  decodeBytewords,
  encodeBytewordsIdentifier,
  encodeBytemojisIdentifier,
} from "./utils";
