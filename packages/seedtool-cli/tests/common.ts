/**
 * Test utilities for seedtool-cli
 * Ported from seedtool-cli-rust/tests/common/mod.rs
 */

import { spawnSync } from "child_process";
import { resolve } from "path";

const CLI_PATH = resolve(__dirname, "../dist/main.mjs");

/**
 * Run the CLI with arguments and optional stdin.
 * Returns the raw output (not trimmed).
 */
export function runCliRawStdin(args: string[], stdin: string = ""): string {
  const result = spawnSync("node", [CLI_PATH, ...args], {
    input: stdin,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * Run the CLI with arguments.
 * Returns the raw output (not trimmed).
 */
export function runCliRaw(args: string[]): string {
  return runCliRawStdin(args, "");
}

/**
 * Run the CLI and expect a specific raw output.
 */
export function runCliRawExpect(args: string[], expected: string): void {
  const output = runCliRaw(args);
  if (expected.trim() !== output) {
    throw new Error(`Expected:\n${expected}\nGot:\n${output}`);
  }
}

/**
 * Run the CLI with arguments and optional stdin.
 * Returns trimmed output.
 */
export function runCliStdin(args: string[], stdin: string = ""): string {
  return runCliRawStdin(args, stdin).trim();
}

/**
 * Run the CLI with arguments.
 * Returns trimmed output.
 */
export function runCli(args: string[]): string {
  return runCliStdin(args, "");
}

/**
 * Run the CLI with arguments and stdin, expect a specific output.
 */
export function runCliExpectStdin(
  args: string[],
  expected: string,
  stdin: string = ""
): void {
  const output = runCliStdin(args, stdin);
  if (expected.trim() !== output) {
    throw new Error(`Expected:\n${expected.trim()}\nGot:\n${output}`);
  }
}

/**
 * Run the CLI and expect a specific output.
 */
export function runCliExpect(args: string[], expected: string): void {
  runCliExpectStdin(args, expected, "");
}

/**
 * Run commands in sequence, piping output of previous to next.
 * Returns raw output (not trimmed).
 */
export function runCliRawPipedStdin(cmds: string[][], stdin: string = ""): string {
  let output = stdin;
  for (const cmd of cmds) {
    output = runCliRawStdin(cmd, output);
  }
  return output;
}

/**
 * Run commands in sequence, piping output of previous to next.
 * Returns trimmed output.
 */
export function runCliPipedStdin(cmds: string[][], stdin: string = ""): string {
  return runCliRawPipedStdin(cmds, stdin).trim();
}

/**
 * Run commands in sequence, piping output.
 * Returns trimmed output.
 */
export function runCliPiped(cmds: string[][]): string {
  return runCliPipedStdin(cmds, "");
}

/**
 * Run commands in sequence and expect a specific output.
 */
export function runCliPipedExpectStdin(
  cmds: string[][],
  expected: string,
  stdin: string = ""
): void {
  const output = runCliPipedStdin(cmds, stdin);
  if (expected !== output) {
    throw new Error(`Expected:\n${expected}\nGot:\n${output}`);
  }
}

/**
 * Run commands in sequence and expect a specific output.
 */
export function runCliPipedExpect(cmds: string[][], expected: string): void {
  runCliPipedExpectStdin(cmds, expected, "");
}

/**
 * Run commands in sequence.
 * Returns raw output.
 */
export function runCliRawPiped(cmds: string[][]): string {
  return runCliRawPipedStdin(cmds, "");
}
