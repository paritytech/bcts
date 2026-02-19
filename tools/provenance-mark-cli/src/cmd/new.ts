/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * New command - 1:1 port of new.rs
 *
 * Initialize a directory with a new provenance mark chain.
 */

import * as fs from "fs";
import * as path from "path";
import {
  ProvenanceMarkGenerator,
  ProvenanceMarkInfo,
  ProvenanceMarkResolution,
  type ProvenanceSeed,
} from "@bcts/provenance-mark";

import type { Exec } from "../exec.js";
import { readNewPath } from "../utils.js";
import { type InfoArgs, parseInfoArgs } from "./info.js";

/**
 * Output format for the creation summary.
 *
 * Corresponds to Rust `OutputFormat`
 */
export enum OutputFormat {
  Markdown = "markdown",
  Ur = "ur",
  Json = "json",
}

/**
 * Resolution level for the provenance mark chain.
 *
 * Corresponds to Rust `Resolution`
 */
export enum Resolution {
  /** Good for physical works of art and applications requiring minimal mark size. */
  Low = "low",
  /** Good for digital works of art. */
  Medium = "medium",
  /** Good for general use. */
  Quartile = "quartile",
  /** Industrial strength, largest mark. */
  High = "high",
}

/**
 * Convert Resolution to ProvenanceMarkResolution.
 */
function resolutionToProvenanceMarkResolution(res: Resolution): ProvenanceMarkResolution {
  switch (res) {
    case Resolution.Low:
      return ProvenanceMarkResolution.Low;
    case Resolution.Medium:
      return ProvenanceMarkResolution.Medium;
    case Resolution.Quartile:
      return ProvenanceMarkResolution.Quartile;
    case Resolution.High:
      return ProvenanceMarkResolution.High;
  }
}

/**
 * Parse a resolution string.
 */
export function parseResolution(value: string): Resolution {
  switch (value.toLowerCase()) {
    case "low":
      return Resolution.Low;
    case "medium":
      return Resolution.Medium;
    case "quartile":
      return Resolution.Quartile;
    case "high":
      return Resolution.High;
    default:
      throw new Error(`Invalid resolution: ${value}. Must be one of: low, medium, quartile, high`);
  }
}

/**
 * Parse an output format string.
 */
export function parseOutputFormat(value: string): OutputFormat {
  switch (value.toLowerCase()) {
    case "markdown":
      return OutputFormat.Markdown;
    case "ur":
      return OutputFormat.Ur;
    case "json":
      return OutputFormat.Json;
    default:
      throw new Error(`Invalid format: ${value}. Must be one of: markdown, ur, json`);
  }
}

/**
 * Arguments for the new command.
 *
 * Corresponds to Rust `CommandArgs`
 */
export interface NewCommandArgs {
  /** Path to directory to be created. Must not already exist. */
  path: string;
  /** A seed to use for the provenance mark chain, encoded as base64. */
  seed?: ProvenanceSeed;
  /** The resolution of the provenance mark chain. */
  resolution: Resolution;
  /** A comment to be included for the genesis mark. */
  comment: string;
  /** The date of the genesis mark. If not supplied, the current date is used. */
  date?: Date;
  /** Suppress informational status output on stderr/stdout. */
  quiet: boolean;
  /** Output format for the creation summary. */
  format: OutputFormat;
  /** Info args for the mark. */
  info: InfoArgs;
}

/**
 * Create default args for the new command.
 */
export function defaultNewCommandArgs(): NewCommandArgs {
  return {
    path: "",
    resolution: Resolution.Quartile,
    comment: "Genesis mark.",
    quiet: false,
    format: OutputFormat.Markdown,
    info: {},
  };
}

/**
 * New command implementation.
 *
 * Corresponds to Rust `impl Exec for CommandArgs`
 */
export class NewCommand implements Exec {
  private readonly args: NewCommandArgs;

  constructor(args: NewCommandArgs) {
    this.args = args;
  }

  exec(): string {
    // Create the directory, ensuring it doesn't already exist.
    const dirPath = this.createDir();

    // Create the `marks` subdirectory inside `path`.
    const marksPath = path.join(dirPath, "marks");
    fs.mkdirSync(marksPath);

    // Create the generator
    const resolution = resolutionToProvenanceMarkResolution(this.args.resolution);
    let generator: ProvenanceMarkGenerator;
    if (this.args.seed !== undefined) {
      generator = ProvenanceMarkGenerator.newWithSeed(resolution, this.args.seed);
    } else {
      generator = ProvenanceMarkGenerator.newRandom(resolution);
    }

    // Generate the genesis mark.
    const date = this.args.date ?? new Date();
    const info = parseInfoArgs(this.args.info);
    const mark = generator.next(date, info);
    const markInfo = ProvenanceMarkInfo.new(mark, this.args.comment);

    // Serialize the mark to JSON and write it as `mark-seq.json` to `path/marks`.
    const markJson = JSON.stringify(markInfo.toJSON(), null, 2);
    const markPath = path.join(marksPath, `mark-${mark.seq()}.json`);
    fs.writeFileSync(markPath, markJson);

    // Serialize `generator` to JSON and write it as `generator.json` to `path`.
    const generatorJson = JSON.stringify(generator.toJSON(), null, 2);
    const generatorPath = path.join(dirPath, "generator.json");
    fs.writeFileSync(generatorPath, generatorJson);

    // Return output based on format.
    const statusLines = [
      `Provenance mark chain created at: ${dirPath}`,
      `Mark ${mark.seq()} written to: ${markPath}`,
    ];

    switch (this.args.format) {
      case OutputFormat.Markdown: {
        const paragraphs: string[] = [];
        if (!this.args.quiet) {
          paragraphs.push(...statusLines);
        }
        paragraphs.push(markInfo.markdownSummary());
        return paragraphs.join("\n\n");
      }
      case OutputFormat.Ur: {
        if (!this.args.quiet) {
          for (const line of statusLines) {
            console.error(line);
          }
        }
        return markInfo.ur().toString();
      }
      case OutputFormat.Json: {
        if (!this.args.quiet) {
          for (const line of statusLines) {
            console.error(line);
          }
        }
        return JSON.stringify(markInfo.toJSON(), null, 2);
      }
    }
  }

  private createDir(): string {
    const dirPath = readNewPath(this.args.path);

    // Ensure the directory doesn't already exist.
    if (fs.existsSync(dirPath)) {
      throw new Error(`Path already exists: ${dirPath}`);
    }

    // Ensure the parent directory exists.
    const parent = path.dirname(dirPath);
    if (!fs.existsSync(parent)) {
      throw new Error(`Parent directory does not exist: ${parent}`);
    }

    // Create the new directory.
    fs.mkdirSync(dirPath);

    return dirPath;
  }
}
