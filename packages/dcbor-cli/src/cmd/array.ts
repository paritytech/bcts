/**
 * Compose a dCBOR array from the provided elements
 * Equivalent to Rust's cmd/array.rs
 */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { type Result, errorMsg } from "@bcts/dcbor";
import { composeDcborArray, composeErrorMessage } from "@bcts/dcbor-parse";
import type { Exec } from "./index.js";
import { type OutputFormat, formatOutput } from "../format.js";

/**
 * Command arguments for array composition
 */
export interface ArrayCommandArgs {
  /** Each element is parsed as a dCBOR item in diagnostic notation */
  elements: string[];
  /** The output format (default: hex) */
  out: OutputFormat;
  /** Output with annotations */
  annotate: boolean;
}

/**
 * Execute array command
 */
export function execArray(args: ArrayCommandArgs): Result<string> {
  const result = composeDcborArray(args.elements);
  if (!result.ok) {
    return { ok: false, error: errorMsg(composeErrorMessage(result.error)) };
  }
  return formatOutput(result.value, args.out, args.annotate);
}

/**
 * Create an Exec implementation for array command
 */
export function createArrayCommand(args: ArrayCommandArgs): Exec {
  return {
    exec: () => execArray(args),
  };
}
