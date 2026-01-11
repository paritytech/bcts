/**
 * LifeHash CLI - Command line tool for generating LifeHash PNG images.
 *
 * Ported from bc-lifehash-cli C++ implementation (lifehash.cpp).
 *
 * @module
 */

import { Command } from "commander";
import { makeFromUtf8, Version } from "@bcts/lifehash";
import { writeImage } from "./png-writer";
import { appendingPathComponent, makeRandomInput } from "./utils";

/**
 * CLI options interface.
 *
 * Port of Parameters struct from lifehash.cpp lines 86-91.
 *
 * @category CLI
 */
export interface CliOptions {
  /** LifeHash version to generate */
  version: string;
  /** Size of each module ("pixel") */
  module: string;
  /** Output directory path */
  path: string;
}

/**
 * Parses a version string to the Version enum.
 *
 * Port of version parsing logic from lifehash.cpp lines 130-145.
 *
 * @param versionString - The version string from CLI
 * @returns The corresponding Version enum value
 * @throws Error if the version string is invalid
 * @category CLI
 *
 * @example
 * ```typescript
 * parseVersion("version2") // => Version.version2
 * parseVersion("detailed") // => Version.detailed
 * parseVersion("invalid") // throws Error
 * ```
 */
export function parseVersion(versionString: string): Version {
  switch (versionString) {
    case "version1":
      return Version.version1;
    case "version2":
      return Version.version2;
    case "detailed":
      return Version.detailed;
    case "fiducial":
      return Version.fiducial;
    case "grayscaleFiducial":
      return Version.grayscale_fiducial;
    default:
      throw new Error("Invalid version.");
  }
}

/**
 * Main execution function that generates a LifeHash image.
 *
 * Port of `run()` from lifehash.cpp lines 188-192.
 *
 * @param input - Input string to hash (or empty for random)
 * @param options - CLI options
 * @category CLI
 *
 * @example
 * ```typescript
 * run("Hello", { version: "version2", module: "1", path: "." });
 * // Generates Hello.png in current directory
 * ```
 */
export function run(input: string, options: CliOptions): void {
  // Parse parameters (matching Parameters constructor from C++)
  const version = parseVersion(options.version);
  const moduleSize = parseInt(options.module, 10);

  if (moduleSize < 1 || isNaN(moduleSize)) {
    throw new Error("Illegal value.");
  }

  // Use random input if none provided
  const actualInput = input !== "" ? input : makeRandomInput();

  // Generate output filename
  const outputFilename = `${actualInput}.png`;
  const outputFile = appendingPathComponent(options.path, outputFilename);

  // Generate LifeHash image
  const image = makeFromUtf8(actualInput, version, moduleSize);

  // Write to PNG file
  writeImage(image, outputFile);
}

/**
 * CLI entry point.
 *
 * Port of `main()` from lifehash.cpp lines 194-206.
 *
 * @category CLI
 */
export function main(): void {
  const program = new Command();

  program
    .name("lifehash")
    .description("Generate LifeHash PNG images from input strings")
    .argument("[input]", "Input string to hash (default: random XXX-XXX)")
    .option(
      "-v, --version <version>",
      "LifeHash version: version1, version2, detailed, fiducial, grayscaleFiducial",
      "version2",
    )
    .option("-m, --module <size>", 'Size of each module ("pixel")', "1")
    .option("-p, --path <path>", "Output directory path", "")
    .action((input: string | undefined, options: CliOptions) => {
      try {
        run(input ?? "", options);
      } catch (error) {
        if (error instanceof Error) {
          console.log(`\u{1F928} ${error.message}`);
          console.log();
          program.help();
        }
        process.exit(1);
      }
    });

  program.parse();
}

// Run CLI when executed directly (not when imported as a module)
// Check if this file is the main entry point
const isMainModule =
  typeof process !== "undefined" &&
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("/main.mjs") ||
    process.argv[1].endsWith("/main.js") ||
    process.argv[1].includes("lifehash-cli"));

if (isMainModule) {
  main();
}
