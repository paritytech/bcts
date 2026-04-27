/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * A tool for generating and transforming cryptographic seeds.
 * Ported from seedtool-cli-rust/src/main.rs
 */

import { Command, Option } from "commander";
import { SecureRandomNumberGenerator } from "@bcts/rand";
import { SSKRGroupSpec } from "@bcts/components";
import { Cli, type InputFormatKey, type OutputFormatKey, type SSKRFormatKey } from "./cli.js";
import { selectInputFormat, selectOutputFormat } from "./formats/index.js";
import { DeterministicRandomNumberGenerator } from "./random.js";
import pkg from "../package.json" with { type: "json" };

/**
 * Package version, sourced from `package.json` so the CLI's `--version` output
 * never drifts from the published version.
 */
const VERSION: string = pkg.version;

/**
 * CLI options parsed from commander.
 */
interface CliOptions {
  count: string;
  in: InputFormatKey;
  out: OutputFormatKey;
  low: number;
  high: number;
  name?: string;
  note?: string;
  date?: string;
  maxFragmentLen: string;
  additionalParts: string;
  groups: SSKRGroupSpec[];
  groupThreshold: number;
  sskrFormat: SSKRFormatKey;
  deterministic?: string;
}

/**
 * Build an argParser that validates a value against the given choices and,
 * on failure, emits the clap-style error format used by Rust's seedtool-cli:
 *
 *   error: invalid value 'X' for '--<long> <UPPER>'
 *     [possible values: a, b, c]
 *
 *   For more information, try '--help'.
 *
 * `metavar` is the value-name placeholder (e.g. INPUT_TYPE), normally derived
 * from the option's `<META>` declaration. Used in conjunction with `.choices()`
 * for help-text generation — argParser runs first, so on a bad value we exit
 * before commander's own choice-validation message can fire.
 */
function clapChoiceParser<T extends string>(
  longName: string,
  metavar: string,
  choices: readonly T[],
): (value: string) => T {
  return (value: string): T => {
    if ((choices as readonly string[]).includes(value)) return value as T;
    process.stderr.write(
      `error: invalid value '${value}' for '--${longName} <${metavar}>'\n` +
        `  [possible values: ${choices.join(", ")}]\n\n` +
        `For more information, try '--help'.\n`,
    );
    process.exit(2);
  };
}

// Choice arrays match Rust's clap `ValueEnum` declaration order so that
// `--help` and the `[possible values: …]` block in error output line up
// byte-identically. See seedtool-cli-rust/src/cli.rs.
const IN_CHOICES = [
  "random",
  "hex",
  "btw",
  "btwu",
  "btwm",
  "bits",
  "cards",
  "dice",
  "base6",
  "base10",
  "ints",
  "bip39",
  "sskr",
  "envelope",
  "multipart",
  "seed",
] as const;

const OUT_CHOICES = [
  "hex",
  "btw",
  "btwu",
  "btwm",
  "bits",
  "cards",
  "dice",
  "base6",
  "base10",
  "ints",
  "bip39",
  "sskr",
  "envelope",
  "multipart",
  "seed",
] as const;

const SSKR_FORMAT_CHOICES = ["envelope", "btw", "btwm", "btwu", "ur"] as const;

function parseLowInt(value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 254) {
    throw new Error("LOW must be between 0 and 254");
  }
  return num;
}

function parseHighInt(value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > 255) {
    throw new Error("HIGH must be between 1 and 255");
  }
  return num;
}

function parseGroupThreshold(value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > 16) {
    throw new Error("THRESHOLD must be between 1 and 16");
  }
  return num;
}

