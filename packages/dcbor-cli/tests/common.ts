/**
 * Common test utilities for dcbor-cli tests
 *
 * Ported from ref/bc-dcbor-cli/tests/common/mod.rs
 */

import { expect } from "vitest";
import { run, type Command, type RunOptions } from "../src/run.js";
import type { InputFormat, OutputFormat } from "../src/format.js";
import type { MatchOutputFormat } from "../src/cmd/index.js";

/**
 * Run the CLI with given arguments and return the output
 */
export function runCli(command: Command, stdinContent?: string): string {
  const options: RunOptions = { command, stdinContent };
  const result = run(options);

  if (!result.ok) {
    throw result.error;
  }

  return result.value.output.trim();
}

/**
 * Run the CLI and expect a specific output
 */
export function runCliExpect(command: Command, expected: string, stdinContent?: string): void {
  const output = runCli(command, stdinContent);
  expect(output).toBe(expected.trim());
}

/**
 * Create a default command for diag->hex conversion
 */
export function diagToHex(input: string, annotate = false): Command {
  return {
    type: "default",
    input,
    in: "diag" as InputFormat,
    out: "hex" as OutputFormat,
    annotate,
  };
}

/**
 * Create a default command for hex->diag conversion
 */
export function hexToDiag(input: string, annotate = false): Command {
  return {
    type: "default",
    input,
    in: "hex" as InputFormat,
    out: "diag" as OutputFormat,
    annotate,
  };
}

/**
 * Create an array command
 */
export function arrayCmd(
  elements: string[],
  out: OutputFormat = "diag",
  annotate = false,
): Command {
  return {
    type: "array",
    elements,
    out,
    annotate,
  };
}

/**
 * Create a map command
 */
export function mapCmd(kvPairs: string[], out: OutputFormat = "diag", annotate = false): Command {
  return {
    type: "map",
    kvPairs,
    out,
    annotate,
  };
}

/**
 * Create a match command
 */
export function matchCmd(
  pattern: string,
  input: string,
  options: {
    in?: InputFormat;
    out?: MatchOutputFormat;
    noIndent?: boolean;
    lastOnly?: boolean;
    annotate?: boolean;
    captures?: boolean;
  } = {},
): Command {
  return {
    type: "match",
    pattern,
    input,
    in: options.in ?? "diag",
    out: options.out ?? "diag",
    noIndent: options.noIndent ?? false,
    lastOnly: options.lastOnly ?? false,
    annotate: options.annotate ?? false,
    captures: options.captures ?? false,
  };
}

/**
 * Test round-trip conversion between diag and hex
 */
export function testRoundTrip(diag: string, hex: string, retDiag?: string): void {
  // diag -> hex
  runCliExpect(diagToHex(diag), hex);
  // hex -> diag
  runCliExpect(hexToDiag(hex), retDiag ?? diag);
}
