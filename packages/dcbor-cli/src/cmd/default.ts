/**
 * Default parsing and validation behavior
 * Equivalent to Rust's cmd/default.rs
 */

import { Cbor, type Result } from "@bcts/dcbor";
import { parseDcborItem } from "@bcts/dcbor-parse";
import type { Exec } from "./index.js";
import {
  type InputFormat,
  type OutputFormat,
  formatOutput,
} from "../format.js";

/**
 * Command arguments for default parsing behavior
 */
export interface DefaultCommandArgs {
  /** Input dCBOR in the format specified by `in`. Optional - reads from stdin if not provided */
  input?: string;
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
  readData: () => Uint8Array
): Result<string, Error> {
  let cbor: Cbor;

  try {
    switch (args.in) {
      case "diag": {
        if (args.input !== undefined) {
          const result = parseDcborItem(args.input);
          if (!result.ok) {
            return {
              ok: false,
              error: new Error(result.error.fullMessage(args.input)),
            };
          }
          cbor = result.value;
        } else {
          const diag = readString();
          const result = parseDcborItem(diag);
          if (!result.ok) {
            return {
              ok: false,
              error: new Error(result.error.fullMessage(diag)),
            };
          }
          cbor = result.value;
        }
        break;
      }
      case "hex": {
        if (args.input !== undefined) {
          const tryResult = Cbor.fromHex(args.input);
          if (!tryResult.ok) {
            return { ok: false, error: new Error(String(tryResult.error)) };
          }
          cbor = tryResult.value;
        } else {
          const hex = readString().trim();
          const tryResult = Cbor.fromHex(hex);
          if (!tryResult.ok) {
            return { ok: false, error: new Error(String(tryResult.error)) };
          }
          cbor = tryResult.value;
        }
        break;
      }
      case "bin": {
        const data = readData();
        const tryResult = Cbor.fromData(data);
        if (!tryResult.ok) {
          return { ok: false, error: new Error(String(tryResult.error)) };
        }
        cbor = tryResult.value;
        break;
      }
      default:
        return { ok: false, error: new Error(`Unknown input format: ${args.in}`) };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }

  return formatOutput(cbor, args.out, args.annotate);
}

/**
 * Execute default command (reads from stdin if input not provided)
 */
export function execDefault(
  args: DefaultCommandArgs,
  stdinContent?: string
): Result<string, Error> {
  return execDefaultWithReader(
    args,
    () => stdinContent ?? "",
    () => {
      if (stdinContent) {
        return new TextEncoder().encode(stdinContent);
      }
      return new Uint8Array(0);
    }
  );
}

/**
 * Create an Exec implementation for default command
 */
export function createDefaultCommand(
  args: DefaultCommandArgs,
  stdinContent?: string
): Exec {
  return {
    exec: () => execDefault(args, stdinContent),
  };
}
