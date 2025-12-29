/**
 * ByteString pattern parser.
 *
 * @module parse/value/bytestring-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok, Err } from "../../error";
import { anyByteString, byteString, text } from "../../pattern";

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
export const parseHexStringToken = (
  hexResult: Result<Uint8Array>,
): Result<Pattern> => {
  if (!hexResult.ok) {
    return hexResult;
  }
  return Ok(byteString(hexResult.value));
};

/**
 * Parse a hex regex token result into a pattern.
 * Note: In TypeScript, we convert bytes to hex string for regex matching.
 */
export const parseHexRegexToken = (
  regexResult: Result<RegExp>,
): Result<Pattern> => {
  if (!regexResult.ok) {
    return regexResult;
  }
  // For hex regex, we use text regex on hex-encoded strings
  // This is a limitation compared to Rust's bytes::Regex
  return Err({ type: "Unknown" }); // TODO: Implement proper hex regex matching
};
