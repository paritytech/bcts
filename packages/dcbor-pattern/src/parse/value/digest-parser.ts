/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Digest pattern parser.
 *
 * @module parse/value/digest-parser
 */

import type { Lexer } from "../token";
import type { Pattern } from "../../pattern";
import type { Result } from "../../error";
import { Ok } from "../../error";

// Import digest pattern constructor
import { digestPatternAny } from "../../pattern/value/digest-pattern";

/**
 * Parse a digest pattern from the `digest` keyword.
 */
export const parseDigest = (_lexer: Lexer): Result<Pattern> => {
  // `digest` keyword was already consumed
  return Ok({
    kind: "Value",
    pattern: { type: "Digest", pattern: digestPatternAny() },
  });
};
