/**
 * Compose a dCBOR map from the provided keys and values
 * Equivalent to Rust's cmd/map.rs
 */

import type { Result } from "@bcts/dcbor";
import { composeDcborMap } from "@bcts/dcbor-parse";
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
export function execMap(args: MapCommandArgs): Result<string, Error> {
  const result = composeDcborMap(args.kvPairs);
  if (!result.ok) {
    return { ok: false, error: new Error(String(result.error)) };
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
