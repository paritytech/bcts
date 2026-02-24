/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Compose a dCBOR map from the provided keys and values
 * Equivalent to Rust's cmd/map.rs
 */

import { type Result, errorMsg } from "@bcts/dcbor";
import { composeDcborMap, composeErrorMessage } from "@bcts/dcbor-parse";
import type { Exec } from "./index.js";
import { type OutputFormat, formatOutput } from "../format.js";

/**
 * Command arguments for map composition
 */
export interface MapCommandArgs {
  /** Alternating keys and values parsed as dCBOR items in diagnostic notation */
  kvPairs: string[];
  /** The output format (default: hex) */
  out: OutputFormat;
  /** Output with annotations */
  annotate: boolean;
}

/**
 * Execute map command
 */
export function execMap(args: MapCommandArgs): Result<string> {
  const result = composeDcborMap(args.kvPairs);
  if (!result.ok) {
    return { ok: false, error: errorMsg(composeErrorMessage(result.error)) };
  }
  return formatOutput(result.value, args.out, args.annotate);
}

/**
 * Create an Exec implementation for map command
 */
export function createMapCommand(args: MapCommandArgs): Exec {
  return {
    exec: () => execMap(args),
  };
}
