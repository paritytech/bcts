/**
 * Format traits and factory functions
 * Ported from seedtool-cli-rust/src/formats/format.rs
 */

import type { Cli, InputFormatKey, OutputFormatKey } from "../cli.js";

// ============================================================================
// Format Interfaces (Traits)
// ============================================================================

/**
 * Base format interface.
 * Matches Rust Format trait.
 */
export interface Format {
  /** Get the format name */
  name(): string;
  /** Whether this format supports round-trip conversion */
  roundTrippable(): boolean;
}

/**
 * Input format interface.
 * Matches Rust InputFormat trait.
 */
export interface InputFormat extends Format {
  /** Process input and update CLI state with seed */
  processInput(state: Cli): Cli;
}

/**
 * Output format interface.
 * Matches Rust OutputFormat trait.
 */
export interface OutputFormat extends Format {
  /** Process seed from CLI state and return output string */
  processOutput(state: Cli): string;
}

// ============================================================================
// Format Factory Functions
// ============================================================================

// Import formats (will be implemented in subsequent files)
import { HexFormat } from "./hex.js";
import { Bip39Format } from "./bip39.js";
import { SSKRFormat } from "./sskr.js";
import { EnvelopeFormat } from "./envelope.js";
import { SeedFormat } from "./seed-format.js";
import { MultipartFormat } from "./multipart.js";
import { RandomFormat } from "./random.js";
import { Base6Format } from "./base6.js";
import { Base10Format } from "./base10.js";
import { BitsFormat } from "./bits.js";
import { DiceFormat } from "./dice.js";
import { CardsFormat } from "./cards.js";
import { IntsFormat } from "./ints.js";
import { BytewordsStandardFormat } from "./bytewords-standard.js";
import { BytewordsMinimalFormat } from "./bytewords-minimal.js";
import { BytewordsUriFormat } from "./bytewords-uri.js";

/**
 * Select input format by key.
 * Matches Rust select_input_format function.
 */
export function selectInputFormat(key: InputFormatKey): InputFormat {
  switch (key) {
    case "random":
      return new RandomFormat();
    case "hex":
      return new HexFormat();
    case "btw":
      return new BytewordsStandardFormat();
    case "btwu":
      return new BytewordsUriFormat();
    case "btwm":
      return new BytewordsMinimalFormat();
    case "bits":
      return new BitsFormat();
    case "cards":
      return new CardsFormat();
    case "dice":
      return new DiceFormat();
    case "base6":
      return new Base6Format();
    case "base10":
      return new Base10Format();
    case "ints":
      return new IntsFormat();
    case "bip39":
      return new Bip39Format();
    case "sskr":
      return new SSKRFormat();
    case "envelope":
      return new EnvelopeFormat();
    case "multipart":
      return new MultipartFormat();
    case "seed":
      return new SeedFormat();
    default:
      throw new Error(`Unknown input format: ${key}`);
  }
}

/**
 * Select output format by key.
 * Matches Rust select_output_format function.
 */
export function selectOutputFormat(key: OutputFormatKey): OutputFormat {
  switch (key) {
    case "hex":
      return new HexFormat();
    case "btw":
      return new BytewordsStandardFormat();
    case "btwu":
      return new BytewordsUriFormat();
    case "btwm":
      return new BytewordsMinimalFormat();
    case "bits":
      return new BitsFormat();
    case "cards":
      return new CardsFormat();
    case "dice":
      return new DiceFormat();
    case "base6":
      return new Base6Format();
    case "base10":
      return new Base10Format();
    case "ints":
      return new IntsFormat();
    case "bip39":
      return new Bip39Format();
    case "sskr":
      return new SSKRFormat();
    case "envelope":
      return new EnvelopeFormat();
    case "multipart":
      return new MultipartFormat();
    case "seed":
      return new SeedFormat();
    default:
      throw new Error(`Unknown output format: ${key}`);
  }
}
