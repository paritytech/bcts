/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
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

// Parse functions
export { parseDcborItem, parseDcborItemPartial } from "./parse";

// Token types
export { type Token, token, Lexer } from "./token";

// Error types
export {
  type Span,
  span,
  defaultSpan,
  type ParseError,
  parseError,
  type ParseResult,
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

// Compose functions
export {
  type ComposeError,
  composeError,
  type ComposeResult,
  composeOk,
  composeErr,
  composeErrorMessage,
  composeDcborArray,
  composeDcborMap,
} from "./compose";
