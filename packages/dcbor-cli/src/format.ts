/**
 * Format utilities for dcbor-cli
 * Contains InputFormat, OutputFormat enums and formatOutput function
 * Equivalent to the format-related code in Rust's main.rs
 */

import { type Cbor, type Result } from "@bcts/dcbor";

/**
 * Input format options
 */
export type InputFormat = "diag" | "hex" | "bin";

/**
 * Output format options
 */
export type OutputFormat = "diag" | "hex" | "bin" | "none";

/**
 * Format CBOR output in the specified format
 * Equivalent to Rust's format_output function
 */
export function formatOutput(
  cbor: Cbor,
  outFormat: OutputFormat,
  annotate: boolean
): Result<string, Error> {
  try {
    switch (outFormat) {
      case "diag":
        if (annotate) {
          return { ok: true, value: cbor.diagnosticAnnotated() };
        } else {
          return { ok: true, value: cbor.diagnostic() };
        }

      case "hex":
        if (annotate) {
          return { ok: true, value: cbor.hexAnnotated() };
        } else {
          return { ok: true, value: cbor.hex() };
        }

      case "bin":
        // For binary output, return hex representation
        // The caller will handle converting to actual binary
        return { ok: true, value: cbor.hex() };

      case "none":
        return { ok: true, value: "" };

      default:
        return { ok: false, error: new Error(`Unknown output format: ${outFormat}`) };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Read binary data from a buffer
 */
export function readData(data: Uint8Array): Uint8Array {
  return data;
}

/**
 * Read string data from a buffer
 */
export function readString(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}
