/**
 * Default parsing and validation behavior
 * Equivalent to Rust's cmd/default.rs
 */
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-template-expressions, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return */

import { type Cbor, type Result, decodeCbor, hexToBytes, errorMsg } from "@bcts/dcbor";
import { parseDcborItem, fullErrorMessage } from "@bcts/dcbor-parse";
import type { Exec } from "./index.js";
import { type InputFormat, type OutputFormat, formatOutput } from "../format.js";

/**
 * Command arguments for default parsing behavior
 */
export interface DefaultCommandArgs {
  /** Input dCBOR in the format specified by `in`. Optional - reads from stdin if not provided */
  input?: string | undefined;
  /** The input format (default: diag) */
  in: InputFormat;
  /** The output format (default: hex) */
  out: OutputFormat;
  /** Output with annotations */
  annotate: boolean;
}

/**
 * Execute default command with a reader function for stdin
 */
export function execDefaultWithReader(
  args: DefaultCommandArgs,
  readString: () => string,
  readData: () => Uint8Array,
): Result<string> {
  let cbor: Cbor;

  try {
    switch (args.in) {
      case "diag": {
        if (args.input !== undefined) {
          const result = parseDcborItem(args.input);
          if (!result.ok) {
            return {
              ok: false,
              error: errorMsg(fullErrorMessage(result.error, args.input)),
            };
          }
          cbor = result.value;
        } else {
          const diag = readString();
          const result = parseDcborItem(diag);
          if (!result.ok) {
            return {
              ok: false,
              error: errorMsg(fullErrorMessage(result.error, diag)),
            };
          }
          cbor = result.value;
        }
        break;
      }
      case "hex": {
        if (args.input !== undefined) {
          cbor = decodeCbor(hexToBytes(args.input));
        } else {
          const hexStr = readString().trim();
          cbor = decodeCbor(hexToBytes(hexStr));
        }
        break;
      }
      case "bin": {
        const data = readData();
        cbor = decodeCbor(data);
        break;
      }
      default:
        return { ok: false, error: errorMsg(`Unknown input format: ${args.in}`) };
    }
  } catch (e) {
    return { ok: false, error: errorMsg(e instanceof Error ? e.message : String(e)) };
  }

  return formatOutput(cbor, args.out, args.annotate);
}

/**
 * Execute default command (reads from stdin if input not provided)
 */
export function execDefault(
  args: DefaultCommandArgs,
  stdinContent?: string | undefined,
): Result<string> {
  return execDefaultWithReader(
    args,
    () => stdinContent ?? "",
    () => {
      if (stdinContent) {
        return new TextEncoder().encode(stdinContent);
      }
      return new Uint8Array(0);
    },
  );
}

/**
 * Create an Exec implementation for default command
 */
export function createDefaultCommand(args: DefaultCommandArgs, stdinContent?: string | undefined): Exec {
  return {
    exec: () => execDefault(args, stdinContent),
  };
}
