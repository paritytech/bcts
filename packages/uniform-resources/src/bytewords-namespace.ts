/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Namespace-style re-export of the bytewords helpers in `./utils`.
 *
 * Mirrors Rust's `bc_ur::bytewords` module (`bc-ur-rust/src/bytewords.rs`)
 * so that callers can write
 *
 * ```ts
 * import { bytewords } from "@bcts/uniform-resources";
 * bytewords.encode(data, bytewords.Style.Minimal);
 * bytewords.identifier(fourByteSlice);
 * ```
 *
 * matching the ergonomics of
 *
 * ```rust
 * use bc_ur::bytewords;
 * bytewords::encode(data, bytewords::Style::Minimal);
 * bytewords::identifier(four_byte_slice);
 * ```
 *
 * This is purely an alias module — every symbol below is the same
 * function/value already exported individually from the package root.
 */

export {
  BYTEWORDS,
  BYTEMOJIS,
  BytewordsStyle as Style,
  encodeBytewords as encode,
  decodeBytewords as decode,
  encodeBytewordsIdentifier as identifier,
  encodeBytemojisIdentifier as bytemojiIdentifier,
  encodeToWords,
  encodeToBytemojis,
  encodeToMinimalBytewords,
  isValidBytemoji,
  canonicalizeByteword,
} from "./utils";
