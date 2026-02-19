/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Format traits and factory functions
 * Ported from seedtool-cli-rust/src/formats/format.rs
 */

import { InputFormatKey, OutputFormatKey, type Cli } from "../cli.js";

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
    case InputFormatKey.Random:
      return new RandomFormat();
    case InputFormatKey.Hex:
      return new HexFormat();
    case InputFormatKey.Btw:
      return new BytewordsStandardFormat();
    case InputFormatKey.Btwu:
      return new BytewordsUriFormat();
    case InputFormatKey.Btwm:
      return new BytewordsMinimalFormat();
    case InputFormatKey.Bits:
      return new BitsFormat();
    case InputFormatKey.Cards:
      return new CardsFormat();
    case InputFormatKey.Dice:
      return new DiceFormat();
    case InputFormatKey.Base6:
      return new Base6Format();
    case InputFormatKey.Base10:
      return new Base10Format();
    case InputFormatKey.Ints:
      return new IntsFormat();
    case InputFormatKey.Bip39:
      return new Bip39Format();
    case InputFormatKey.Sskr:
      return new SSKRFormat();
    case InputFormatKey.Envelope:
      return new EnvelopeFormat();
    case InputFormatKey.Multipart:
      return new MultipartFormat();
    case InputFormatKey.Seed:
      return new SeedFormat();
  }
}

/**
 * Select output format by key.
 * Matches Rust select_output_format function.
 */
export function selectOutputFormat(key: OutputFormatKey): OutputFormat {
  switch (key) {
    case OutputFormatKey.Hex:
      return new HexFormat();
    case OutputFormatKey.Btw:
      return new BytewordsStandardFormat();
    case OutputFormatKey.Btwu:
      return new BytewordsUriFormat();
    case OutputFormatKey.Btwm:
      return new BytewordsMinimalFormat();
    case OutputFormatKey.Bits:
      return new BitsFormat();
    case OutputFormatKey.Cards:
      return new CardsFormat();
    case OutputFormatKey.Dice:
      return new DiceFormat();
    case OutputFormatKey.Base6:
      return new Base6Format();
    case OutputFormatKey.Base10:
      return new Base10Format();
    case OutputFormatKey.Ints:
      return new IntsFormat();
    case OutputFormatKey.Bip39:
      return new Bip39Format();
    case OutputFormatKey.Sskr:
      return new SSKRFormat();
    case OutputFormatKey.Envelope:
      return new EnvelopeFormat();
    case OutputFormatKey.Multipart:
      return new MultipartFormat();
    case OutputFormatKey.Seed:
      return new SeedFormat();
  }
}
