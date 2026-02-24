/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Main run function for dcbor-cli
 * Equivalent to Rust's run function in main.rs
 */

import { registerTags, errorToString } from "@bcts/dcbor";
import type { InputFormat, OutputFormat } from "./format.js";
import { execArray, execDefault, execMap, execMatch, type MatchOutputFormat } from "./cmd/index.js";

/**
 * Command type discriminator
 */
export type Command =
  | { type: "array"; elements: string[]; out: OutputFormat; annotate: boolean }
  | { type: "map"; kvPairs: string[]; out: OutputFormat; annotate: boolean }
  | {
      type: "match";
      pattern: string;
      input?: string | undefined;
      in: InputFormat;
      out: MatchOutputFormat;
      noIndent: boolean;
      lastOnly: boolean;
      annotate: boolean;
      captures: boolean;
    }
  | {
      type: "default";
      input?: string | undefined;
      in: InputFormat;
      out: OutputFormat;
      annotate: boolean;
    };

export interface RunOptions {
  command: Command;
  stdinContent?: string | undefined;
}

export interface RunResult {
  output: string;
  isBinary: boolean;
}

/**
 * Main execution function
 * Equivalent to Rust's run<I, T, R, W> function
 */
export function run(
  options: RunOptions,
): { ok: true; value: RunResult } | { ok: false; error: Error } {
  // Register BC components tags
  registerTags();

  const { command, stdinContent } = options;

  let output: string;
  let isBinary = false;

  switch (command.type) {
    case "array": {
      const result = execArray({
        elements: command.elements,
        out: command.out,
        annotate: command.annotate,
      });
      if (!result.ok) {
        return { ok: false, error: new Error(errorToString(result.error)) };
      }
      output = result.value;
      isBinary = command.out === "bin";
      break;
    }

    case "map": {
      const result = execMap({
        kvPairs: command.kvPairs,
        out: command.out,
        annotate: command.annotate,
      });
      if (!result.ok) {
        return { ok: false, error: new Error(errorToString(result.error)) };
      }
      output = result.value;
      isBinary = command.out === "bin";
      break;
    }

    case "match": {
      const result = execMatch(
        {
          pattern: command.pattern,
          input: command.input,
          in: command.in,
          out: command.out,
          noIndent: command.noIndent,
          lastOnly: command.lastOnly,
          annotate: command.annotate,
          captures: command.captures,
        },
        stdinContent,
      );
      if (!result.ok) {
        return { ok: false, error: new Error(errorToString(result.error)) };
      }
      output = result.value;
      isBinary = command.out === "bin";
      break;
    }

    case "default": {
      const result = execDefault(
        {
          input: command.input,
          in: command.in,
          out: command.out,
          annotate: command.annotate,
        },
        stdinContent,
      );
      if (!result.ok) {
        return { ok: false, error: new Error(errorToString(result.error)) };
      }
      output = result.value;
      isBinary = command.out === "bin";
      break;
    }

    default:
      return { ok: false, error: new Error("Unknown command type") };
  }

  return { ok: true, value: { output, isBinary } };
}
