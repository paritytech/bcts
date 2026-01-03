#!/usr/bin/env node
/**
 * dcbor CLI - Command line parser/validator for deterministic CBOR (dCBOR)
 *
 * A command line tool for composing, parsing and validating Gordian dCBOR.
 * See the main repo README: https://github.com/leonardocustodio/bcts
 */

import { Command, Option } from "commander";
import { VERSION } from "./index.js";
import { run, type Command as CmdType } from "./run.js";
import type { InputFormat, OutputFormat } from "./format.js";
import type { MatchOutputFormat } from "./cmd/match.js";

const program = new Command();

program
  .name("dcbor")
  .description("Command line parser/validator for deterministic CBOR (dCBOR)")
  .version(VERSION);

// Default command arguments (when no subcommand is provided)
program
  .argument("[input]", "Input dCBOR in the format specified by --in")
  .addOption(
    new Option("-i, --in <format>", "The input format")
      .choices(["diag", "hex", "bin"])
      .default("diag"),
  )
  .addOption(
    new Option("-o, --out <format>", "The output format")
      .choices(["diag", "hex", "bin", "none"])
      .default("hex"),
  )
  .option("-a, --annotate", "Output diagnostic notation or hexadecimal with annotations")
  .action(
    async (
      input: string | undefined,
      options: {
        in: InputFormat;
        out: OutputFormat;
        annotate?: boolean;
      },
    ) => {
      // Read stdin if needed
      let stdinContent: string | undefined;
      if (input === undefined && options.in !== "bin") {
        stdinContent = await readStdin();
      } else if (options.in === "bin") {
        stdinContent = await readStdin();
      }

      const command: CmdType = {
        type: "default",
        input,
        in: options.in,
        out: options.out,
        annotate: options.annotate ?? false,
      };

      const result = run({ command, stdinContent });

      if (!result.ok) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      writeOutput(result.value.output, result.value.isBinary);
    },
  );

// Array subcommand
program
  .command("array")
  .description("Compose a dCBOR array from the provided elements")
  .argument("<elements...>", "Each element is parsed as a dCBOR item in diagnostic notation")
  .addOption(
    new Option("-o, --out <format>", "The output format")
      .choices(["diag", "hex", "bin", "none"])
      .default("hex"),
  )
  .option("-a, --annotate", "Output diagnostic notation or hexadecimal with annotations")
  .action(
    (
      elements: string[],
      options: {
        out: OutputFormat;
        annotate?: boolean;
      },
    ) => {
      const command: CmdType = {
        type: "array",
        elements,
        out: options.out,
        annotate: options.annotate ?? false,
      };

      const result = run({ command });

      if (!result.ok) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      writeOutput(result.value.output, result.value.isBinary);
    },
  );

// Map subcommand
program
  .command("map")
  .description("Compose a dCBOR map from the provided keys and values")
  .argument(
    "<pairs...>",
    "Each alternating key and value is parsed as a dCBOR item in diagnostic notation",
  )
  .addOption(
    new Option("-o, --out <format>", "The output format")
      .choices(["diag", "hex", "bin", "none"])
      .default("hex"),
  )
  .option("-a, --annotate", "Output diagnostic notation or hexadecimal with annotations")
  .action(
    (
      pairs: string[],
      options: {
        out: OutputFormat;
        annotate?: boolean;
      },
    ) => {
      const command: CmdType = {
        type: "map",
        kvPairs: pairs,
        out: options.out,
        annotate: options.annotate ?? false,
      };

      const result = run({ command });

      if (!result.ok) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      writeOutput(result.value.output, result.value.isBinary);
    },
  );

// Match subcommand
program
  .command("match")
  .description("Match dCBOR data against a pattern")
  .argument("<pattern>", "The pattern to match against")
  .argument("[input]", "dCBOR input (hex, diag, or binary). If not provided, reads from stdin")
  .addOption(
    new Option("-i, --in <format>", "Input format").choices(["diag", "hex", "bin"]).default("diag"),
  )
  .addOption(
    new Option("-o, --out <format>", "Output format")
      .choices(["paths", "diag", "hex", "bin"])
      .default("paths"),
  )
  .option("--no-indent", "Disable indentation of path elements")
  .option("--last-only", "Show only the last element of each path")
  .option("--annotate", "Add annotations to output")
  .option("--captures", "Include capture information in output")
  .action(
    async (
      pattern: string,
      input: string | undefined,
      options: {
        in: InputFormat;
        out: MatchOutputFormat;
        indent: boolean;
        lastOnly?: boolean;
        annotate?: boolean;
        captures?: boolean;
      },
    ) => {
      // Read stdin if needed
      let stdinContent: string | undefined;
      if (input === undefined) {
        stdinContent = await readStdin();
      }

      const command: CmdType = {
        type: "match",
        pattern,
        input,
        in: options.in,
        out: options.out,
        noIndent: !options.indent,
        lastOnly: options.lastOnly ?? false,
        annotate: options.annotate ?? false,
        captures: options.captures ?? false,
      };

      const result = run({ command, stdinContent });

      if (!result.ok) {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      writeOutput(result.value.output, result.value.isBinary);
    },
  );

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  // Check if stdin is a TTY (interactive terminal)
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Write output to stdout
 */
function writeOutput(output: string, isBinary: boolean): void {
  if (isBinary) {
    // For binary output, decode hex back to bytes
    const bytes = Buffer.from(output, "hex");
    process.stdout.write(bytes);
  } else if (output.length > 0) {
    console.log(output);
  }
}

program.parse();
