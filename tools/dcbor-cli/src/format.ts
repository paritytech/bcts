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
  diagnosticAnnotated,
  diagnosticFlat,
  hex,
  hexAnnotated,
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
        // Mirrors Rust's format_output:
        //   annotate=true  → cbor.diagnostic_annotated()
        //   annotate=false → cbor.diagnostic_flat()
        return {
          ok: true,
          value: annotate ? diagnosticAnnotated(cbor) : diagnosticFlat(cbor),
        };

      case "hex":
        // Mirrors Rust:
        //   annotate=true  → cbor.hex_annotated()
        //   annotate=false → cbor.hex()
        return { ok: true, value: annotate ? hexAnnotated(cbor) : hex(cbor) };

      case "bin":
        // Return the hex representation; the CLI layer decodes hex → bytes
        // before writing to stdout. Mirrors Rust's `hex::encode(cbor.to_cbor_data())`.
        return { ok: true, value: hex(cbor) };

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