function parseCliDate(value: string): Date {
  if (value === "now") {
    return new Date();
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}. Use ISO-8601 format or 'now'.`);
  }
  return date;
}

function parseGroupSpec(value: string, previous: SSKRGroupSpec[]): SSKRGroupSpec[] {
  const spec = SSKRGroupSpec.parse(value);
  return [...previous, spec];
}

function main(): void {
  const program = new Command();

  program
    .name("seedtool")
    .description(
      "A tool for generating and transforming cryptographic seeds.\n\n" +
        "by Wolf McNally and Christopher Allen\n\n" +
        "Report bugs to ChristopherA@BlockchainCommons.com.\n" +
        "© 2024 Blockchain Commons.",
    )
    .version(`@bcts/seedtool-cli ${VERSION}`)
    .argument(
      "[INPUT]",
      "The input to be transformed. If required and not present, it will be read from stdin",
    )
    .option(
      "-c, --count <COUNT>",
      "The number of output units (hex bytes, base-10 digits, etc.)",
      "16",
    )
    .addOption(
      new Option(
        "-i, --in <INPUT_TYPE>",
        "The input format. If not specified, a new random seed is generated using a secure random number generator",
      )
        .choices([...IN_CHOICES])
        .argParser(clapChoiceParser("in", "INPUT_TYPE", IN_CHOICES))
        .default("random"),
    )
    .addOption(
      new Option("-o, --out <OUTPUT_TYPE>", "The output format")
        .choices([...OUT_CHOICES])
        .argParser(clapChoiceParser("out", "OUTPUT_TYPE", OUT_CHOICES))
        .default("hex"),
    )
    .option("--low <LOW>", "The lowest int returned (0-254)", parseLowInt, 0)
    .option("--high <HIGH>", "The highest int returned (1-255), low < high", parseHighInt, 9)
    .option("--name <NAME>", "The name of the seed")
    .option("--note <NOTE>", "The note associated with the seed")
    .option("--date <DATE>", "The seed's creation date, in ISO-8601 format. May also be `now`")
    .option(
      "--max-fragment-len <MAX_FRAG_LEN>",
      "For `multipart` output, the UR will be segmented into parts with fragments no larger than MAX_FRAG_LEN",
      "500",
    )
    .option(
      "--additional-parts <NUM_PARTS>",
      "For `multipart` output, the number of additional parts above the minimum to generate using fountain encoding",
      "0",
    )
    .option(
      "-g, --groups <M-of-N>",
      "Group specifications. May appear more than once. M must be < N",
      parseGroupSpec,
      [],
    )
    .option(
      "-t, --group-threshold <THRESHOLD>",
      "The number of groups that must meet their threshold. Must be <= the number of group specifications",
      parseGroupThreshold,
      1,
    )
    .addOption(
      new Option("-s, --sskr-format <SSKR_FORMAT>", "Output format")
        .choices([...SSKR_FORMAT_CHOICES])
        .argParser(clapChoiceParser("sskr-format", "SSKR_FORMAT", SSKR_FORMAT_CHOICES))
        .default("envelope"),
    )
    .option(
      "-d, --deterministic <SEED_STRING>",
      "Use a deterministic random number generator with the given seed string. Output generated from this seed will be the same every time, so generated seeds are only as secure as the seed string",
    );

  program.parse();

  const options = program.opts<CliOptions>();
  const args = program.args;

  // Create the CLI state
  const cli = new Cli();

  // Set input from positional argv. Stdin is NOT read here — the active input
  // format calls `cli.expectInput()` lazily, mirroring Rust's `expect_input()`.
  // This keeps deterministic flows (--in random, -d <SEED>, etc.) from
  // blocking on stdin in non-TTY contexts (CI, sub-processes).
  if (args.length > 0) {
    cli.input = args[0];
  }

  // Set options
  cli.count = parseInt(options.count, 10);
  cli.in = options.in;
  cli.out = options.out;
  cli.low = options.low;
  cli.high = options.high;
  if (options.name !== undefined) cli.name = options.name;
  if (options.note !== undefined) cli.note = options.note;
  if (options.date !== undefined) {
    cli.date = parseCliDate(options.date);
  }
  cli.maxFragmentLen = parseInt(options.maxFragmentLen, 10);
  cli.additionalParts = parseInt(options.additionalParts, 10);
  cli.groups = options.groups;
  cli.groupThreshold = options.groupThreshold;
  cli.sskrFormat = options.sskrFormat;

  // Set up RNG
  if (options.deterministic !== undefined) {
    cli.rng = {
      type: "deterministic",
      rng: DeterministicRandomNumberGenerator.newWithSeed(options.deterministic),
    };
  } else {
    cli.rng = {
      type: "secure",
      rng: new SecureRandomNumberGenerator(),
    };
  }

  // Get formats
  const inputFormat = selectInputFormat(cli.in);
  const outputFormat = selectOutputFormat(cli.out);

  // Validate round-trippability
  if (!outputFormat.roundTrippable() && inputFormat.name() !== "random") {
    console.error(`Input for output form "${outputFormat.name()}" must be random.`);
    throw new Error("Invalid input format for non-round-trippable output format");
  }

  // Process input
  const processedCli = inputFormat.processInput(cli);

  // Process output
  const output = outputFormat.processOutput(processedCli);
  console.log(output);
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // Mirrors Rust's anyhow `Error: {msg}` stderr format. Avoid double-prefixing
  // if a deeper layer already emitted "Error: " (e.g. roundtrippability check).
  const prefixed = message.startsWith("Error: ") ? message : `Error: ${message}`;
  console.error(prefixed);
  process.exit(1);
}
