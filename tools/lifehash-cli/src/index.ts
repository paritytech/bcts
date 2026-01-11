/**
 * @bcts/lifehash-cli - Command line tool for generating LifeHash PNG images.
 *
 * This package provides both a CLI tool and a programmatic API for generating
 * LifeHash visual hash images as PNG files.
 *
 * @packageDocumentation
 * @module @bcts/lifehash-cli
 *
 * @example CLI Usage
 * ```bash
 * # Generate a LifeHash from a string
 * lifehash Hello
 *
 * # Generate with specific version and module size
 * lifehash -v detailed -m 8 Hello
 *
 * # Generate with random input
 * lifehash
 * ```
 *
 * @example Programmatic Usage
 * ```typescript
 * import { generateLifeHash } from "@bcts/lifehash-cli";
 * import { writeFileSync } from "fs";
 *
 * // Generate a PNG buffer
 * const pngBuffer = generateLifeHash("Hello", {
 *   version: "version2",
 *   moduleSize: 1,
 * });
 *
 * // Write to file
 * writeFileSync("Hello.png", pngBuffer);
 * ```
 */

import { generatePNG, writeImage } from "./png-writer";
import { parseVersion, run, type CliOptions } from "./main";
import { makeFromUtf8, Version, type Image } from "@bcts/lifehash";

// PNG encoding exports
export { writeImage, generatePNG };

// Utility exports
export { appendingPathComponent, randomElement, makeRandomInput } from "./utils";

// CLI exports
export { parseVersion, run, type CliOptions };

// Re-export @bcts/lifehash types for convenience
export { Version, type Image };

// Re-export makeFromUtf8 for programmatic usage
export { makeFromUtf8 };

/**
 * Options for generating a LifeHash image.
 *
 * @category Image Generation
 */
export interface GenerateOptions {
  /**
   * LifeHash version to generate.
   * @default "version2"
   */
  version?: "version1" | "version2" | "detailed" | "fiducial" | "grayscaleFiducial";
  /**
   * Size of each module ("pixel").
   * @default 1
   */
  moduleSize?: number;
}

/**
 * Generates a LifeHash PNG buffer from an input string.
 *
 * This is the main programmatic API for generating LifeHash images.
 *
 * @param input - The input string to hash
 * @param options - Generation options
 * @returns A Buffer containing the PNG data
 * @category Image Generation
 *
 * @example
 * ```typescript
 * import { generateLifeHash } from "@bcts/lifehash-cli";
 * import { writeFileSync } from "fs";
 *
 * const pngBuffer = generateLifeHash("Hello", {
 *   version: "version2",
 *   moduleSize: 1,
 * });
 *
 * writeFileSync("Hello.png", pngBuffer);
 * ```
 */
export function generateLifeHash(input: string, options: GenerateOptions = {}): Buffer {
  const { version = "version2", moduleSize = 1 } = options;

  const versionEnum = parseVersion(version);
  const image = makeFromUtf8(input, versionEnum, moduleSize);
  return generatePNG(image);
}
