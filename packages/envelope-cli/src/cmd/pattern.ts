/**
 * Pattern command - 1:1 port of cmd/pattern.rs
 *
 * Match the envelope subject against a pattern.
 */

import { Pattern, formatPathsOpt, FormatPathsOpts, PathElementFormat } from "@bcts/envelope-pattern";
import type { Exec } from "../exec.js";
import { readEnvelope } from "../utils.js";

/**
 * Command arguments for the pattern command.
 */
export interface CommandArgs {
  /** The pattern to be matched */
  pattern: string;
  /** Disable indentation of path elements */
  noIndent: boolean;
  /** Format only the last element of each path */
  lastOnly: boolean;
  /** Format path elements as envelope URs */
  envelopes: boolean;
  /** Format path elements as digest URs */
  digests: boolean;
  /** Format path elements as summary */
  summary: boolean;
  /** Maximum length for summary truncation */
  maxLength?: number;
  /** The envelope to match against */
  envelope?: string;
}

/**
 * Default command arguments.
 */
export function defaultArgs(): Partial<CommandArgs> {
  return {
    noIndent: false,
    lastOnly: false,
    envelopes: false,
    digests: false,
    summary: false,
  };
}

/**
 * Pattern command implementation.
 */
export class PatternCommand implements Exec {
  constructor(private args: CommandArgs) {}

  exec(): string {
    const envelope = readEnvelope(this.args.envelope);

    const parseResult = Pattern.parse(this.args.pattern);
    if (!parseResult.ok) {
      const error = parseResult.error;
      throw new Error(`Failed to parse pattern: ${error.message}`);
    }

    const pattern = parseResult.value;
    const { paths } = pattern.pathsWithCaptures(envelope);

    // Build format options from command line arguments
    let elementFormat: PathElementFormat;
    if (this.args.envelopes) {
      elementFormat = { type: "envelopeUr" };
    } else if (this.args.digests) {
      elementFormat = { type: "digestUr" };
    } else if (this.args.summary) {
      elementFormat = { type: "summary", maxLength: this.args.maxLength };
    } else {
      elementFormat = { type: "summary" };
    }

    const formatOptions: FormatPathsOpts = {
      indent: !this.args.noIndent,
      elementFormat,
      lastElementOnly: this.args.lastOnly,
    };

    if (paths.length === 0) {
      throw new Error("No match");
    }

    return formatPathsOpt(paths, formatOptions);
  }
}

/**
 * Execute the pattern command with the given arguments.
 */
export function exec(args: CommandArgs): string {
  return new PatternCommand(args).exec();
}
