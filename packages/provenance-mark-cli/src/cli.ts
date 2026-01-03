#!/usr/bin/env node
/**
 * provenance CLI - Command line tool for creating and managing Provenance Marks
 */

import { Command } from "commander";
import { VERSION } from "./index.js";

const program = new Command();

program
  .name("provenance")
  .description("Command line tool for creating and managing Provenance Marks")
  .version(VERSION);

program
  .command("new")
  .description("Create a new provenance mark chain")
  .argument("<dir>", "Directory to create the chain in")
  .option("--seed <base64>", "Seed for the chain (default: random)")
  .option("--resolution <level>", "Resolution: low, medium, quartile, high", "quartile")
  .option("--comment <text>", "Comment for genesis mark", "Genesis mark.")
  .option("--quiet", "Suppress status messages")
  .action((_dir, _options) => {
    // TODO: Implement new command
    console.error("new command is not yet implemented");
    process.exit(1);
  });

program
  .command("next")
  .description("Generate the next mark in a chain")
  .argument("<dir>", "Chain directory")
  .option("--comment <text>", "Comment for the new mark", "Blank.")
  .option("--format <fmt>", "Output format: markdown, ur, json", "markdown")
  .option("--quiet", "Suppress status messages")
  .action((_dir, _options) => {
    // TODO: Implement next command
    console.error("next command is not yet implemented");
    process.exit(1);
  });

program
  .command("print")
  .description("Print marks from a chain")
  .argument("<dir>", "Chain directory")
  .option("--start <n>", "First mark to print", "0")
  .option("--end <n>", "Last mark to print")
  .action((_dir, _options) => {
    // TODO: Implement print command
    console.error("print command is not yet implemented");
    process.exit(1);
  });

program
  .command("validate")
  .description("Validate provenance marks")
  .argument("[urs...]", "Provenance mark URs to validate")
  .option("--dir <path>", "Validate all marks in directory")
  .option("--warn", "Warn instead of error on issues")
  .action((_urs, _options) => {
    // TODO: Implement validate command
    console.error("validate command is not yet implemented");
    process.exit(1);
  });

program.parse();
