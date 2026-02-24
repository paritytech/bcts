/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Match dCBOR data against a pattern
 * Equivalent to Rust's cmd/match.rs
 */
/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/switch-exhaustiveness-check */

import { type Cbor, type Result, decodeCbor, hexToBytes, errorMsg } from "@bcts/dcbor";
import { parseDcborItem, fullErrorMessage } from "@bcts/dcbor-parse";
import {
  parse as parsePattern,
  pathsWithCaptures,
  formatPathsWithCaptures,
  FormatPathsOptsBuilder,
  type Error as PatternParseError,
} from "@bcts/dcbor-pattern";
import type { Exec } from "./index.js";
import { type OutputFormat, formatOutput } from "../format.js";
import type { InputFormat } from "../format.js";

/**
 * Match output format options
 */
export type MatchOutputFormat = "paths" | "diag" | "hex" | "bin";

/**
 * Command arguments for match command
 */
export interface MatchCommandArgs {
  /** The pattern to match against */
  pattern: string;
  /** dCBOR input (hex, diag, or binary). If not provided, reads from stdin */
  input?: string | undefined;
  /** Input format (default: diag) */
  in: InputFormat;
  /** Output format (default: paths) */
  out: MatchOutputFormat;
  /** Disable indentation of path elements */
  noIndent: boolean;
  /** Show only the last element of each path */
  lastOnly: boolean;
  /** Add annotations to output */
  annotate: boolean;
  /** Include capture information in output */
  captures: boolean;
}

/**
 * Format a parse error with context
 */
function formatPatternError(error: PatternParseError, patternStr: string): string {
  switch (error.type) {
    case "UnrecognizedToken": {
      const start = Math.min(error.span.start, patternStr.length);
      const end = Math.min(error.span.end, patternStr.length);
      const errorText = start < patternStr.length ? patternStr.slice(start, end) : "<end of input>";
      return `Failed to parse pattern at position ${start}..${end}: unrecognized token '${errorText}'\nPattern: ${patternStr}\n         ${" ".repeat(start)}^`;
    }

    case "ExtraData": {
      const start = Math.min(error.span.start, patternStr.length);
      return `Failed to parse pattern: extra data at position ${start}\nPattern: ${patternStr}\n         ${" ".repeat(start)}^`;
    }

    case "UnexpectedToken": {
      const start = Math.min(error.span.start, patternStr.length);
      return `Failed to parse pattern at position ${start}: unexpected token\nPattern: ${patternStr}\n         ${" ".repeat(start)}^`;
    }

    default:
      return `Failed to parse pattern: ${error.type}`;
  }
}

/**
 * Execute match command
 */
export function execMatch(args: MatchCommandArgs, stdinContent?: string): Result<string> {
  // Read input data
  let inputData: Uint8Array;
  if (args.input !== undefined) {
    inputData = new TextEncoder().encode(args.input);
  } else if (stdinContent !== undefined) {
    inputData = new TextEncoder().encode(stdinContent);
  } else {
    inputData = new Uint8Array(0);
  }

  // Parse input based on format
  let cbor: Cbor;
  try {
    switch (args.in) {
      case "diag": {
        const inputStr = new TextDecoder().decode(inputData).trim();
        const result = parseDcborItem(inputStr);
        if (!result.ok) {
          return {
            ok: false,
            error: errorMsg(fullErrorMessage(result.error, inputStr)),
          };
        }
        cbor = result.value;
        break;
      }
      case "hex": {
        const inputStr = new TextDecoder().decode(inputData).trim();
        cbor = decodeCbor(hexToBytes(inputStr));
        break;
      }
      case "bin": {
        cbor = decodeCbor(inputData);
        break;
      }
      default:
        return { ok: false, error: errorMsg(`Unknown input format: ${args.in}`) };
    }
  } catch (e) {
    return { ok: false, error: errorMsg(e instanceof Error ? e.message : String(e)) };
  }

  // Parse pattern
  const patternResult = parsePattern(args.pattern);
  if (!patternResult.ok) {
    return {
      ok: false,
      error: errorMsg(formatPatternError(patternResult.error, args.pattern)),
    };
  }
  const pattern = patternResult.value;

  // Execute pattern matching
  const { paths, captures } = pathsWithCaptures(pattern, cbor);

  // Check for matches
  if (paths.length === 0) {
    return { ok: false, error: errorMsg("No match") };
  }

  // Format output based on requested format
  switch (args.out) {
    case "paths": {
      // Build format options from command line arguments
      const formatOptions = FormatPathsOptsBuilder.new()
        .indent(!args.noIndent)
        .lastElementOnly(args.lastOnly)
        .build();

      // Show captures only if explicitly requested
      if (args.captures) {
        return {
          ok: true,
          value: formatPathsWithCaptures(paths, captures, formatOptions),
        };
      } else {
        // Show paths without captures
        return {
          ok: true,
          value: formatPathsWithCaptures(paths, new Map(), formatOptions),
        };
      }
    }

    case "diag":
    case "hex":
    case "bin": {
      // For data format outputs, extract the matched elements
      const outputFormat: OutputFormat = args.out;

      const elementsToOutput = args.lastOnly
        ? paths.map((path) => path[path.length - 1]).filter(Boolean)
        : paths.map((path) => path[0]).filter(Boolean);

      const results: string[] = [];
      for (const element of elementsToOutput) {
        const result = formatOutput(element, outputFormat, args.annotate);
        if (!result.ok) {
          return result;
        }
        results.push(result.value);
      }

      return { ok: true, value: results.join("\n") };
    }

    default:
      return { ok: false, error: errorMsg(`Unknown output format: ${args.out}`) };
  }
}

/**
 * Create an Exec implementation for match command
 */
export function createMatchCommand(args: MatchCommandArgs, stdinContent?: string): Exec {
  return {
    exec: () => execMatch(args, stdinContent),
  };
}
