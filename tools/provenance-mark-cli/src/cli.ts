#!/usr/bin/env node
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * provenance CLI - 1:1 port of main.rs
 *
 * Command line tool for creating and managing Provenance Marks.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */

import { Command, Option } from "commander";
import { VERSION } from "./index.js";
import {
  NewCommand,
  defaultNewCommandArgs,
  parseResolution,
  parseOutputFormat,
  NextCommand,
  defaultNextCommandArgs,
  PrintCommand,
  defaultPrintCommandArgs,
  ValidateCommand,
  defaultValidateCommandArgs,
  parseValidateFormat,
  parseSeed,
} from "./cmd/index.js";

/**
 * Build an argParser that validates a value against the given choices and,
 * on failure, emits the clap-style error format used by Rust's
 * provenance-mark-cli:
 *
 *   error: invalid value 'X' for '--<long> <UPPER>'
 *     [possible values: a, b, c]
 *
 *   For more information, try '--help'.
 *
 * `longName` is the option's long flag (without leading dashes); the
 * placeholder is the upper-cased long name to mirror clap's `value_name`
 * default. Used in conjunction with `.choices()` for help-text generation —
 * argParser runs first, so on a bad value we exit before commander's own
 * choice-validation message can fire.
 */
function clapChoiceParser<T extends string>(
  longName: string,
  choices: readonly T[],
): (value: string) => T {
  const upperName = longName.toUpperCase();
  return (value: string): T => {
    if ((choices as readonly string[]).includes(value)) return value as T;
    process.stderr.write(
      `error: invalid value '${value}' for '--${longName} <${upperName}>'\n` +
        `  [possible values: ${choices.join(", ")}]\n\n` +
        `For more information, try '--help'.\n`,
    );
    process.exit(2);
  };
}

const program = new Command();

program
  .name("provenance")
  .description("A tool for managing provenance mark chains and generating provenance marks")
  .version(`@bcts/provenance-mark-cli ${VERSION}`);

