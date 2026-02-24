/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Parse registry for resolving circular dependencies between parsers.
 *
 * @module parse/parse-registry
 */

import type { Lexer } from "./token";
import type { Pattern } from "../pattern";
import type { Result } from "../error";

/**
 * The registered parseOr function.
 */
export let parseOrFn: ((lexer: Lexer) => Result<Pattern>) | undefined;

/**
 * Registers the parseOr function.
 */
export const setParseOrFn = (fn: (lexer: Lexer) => Result<Pattern>): void => {
  parseOrFn = fn;
};

/**
 * Calls the registered parseOr function.
 */
export const parseOrFromRegistry = (lexer: Lexer): Result<Pattern> => {
  if (parseOrFn === undefined) {
    throw new Error("ParseOr function not initialized. Import parse/index to initialize.");
  }
  return parseOrFn(lexer);
};
