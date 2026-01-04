/**
 * Next command - 1:1 port of next.rs
 *
 * Generate the next provenance mark in a chain.
 */

/* eslint-disable no-console, no-undef */

import * as fs from "fs";
import * as path from "path";
import { ProvenanceMarkGenerator, ProvenanceMarkInfo } from "@bcts/provenance-mark";

import type { Exec } from "../exec.js";
import { readExistingDirectoryPath } from "../utils.js";
import { type InfoArgs, parseInfoArgs } from "./info.js";
import { OutputFormat, parseOutputFormat } from "./new.js";

/**
 * Arguments for the next command.
 *
 * Corresponds to Rust `CommandArgs`
 */
export interface NextCommandArgs {
  /** Path to the chain's directory. Must already exist. */
  path: string;
  /** A comment to be included for the mark. */
  comment: string;
  /** The date of the next mark. If not supplied, the current date is used. */
  date?: Date;
  /** Suppress informational status output on stderr/stdout. */
  quiet: boolean;
  /** Output format for the mark. */
  format: OutputFormat;
  /** Info args for the mark. */
  info: InfoArgs;
}

/**
 * Create default args for the next command.
 */
export function defaultNextCommandArgs(): NextCommandArgs {
  return {
    path: "",
    comment: "Blank.",
    quiet: false,
    format: OutputFormat.Markdown,
    info: {},
  };
}

/**
 * Next command implementation.
 *
 * Corresponds to Rust `impl Exec for CommandArgs`
 */
export class NextCommand implements Exec {
  private readonly args: NextCommandArgs;

  constructor(args: NextCommandArgs) {
    this.args = args;
  }

  exec(): string {
    // Get the chain's directory path.
    const dirPath = readExistingDirectoryPath(this.args.path);

    // Read the generator from `path/generator.json`.
    const generatorPath = path.join(dirPath, "generator.json");
    const generatorJson = fs.readFileSync(generatorPath, "utf-8");
    const generator = ProvenanceMarkGenerator.fromJSON(
      JSON.parse(generatorJson) as Record<string, unknown>,
    );

    // Generate the next mark.
    const date = this.args.date ?? new Date();
    const info = parseInfoArgs(this.args.info);
    const mark = generator.next(date, info);
    const markInfo = ProvenanceMarkInfo.new(mark, this.args.comment);

    // Serialize the mark to JSON and write it as `mark-seq.json` to `path/marks`.
    const marksPath = path.join(dirPath, "marks");
    const markJson = JSON.stringify(markInfo.toJSON(), null, 2);
    const markPath = path.join(marksPath, `mark-${mark.seq()}.json`);
    fs.writeFileSync(markPath, markJson);

    // Serialize `generator` to JSON and write it back to `path/generator.json`.
    const newGeneratorJson = JSON.stringify(generator.toJSON(), null, 2);
    fs.writeFileSync(generatorPath, newGeneratorJson);

    // Return output based on format.
    const statusLine = `Mark ${mark.seq()} written to: ${markPath}`;

    switch (this.args.format) {
      case OutputFormat.Markdown: {
        const paragraphs: string[] = [];
        if (!this.args.quiet) {
          paragraphs.push(statusLine);
        }
        paragraphs.push(markInfo.markdownSummary());
        return paragraphs.join("\n\n");
      }
      case OutputFormat.Ur: {
        if (!this.args.quiet) {
          console.error(statusLine);
        }
        return markInfo.ur().toString();
      }
      case OutputFormat.Json: {
        if (!this.args.quiet) {
          console.error(statusLine);
        }
        return JSON.stringify(markInfo.toJSON(), null, 2);
      }
    }
  }
}

// Re-export for convenience
export { OutputFormat, parseOutputFormat };