// New command - Initialize a directory with a new provenance mark chain
program
  .command("new")
  .description("Initialize a directory with a new provenance mark chain")
  .argument("<PATH>", "Path to directory to be created. Must not already exist")
  .option(
    "-s, --seed <SEED>",
    "A seed to use for the provenance mark chain, encoded as base64. If not supplied, a random seed is generated",
  )
  .addOption(
    new Option("-r, --resolution <RESOLUTION>", "The resolution of the provenance mark chain")
      .choices(["low", "medium", "quartile", "high"])
      .argParser(clapChoiceParser("resolution", ["low", "medium", "quartile", "high"] as const))
      .default("quartile"),
  )
  .option(
    "-c, --comment <COMMENT>",
    "A comment to be included for the genesis mark. (Comments are not part of the mark itself.)",
    "Genesis mark.",
  )
  .option(
    "-d, --date <DATE>",
    "The date of the genesis mark. If not supplied, the current date is used",
  )
  .option("-q, --quiet", "Suppress informational status output on stderr/stdout")
  .addOption(
    new Option("--format <FORMAT>", "Output format for the creation summary")
      .choices(["markdown", "ur", "json"])
      .argParser(clapChoiceParser("format", ["markdown", "ur", "json"] as const))
      .default("markdown"),
  )
  .option("--info <PAYLOAD>", "Hex-encoded dCBOR or UR payload to embed in the mark's `info` field")
  .option("--info-tag <TAG>", "CBOR tag value to associate with an unknown UR type")
  .action((pathArg: string, options) => {
    try {
      const args = defaultNewCommandArgs();
      args.path = pathArg;
      args.resolution = parseResolution(options.resolution);
      args.comment = options.comment;
      args.quiet = options.quiet ?? false;
      args.format = parseOutputFormat(options.format);

      if (options.seed !== undefined) {
        args.seed = parseSeed(options.seed);
      }

      if (options.date !== undefined) {
        args.date = parseDate(options.date);
      }

      args.info = {
        info: options.info,
        infoTag: options.infoTag !== undefined ? parseInt(options.infoTag, 10) : undefined,
      };

      const cmd = new NewCommand(args);
      const output = cmd.exec();
      if (output !== "") {
        console.log(output);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

// Next command - Generate the next provenance mark in a chain
program
  .command("next")
  .description("Generate the next provenance mark in a chain")
  .argument("<PATH>", "Path to the chain's directory. Must already exist")
  .option(
    "-c, --comment <COMMENT>",
    "A comment to be included for the mark. (Comments are not part of the mark itself.)",
    "Blank.",
  )
  .option(
    "-d, --date <DATE>",
    "The date of the next mark. If not supplied, the current date is used",
  )
  .option("-q, --quiet", "Suppress informational status output on stderr/stdout")
  .addOption(
    new Option("--format <FORMAT>", "Output format for the mark")
      .choices(["markdown", "ur", "json"])
      .argParser(clapChoiceParser("format", ["markdown", "ur", "json"] as const))
      .default("markdown"),
  )
  .option("--info <PAYLOAD>", "Hex-encoded dCBOR or UR payload to embed in the mark's `info` field")
  .option("--info-tag <TAG>", "CBOR tag value to associate with an unknown UR type")
  .action((pathArg: string, options) => {
    try {
      const args = defaultNextCommandArgs();
      args.path = pathArg;
      args.comment = options.comment;
      args.quiet = options.quiet ?? false;
      args.format = parseOutputFormat(options.format);

      if (options.date !== undefined) {
        args.date = parseDate(options.date);
      }

      args.info = {
        info: options.info,
        infoTag: options.infoTag !== undefined ? parseInt(options.infoTag, 10) : undefined,
      };

      const cmd = new NextCommand(args);
      const output = cmd.exec();
      if (output !== "") {
        console.log(output);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

// Print command - Print marks from a chain
program
  .command("print")
  .description("Prints provenance marks in a chain")
  .argument("<PATH>", "Path to the chain's directory. Must already exist")
  .option(
    "-s, --start <START>",
    "The sequence number of the first mark to print. If not supplied, the first mark (genesis mark) is used",
    "0",
  )
  .option(
    "-e, --end <END>",
    "The sequence number of the last mark to print. If not supplied, the last mark in the chain is used",
  )
  .addOption(
    new Option("--format <FORMAT>", "Output format for the rendered marks")
      .choices(["markdown", "ur", "json"])
      .argParser(clapChoiceParser("format", ["markdown", "ur", "json"] as const))
      .default("markdown"),
  )
  .action((pathArg: string, options) => {
    try {
      const args = defaultPrintCommandArgs();
      args.path = pathArg;
      args.start = parseInt(options.start, 10);
      args.format = parseOutputFormat(options.format);

      if (options.end !== undefined) {
        args.end = parseInt(options.end, 10);
      }

      const cmd = new PrintCommand(args);
      const output = cmd.exec();
      if (output !== "") {
        console.log(output);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

// Validate command - Validate one or more provenance marks
program
  .command("validate")
  .description("Validate one or more provenance marks")
  .argument("[MARKS...]", "One or more provenance mark URs to validate")
  .option("-d, --dir <DIR>", "Path to a chain directory containing marks to validate")
  .option("-w, --warn", "Report issues as warnings without failing")
  .addOption(
    new Option("--format <FORMAT>", "Output format for the validation report")
      .choices(["text", "json-compact", "json-pretty"])
      .argParser(clapChoiceParser("format", ["text", "json-compact", "json-pretty"] as const))
      .default("text"),
  )
  .action((marksArg: string[], options) => {
    try {
      // Validate that either marks or dir is provided
      if (marksArg.length === 0 && options.dir === undefined) {
        console.error(
          "Error: Either provide marks to validate or use --dir to validate marks from a directory.",
        );
        process.exit(1);
      }
      if (marksArg.length > 0 && options.dir !== undefined) {
        console.error("Error: Cannot provide both marks and --dir.");
        process.exit(1);
      }

      const args = defaultValidateCommandArgs();
      args.marks = marksArg;
      args.dir = options.dir;
      args.warn = options.warn ?? false;
      args.format = parseValidateFormat(options.format);

      const cmd = new ValidateCommand(args);
      const output = cmd.exec();
      if (output !== "") {
        console.log(output);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

/**
 * Parse a date string.
 *
 * Supports ISO 8601 formats like:
 * - 2023-02-08
 * - 2023-02-08T15:30:45Z
 */
function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date;
}

program.parse();
