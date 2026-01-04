/**
 * Print command - 1:1 port of print.rs
 *
 * Prints provenance marks in a chain.
 */

import * as fs from "fs";
import * as path from "path";
import { ProvenanceMarkGenerator, ProvenanceMarkInfo } from "@bcts/provenance-mark";

import type { Exec } from "../exec.js";
import { readExistingDirectoryPath } from "../utils.js";
import { OutputFormat, parseOutputFormat } from "./new.js";

/**
 * Arguments for the print command.
 *
 * Corresponds to Rust `CommandArgs`
 */
export interface PrintCommandArgs {
  /** Path to the chain's directory. Must already exist. */
  path: string;
  /** The sequence number of the first mark to print. */
  start: number;
  /** The sequence number of the last mark to print. */
  end?: number;
  /** Output format for the rendered marks. */
  format: OutputFormat;
}

/**
 * Create default args for the print command.
 */
export function defaultPrintCommandArgs(): PrintCommandArgs {
  return {
    path: "",
    start: 0,
    format: OutputFormat.Markdown,
  };
}

/**
 * Print command implementation.
 *
 * Corresponds to Rust `impl Exec for CommandArgs`
 */
export class PrintCommand implements Exec {
  private readonly args: PrintCommandArgs;

  constructor(args: PrintCommandArgs) {
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

    // Validate the start and end sequence numbers.
    const lastValidSeq = generator.nextSeq() - 1;
    const startSeq = this.args.start;
    const endSeq = this.args.end ?? lastValidSeq;

    if (startSeq > endSeq) {
      throw new Error(
        "The start sequence number must be less than or equal to the end sequence number.",
      );
    }
    if (endSeq > lastValidSeq) {
      throw new Error(
        "The end sequence number must be less than or equal to the last valid sequence number.",
      );
    }

    // Collect the requested marks.
    const markInfos: ProvenanceMarkInfo[] = [];
    for (let seq = startSeq; seq <= endSeq; seq++) {
      const markPath = path.join(dirPath, "marks", `mark-${seq}.json`);
      const markJson = fs.readFileSync(markPath, "utf-8");
      const markInfo = ProvenanceMarkInfo.fromJSON(JSON.parse(markJson) as Record<string, unknown>);
      markInfos.push(markInfo);
    }

    switch (this.args.format) {
      case OutputFormat.Markdown: {
        const summaries = markInfos.map((info) => info.markdownSummary());
        return summaries.join("\n");
      }
      case OutputFormat.Ur: {
        const urs = markInfos.map((info) => info.ur().toString());
        return urs.join("\n");
      }
      case OutputFormat.Json: {
        const jsonArray = markInfos.map((info) => info.toJSON());
        return JSON.stringify(jsonArray, null, 2);
      }
    }
  }
}

// Re-export for convenience
export { OutputFormat, parseOutputFormat };
