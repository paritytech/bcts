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
import fs from "node:fs";

const VERSION = "0.4.0";

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
    .version(VERSION)
    .argument(
      "[INPUT]",
      "The input to be transformed. If required and not present, it will be read from stdin.",
    )
    .option(
      "-c, --count <COUNT>",
      "The number of output units (hex bytes, base-10 digits, etc.)",
      "16",
    )
    .addOption(
      new Option(
        "-i, --in <INPUT_TYPE>",
        "The input format. If not specified, a new random seed is generated using a secure random number generator.",
      )
        .choices([
          "random",
          "hex",
          "btw",
          "btwm",
          "btwu",
          "bits",
          "cards",
          "dice",
          "base6",
          "base10",
          "ints",
          "bip39",
          "sskr",
          "envelope",
          "seed",
          "multipart",
        ])
        .default("random"),
    )
    .addOption(
      new Option("-o, --out <OUTPUT_TYPE>", "The output format.")
        .choices([
          "hex",
          "btw",
          "btwm",
          "btwu",
          "bits",
          "cards",
          "dice",
          "base6",
          "base10",
          "ints",
          "bip39",
          "sskr",
          "envelope",
          "seed",
          "multipart",
        ])
        .default("hex"),
    )
    .option("--low <LOW>", "The lowest int returned (0-254)", parseLowInt, 0)
    .option("--high <HIGH>", "The highest int returned (1-255), low < high", parseHighInt, 9)
    .option("--name <NAME>", "The name of the seed.")
    .option("--note <NOTE>", "The note associated with the seed.")
    .option("--date <DATE>", "The seed's creation date, in ISO-8601 format. May also be `now`.")
    .option(
      "--max-fragment-len <MAX_FRAG_LEN>",
      "For `multipart` output, the UR will be segmented into parts with fragments no larger than MAX_FRAG_LEN",
      "500",
    )
    .option(
      "--additional-parts <NUM_PARTS>",
      "For `multipart` output, the number of additional parts above the minimum to generate using fountain encoding.",
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
      "The number of groups that must meet their threshold. Must be <= the number of group specifications.",
      parseGroupThreshold,
      1,
    )
    .addOption(
      new Option("-s, --sskr-format <SSKR_FORMAT>", "SSKR output format.")
        .choices(["envelope", "btw", "btwm", "btwu", "ur"])
        .default("envelope"),
    )
    .option(
      "-d, --deterministic <SEED_STRING>",
      "Use a deterministic random number generator with the given seed string. Output generated from this seed will be the same every time, so generated seeds are only as secure as the seed string.",
    );

  program.parse();

  const options = program.opts<CliOptions>();
  const args = program.args;

  // Create the CLI state
  const cli = new Cli();

  // Set input from argument or stdin
  if (args.length > 0) {
    cli.input = args[0];
  } else if (process.stdin.isTTY !== true) {
    // Read from stdin if it's piped
    cli.input = fs.readFileSync(process.stdin.fd, "utf-8").trim();
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
  console.error(message);
  process.exit(1);
}
