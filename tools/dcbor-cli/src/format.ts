/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Format utilities for dcbor-cli
 * Contains InputFormat, OutputFormat enums and formatOutput function
 * Equivalent to the format-related code in Rust's main.rs
 */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import {
  type Cbor,
  type Result,
  diagnosticOpt,
  hexOpt,
  bytesToHex,
  cborData,
  errorMsg,
} from "@bcts/dcbor";

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
  annotate: boolean,
): Result<string> {
  try {
    switch (outFormat) {
      case "diag":
        // Use flat: true for compact single-line output (matching Rust CLI behavior)
        if (annotate) {
          return { ok: true, value: diagnosticOpt(cbor, { annotate: true, flat: true }) };
        } else {
          return { ok: true, value: diagnosticOpt(cbor, { flat: true }) };
        }

      case "hex":
        if (annotate) {
          return { ok: true, value: hexOpt(cbor, { annotate: true }) };
        } else {
          return { ok: true, value: bytesToHex(cborData(cbor)) };
        }

      case "bin":
        // For binary output, return hex representation
        // The caller will handle converting to actual binary
        return { ok: true, value: bytesToHex(cborData(cbor)) };

      case "none":
        return { ok: true, value: "" };

      default:
        return { ok: false, error: errorMsg(`Unknown output format: ${outFormat}`) };
    }
  } catch (e) {
    return { ok: false, error: errorMsg(e instanceof Error ? e.message : String(e)) };
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
