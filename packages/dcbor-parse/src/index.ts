/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * # dCBOR Diagnostic Parser and Composer
 *
 * This package provides tools for parsing and composing the [CBOR diagnostic
 * notation](https://datatracker.ietf.org/doc/html/rfc8949#name-diagnostic-notation)
 * into [dCBOR (deterministic CBOR)](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/)
 * data items.
 *
 * It is intended for use in testing, debugging, and other scenarios where a
 * human-readable representation of dCBOR is useful. It is not optimized for
 * performance and should not be used in production environments where binary
 * dCBOR is expected.
 *
 * The primary functions provided are:
 *
 * - `parseDcborItem`: Parses a string in CBOR diagnostic notation into a `Cbor` object.
 * - `composeDcborArray`: Composes a `Cbor` array from a slice of strings
 *   representing dCBOR items in diagnostic notation.
 * - `composeDcborMap`: Composes a `Cbor` map from a slice of strings
 *   representing the key-value pairs in dCBOR diagnostic notation.
 *
 * ## Supported Types
 *
 * | Type                | Example(s)                                                  |
 * | ------------------- | ----------------------------------------------------------- |
 * | Boolean             | `true`, `false`                                             |
 * | Null                | `null`                                                      |
 * | Integers            | `0`, `1`, `-1`, `42`                                        |
 * | Floats              | `3.14`, `-2.5`, `Infinity`, `-Infinity`, `NaN`              |
 * | Strings             | `"hello"`, `"🌎"`                                           |
 * | Date Literals       | `2023-02-08`, `2023-02-08T15:30:45Z`, `1965-05-15`          |
 * | Hex Byte Strings    | `h'68656c6c6f'`                                             |
 * | Base64 Byte Strings | `b64'AQIDBAUGBwgJCg=='`                                     |
 * | Tagged Values       | `1234("hello")`, `5678(3.14)`                               |
 * | Name-Tagged Values  | `tag-name("hello")`, `tag-name(3.14)`                       |
 * | Known Values        | `'1'`, `'isA'`                                              |
 * | Unit Known Value    | `Unit`, `''`, `'0'`                                         |
 * | URs                 | `ur:date/cyisdadmlasgtapttl`                                |
 * | Arrays              | `[1, 2, 3]`, `["hello", "world"]`, `[1, [2, 3]]`            |
 * | Maps                | `{1: 2, 3: 4}`, `{"key": "value"}`, `{1: [2, 3], 4: 5}`     |
 *
 * @module dcbor-parse
 */

// =============================================================================
// Public surface that mirrors Rust `bc-dcbor-parse-rust/src/lib.rs:59-72`.
//
// Rust re-exports:
//   - `parse_dcbor_item`, `parse_dcbor_item_partial`
//   - `Token`
//   - `Error as ParseError`, `Result as ParseResult`
//   - `Error as ComposeError`, `Result as ComposeResult`,
//     `compose_dcbor_array`, `compose_dcbor_map`
// =============================================================================

// Parse functions
export { parseDcborItem, parseDcborItemPartial } from "./parse";

// Token types — Rust exposes only the `Token` enum publicly.
export { type Token } from "./token";

// Error types — Rust exposes only `ParseError` (the error enum) and
// `ParseResult` (the result type alias).
export { type ParseError, type ParseResult } from "./error";

// Compose types and functions — Rust exposes `ComposeError`,
// `ComposeResult`, and the two `compose_*` functions.
export {
  type ComposeError,
  type ComposeResult,
  composeDcborArray,
  composeDcborMap,
} from "./compose";

// =============================================================================
// TypeScript-only conveniences.
//
// Rust models its `Result<T, E>` natively via the `Result<T, E>` enum
// and `?` operator; the Logos lexer is a private implementation detail.
// In TypeScript we model `ParseResult<T>` as a discriminated union, so
// helper constructors and discriminators (`ok`, `err`, `isOk`, `isErr`,
// `unwrap`, `unwrapErr`, `parseError`, `composeError`, `composeOk`,
// `composeErr`, `Span`, …) are mandatory ergonomics. They are exported
// here as TS-only helpers and are **not** part of the Rust↔TS parity
// surface — Rust callers don't see them, and TS callers writing
// strictly-portable code shouldn't depend on them.
//
// `Lexer` and the `token` constructor namespace are likewise TS-only;
// in Rust the lexer is created via `Token::lexer(src)` internally and
// consumers never instantiate it directly. These re-exports stay so
// existing test code keeps working, but production callers should
// prefer `parseDcborItem` / `parseDcborItemPartial`.
// =============================================================================

// Token — TS-only convenience namespace for constructing tokens from
// userland (rare; mostly used in tests). The `Lexer` class is also
// TS-only — Rust treats `Token::lexer(...)` as an internal API.
export { token, Lexer } from "./token";

// Error helpers — `Span`/`span`/`defaultSpan` are TS-only because Rust
// uses the `logos::Span` type alias directly. The `ok`/`err`/`isOk`/
// `isErr`/`unwrap`/`unwrapErr` helpers are TS-only `Result`-modeling
// utilities. `parseError`, `isDefaultError`, `errorMessage`,
// `errorSpan`, `fullErrorMessage`, and `defaultParseError` are
// likewise convenience helpers around the discriminated union.
export {
  type Span,
  span,
  defaultSpan,
  parseError,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapErr,
  isDefaultError,
  errorMessage,
  errorSpan,
  fullErrorMessage,
  defaultParseError,
} from "./error";

// Compose helpers — `composeError`/`composeOk`/`composeErr`/
// `composeErrorMessage` are the TS-only counterparts of the
// `ComposeError`/`ComposeResult` discriminated union ergonomics.
export { composeError, composeOk, composeErr, composeErrorMessage } from "./compose";
