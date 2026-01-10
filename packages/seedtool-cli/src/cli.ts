/**
 * CLI types and interfaces
 * Ported from seedtool-cli-rust/src/cli.rs
 */

import * as readline from "readline";
import { SSKRGroupSpec, SSKRSpec } from "@bcts/components";
import { Envelope } from "@bcts/envelope";
import { SecureRandomNumberGenerator } from "@bcts/rand";
import type { Seed } from "./seed.js";
import type { DeterministicRandomNumberGenerator } from "./random.js";

// ============================================================================
// Enums (matching Rust ValueEnum)
// ============================================================================

/**
 * Input format keys.
 * Matches Rust InputFormatKey enum in format.rs
 */
export enum InputFormatKey {
  Random = "random",
  Hex = "hex",
  Btw = "btw",
  Btwu = "btwu",
  Btwm = "btwm",
  Bits = "bits",
  Cards = "cards",
  Dice = "dice",
  Base6 = "base6",
  Base10 = "base10",
  Ints = "ints",
  Bip39 = "bip39",
  Sskr = "sskr",
  Envelope = "envelope",
  Multipart = "multipart",
  Seed = "seed",
}

/**
 * Output format keys.
 * Matches Rust OutputFormatKey enum in format.rs
 */
export enum OutputFormatKey {
  Hex = "hex",
  Btw = "btw",
  Btwu = "btwu",
  Btwm = "btwm",
  Bits = "bits",
  Cards = "cards",
  Dice = "dice",
  Base6 = "base6",
  Base10 = "base10",
  Ints = "ints",
  Bip39 = "bip39",
  Sskr = "sskr",
  Envelope = "envelope",
  Multipart = "multipart",
  Seed = "seed",
}

/**
 * SSKR output format keys.
 * Matches Rust SSKRFormatKey enum in sskr.rs
 */
export enum SSKRFormatKey {
  Envelope = "envelope",
  Btw = "btw",
  Btwm = "btwm",
  Btwu = "btwu",
  Ur = "ur",
}

// ============================================================================
// RNG Source Type
// ============================================================================

/**
 * RNG source - either secure or deterministic.
 * Matches Rust RngSource enum.
 */
export type RngSource =
  | { type: "secure"; rng: SecureRandomNumberGenerator }
  | { type: "deterministic"; rng: DeterministicRandomNumberGenerator };

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Parse and validate low int (0-254).
 * Matches Rust parse_low_int function.
 */
export function parseLowInt(s: string): number {
  const n = parseInt(s, 10);
  if (isNaN(n) || n < 0 || n > 254) {
    throw new Error(`Invalid low value: ${s}. Must be 0-254.`);
  }
  return n;
}

/**
 * Parse and validate high int (1-255).
 * Matches Rust parse_high_int function.
 */
export function parseHighInt(s: string): number {
  const n = parseInt(s, 10);
  if (isNaN(n) || n < 1 || n > 255) {
    throw new Error(`Invalid high value: ${s}. Must be 1-255.`);
  }
  return n;
}

/**
 * Parse and validate group threshold (1-16).
 * Matches Rust parse_group_threshold function.
 */
export function parseGroupThreshold(s: string): number {
  const n = parseInt(s, 10);
  if (isNaN(n) || n < 1 || n > 16) {
    throw new Error(`Invalid group threshold: ${s}. Must be 1-16.`);
  }
  return n;
}

/**
 * Parse date string.
 * Accepts "now" or ISO-8601 format.
 * Matches Rust parse_date function.
 */
export function parseDate(s: string): Date {
  if (s === "now") {
    return new Date();
  }
  const date = new Date(s);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${s}. Use ISO-8601 format or 'now'.`);
  }
  return date;
}

/**
 * Parse SSKR group specification "M-of-N".
 * Returns SSKRGroupSpec instance.
 */
export function parseGroupSpec(s: string): SSKRGroupSpec {
  const match = s.match(/^(\d+)-of-(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid group specification: ${s}. Use format 'M-of-N' (e.g., '2-of-3').`);
  }
  const threshold = parseInt(match[1], 10);
  const count = parseInt(match[2], 10);
  return SSKRGroupSpec.new(threshold, count);
}

// ============================================================================
// Cli Class
// ============================================================================

/**
 * CLI state and configuration.
 * Matches Rust Cli struct.
 */
export class Cli {
  /** The input to be transformed. If required and not present, will be read from stdin. */
  input?: string;

