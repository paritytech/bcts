/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * ByteString pattern parser.
 *
 * @module parse/value/bytestring-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";
import { anyByteString, byteString, byteStringRegex } from "../../pattern";

/**
 * Parse a bytestring pattern from the `bytes` keyword.
 */
export const parseByteString = (_lexer: Lexer): Result<Pattern> => {
  // `bytes` keyword was already consumed
  return Ok(anyByteString());
};

/**
 * Parse a hex string token result into a pattern.
 */
export const parseHexStringToken = (hexResult: Result<Uint8Array>): Result<Pattern> => {
  if (!hexResult.ok) {
    return hexResult;
  }
  return Ok(byteString(hexResult.value));
};

/**
 * Parse a hex regex token result into a pattern.
 *
 * In TypeScript, binary regex matching is implemented by converting bytes to Latin-1 strings.
 * This mimics Rust's regex::bytes::Regex behavior where each byte 0-255 maps to a character.
 */
export const parseHexRegexToken = (regexResult: Result<RegExp>): Result<Pattern> => {
  if (!regexResult.ok) {
    return regexResult;
  }
  return Ok(byteStringRegex(regexResult.value));
};
