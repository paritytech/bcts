/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * @bcts/provenance-mark-cli - Command line tool for creating and managing Provenance Marks
 *
 * This is a 1:1 TypeScript port of provenance-mark-cli-rust.
 *
 * @packageDocumentation
 */

export const VERSION = "1.0.0-alpha.13";

// Export exec interface
export type { Exec, ExecResult } from "./exec.js";

// Export utilities
export {
  readNewPath,
  readExistingDirectoryPath,
  readArgument,
  readStdinSync,
  bytesToHex,
  hexToBytes,
  toBase64,
  fromBase64,
} from "./utils.js";

// Export command types and classes
export {
  // Info args
  type InfoArgs,
  parseInfoArgs,
  // Seed parsing
  parseSeed,
  // New command
  OutputFormat,
  Resolution,
  parseResolution,
  parseOutputFormat,
  type NewCommandArgs,
  defaultNewCommandArgs,
  NewCommand,
  // Next command
  type NextCommandArgs,
  defaultNextCommandArgs,
  NextCommand,
  // Print command
  type PrintCommandArgs,
  defaultPrintCommandArgs,
  PrintCommand,
  // Validate command
  ValidateFormat,
  parseValidateFormat,
  type ValidateCommandArgs,
  defaultValidateCommandArgs,
  ValidateCommand,
} from "./cmd/index.js";