  /** The number of output units (hex bytes, base-10 digits, etc.) */
  count: number = 16;

  /** The input format. Default: Random */
  in: InputFormatKey = InputFormatKey.Random;

  /** The output format. Default: Hex */
  out: OutputFormatKey = OutputFormatKey.Hex;

  /** The lowest int returned (0-254). Default: 0 */
  low: number = 0;

  /** The highest int returned (1-255), low < high. Default: 9 */
  high: number = 9;

  /** The name of the seed. */
  name?: string;

  /** The note associated with the seed. */
  note?: string;

  /** The seed's creation date, in ISO-8601 format. May also be `now`. */
  date?: Date;

  /** For `multipart` output, max fragment length. Default: 500 */
  maxFragmentLen: number = 500;

  /** For `multipart` output, additional parts for fountain encoding. Default: 0 */
  additionalParts: number = 0;

  /** Group specifications for SSKR. */
  groups: SSKRGroupSpec[] = [];

  /** The number of groups that must meet their threshold. Default: 1 */
  groupThreshold: number = 1;

  /** SSKR output format. Default: Envelope */
  sskrFormat: SSKRFormatKey = SSKRFormatKey.Envelope;

  /** Deterministic RNG seed string. */
  deterministic?: string;

  /** The seed being processed (internal state). */
  seed?: Seed;

  /** The RNG source (internal state). */
  rng?: RngSource;

  /**
   * Get input from argument or read from stdin.
   * Matches Rust expect_input method.
   */
  expectInput(): string {
    if (this.input !== undefined) {
      return this.input;
    }
    // Read from stdin synchronously
    // Note: In Node.js, we need to handle this differently for actual CLI use
    throw new Error("Input required but not provided. Use stdin or pass as argument.");
  }

  /**
   * Get input from argument or read from stdin asynchronously.
   * This is the async version for actual CLI use.
   */
  async expectInputAsync(): Promise<string> {
    if (this.input !== undefined) {
      return this.input;
    }

    // Read from stdin
    return new Promise((resolve, reject) => {
      let data = "";
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });

      rl.on("line", (line) => {
        data += line + "\n";
      });

      rl.on("close", () => {
        resolve(data.trim());
      });

      rl.on("error", (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get the seed, throwing if not initialized.
   * Matches Rust expect_seed method.
   */
  expectSeed(): Seed {
    if (this.seed === undefined) {
      throw new Error("Seed not initialized");
    }
    return this.seed;
  }

  /**
   * Generate random data using the configured RNG.
   * Matches Rust random_data method.
   */
  randomData(size: number): Uint8Array {
    if (this.rng === undefined) {
      throw new Error("RNG not initialized");
    }
    if (this.rng.type === "secure") {
      return this.rng.rng.randomData(size);
    } else {
      return this.rng.rng.deterministicRandomData(size);
    }
  }

  /**
   * Get the seed with CLI overrides applied (name, note, date).
   * Matches Rust seed_with_overrides method.
   */
  seedWithOverrides(): Seed {
    const seed = this.expectSeed().clone();
    if (this.name !== undefined) {
      seed.setName(this.name);
    }
    if (this.note !== undefined) {
      seed.setNote(this.note);
    }
    if (this.date !== undefined) {
      seed.setCreationDate(this.date);
    }
    return seed;
  }

  /**
   * Convert the seed (with overrides) to an Envelope.
   * Matches Rust to_envelope method.
   */
  toEnvelope(): Envelope {
    return this.seedWithOverrides().toEnvelope();
  }

  /**
   * Build SSKR spec from CLI options.
   * Matches Rust sskr_spec method.
   */
  sskrSpec(): SSKRSpec {
    return SSKRSpec.new(this.groupThreshold, this.groups);
  }

  /**
   * Clone the CLI state.
   */
  clone(): Cli {
    const cli = new Cli();
    cli.input = this.input;
    cli.count = this.count;
    cli.in = this.in;
    cli.out = this.out;
    cli.low = this.low;
    cli.high = this.high;
    cli.name = this.name;
    cli.note = this.note;
    cli.date = this.date;
    cli.maxFragmentLen = this.maxFragmentLen;
    cli.additionalParts = this.additionalParts;
    cli.groups = [...this.groups];
    cli.groupThreshold = this.groupThreshold;
    cli.sskrFormat = this.sskrFormat;
    cli.deterministic = this.deterministic;
    cli.seed = this.seed?.clone();
    cli.rng = this.rng;
    return cli;
  }
}
