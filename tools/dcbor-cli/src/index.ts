/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/dcbor-cli - Command line parser/validator for deterministic CBOR (dCBOR)
 *
 * A command line tool for composing, parsing and validating Gordian dCBOR.
 *
 * @packageDocumentation
 */

import pkg from "../package.json" with { type: "json" };

/**
 * Package version, sourced from `package.json` so the CLI's `--version` output
 * never drifts from the published version.
 */
export const VERSION: string = pkg.version;

// Export format utilities
export { formatOutput, readData, readString } from "./format.js";
export type { InputFormat, OutputFormat } from "./format.js";

// Export command modules
export {
  // Exec interface
  type Exec,
  // Array command
  type ArrayCommandArgs,
  execArray,
  createArrayCommand,
  // Map command
  type MapCommandArgs,
  execMap,
  createMapCommand,
  // Default command
  type DefaultCommandArgs,
  execDefault,
  execDefaultWithReader,
  createDefaultCommand,
  // Match command
  type MatchOutputFormat,
  type MatchCommandArgs,
  execMatch,
  createMatchCommand,
} from "./cmd/index.js";

// Export the run function for programmatic use
export { run } from "./run.js";
export type { RunOptions, RunResult, Command } from "./run.js";
