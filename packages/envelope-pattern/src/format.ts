/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Path formatting utilities
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust format.rs
 *
 * @module envelope-pattern/format
 */

import type { Envelope } from "@bcts/envelope";

/**
 * A path is a sequence of envelopes from root to a matched element.
 */
export type Path = Envelope[];

/**
 * Format options for each path element.
 *
 * Corresponds to the Rust `PathElementFormat` enum in format.rs
 */
export type PathElementFormat =
  | { readonly type: "Summary"; readonly maxLength?: number }
  | { readonly type: "EnvelopeUR" }
  | { readonly type: "DigestUR" };

/**
 * Creates a Summary format.
 */
export function summaryFormat(maxLength?: number): PathElementFormat {
  if (maxLength !== undefined) {
    return { type: "Summary", maxLength };
  }
  return { type: "Summary" };
}

/**
 * Creates an EnvelopeUR format.
 */
export function envelopeURFormat(): PathElementFormat {
  return { type: "EnvelopeUR" };
}

/**
 * Creates a DigestUR format.
 */
export function digestURFormat(): PathElementFormat {
  return { type: "DigestUR" };
}

/**
 * Default path element format.
 */
export function defaultPathElementFormat(): PathElementFormat {
  return summaryFormat(undefined);
}

/**
 * Options for formatting paths.
 *
 * Corresponds to the Rust `FormatPathsOpts` struct in format.rs
 */
export interface FormatPathsOpts {
  /**
   * Whether to indent each path element.
   * If true, each element will be indented by 4 spaces per level.
   * Default: true
   */
  readonly indent: boolean;

  /**
   * Format for each path element.
   * Default: Summary(None)
   */
  readonly elementFormat: PathElementFormat;

  /**
   * If true, only the last element of each path will be formatted.
   * This is useful for displaying only the final destination of a path.
   * If false, all elements will be formatted.
   * Default: false
   */
  readonly lastElementOnly: boolean;
}

/**
 * Creates default formatting options.
 */
export function defaultFormatPathsOpts(): FormatPathsOpts {
  return {
    indent: true,
    elementFormat: defaultPathElementFormat(),
    lastElementOnly: false,
  };
}

/**
 * Builder for FormatPathsOpts.
 */
export class FormatPathsOptsBuilder {
  private _indent = true;
  private _elementFormat: PathElementFormat = defaultPathElementFormat();
  private _lastElementOnly = false;

  /**
   * Sets whether to indent each path element.
   */
  indent(indent: boolean): this {
    this._indent = indent;
    return this;
  }

  /**
   * Sets the format for each path element.
   */
  elementFormat(format: PathElementFormat): this {
    this._elementFormat = format;
    return this;
  }

  /**
   * Sets whether to format only the last element of each path.
   */
  lastElementOnly(lastElementOnly: boolean): this {
    this._lastElementOnly = lastElementOnly;
    return this;
  }

  /**
   * Builds the FormatPathsOpts.
   */
  build(): FormatPathsOpts {
    return {
      indent: this._indent,
      elementFormat: this._elementFormat,
      lastElementOnly: this._lastElementOnly,
    };
  }
}

/**
 * Creates a new FormatPathsOptsBuilder.
 */
export function formatPathsOpts(): FormatPathsOptsBuilder {
  return new FormatPathsOptsBuilder();
}

/**
 * Gets a summary of an envelope for display.
 *
 * @param env - The envelope to summarize
 * @returns A string summary of the envelope
 */
export function envelopeSummary(env: Envelope): string {
  const id = env.shortId("short");
  const c = env.case();

  let summary: string;
  switch (c.type) {
    case "node": {
      const subjectSummary = env.subject().summary(Number.MAX_SAFE_INTEGER);
      const assertions = env.assertions();
      if (assertions.length > 0) {
        const assertionSummaries = assertions.map((a) => {
          const ac = a.case();
          if (ac.type === "assertion") {
            const pred = ac.assertion.predicate().summary(Number.MAX_SAFE_INTEGER);
            const obj = ac.assertion.object().summary(Number.MAX_SAFE_INTEGER);
            return `${pred}: ${obj}`;
          }
          return a.summary(Number.MAX_SAFE_INTEGER);
        });
        summary = `NODE ${subjectSummary} [ ${assertionSummaries.join(", ")} ]`;
      } else {
        summary = `NODE ${subjectSummary}`;
      }
      break;
    }
    case "leaf":
      summary = `LEAF ${env.summary(Number.MAX_SAFE_INTEGER)}`;
      break;
    case "wrapped":
      summary = `WRAPPED ${env.summary(Number.MAX_SAFE_INTEGER)}`;
      break;
    case "assertion": {
      const pred = c.assertion.predicate().summary(Number.MAX_SAFE_INTEGER);
      const obj = c.assertion.object().summary(Number.MAX_SAFE_INTEGER);
      summary = `ASSERTION ${pred}: ${obj}`;
      break;
    }
    case "elided":
      summary = "ELIDED";
      break;
    case "knownValue":
      summary = `KNOWN_VALUE '${c.value.name()}'`;
      break;
    case "encrypted":
      summary = "ENCRYPTED";
      break;
    case "compressed":
      summary = "COMPRESSED";
      break;
    default:
      summary = "UNKNOWN";
  }

  return `${id} ${summary}`;
}

/**
 * Truncates a string to the specified maximum length, appending an ellipsis if truncated.
 *
 * @param s - The string to truncate
 * @param maxLength - Optional maximum length
 * @returns The truncated string
 */
function truncateWithEllipsis(s: string, maxLength?: number): string {
  if (maxLength === undefined) {
    return s;
  }
  if (s.length > maxLength) {
    if (maxLength > 1) {
      return `${s.substring(0, maxLength - 1)}…`;
    }
    return "…";
  }
  return s;
}

/**
 * Format a single path element on its own line with custom options.
 *
 * @param path - The path to format
 * @param opts - Formatting options
 * @returns The formatted path string
 */
export function formatPathOpt(
  path: Path,
  opts: FormatPathsOpts = defaultFormatPathsOpts(),
): string {
  if (opts.lastElementOnly) {
    // Only format the last element, no indentation
    const element = path[path.length - 1];
    if (element === undefined) {
      return "";
    }

    switch (opts.elementFormat.type) {
      case "Summary": {
        const summary = envelopeSummary(element);
        return truncateWithEllipsis(summary, opts.elementFormat.maxLength);
      }
      case "EnvelopeUR":
        // TODO: Implement proper UR string format when available
        return element.digest().toString();
      case "DigestUR":
        return element.digest().toString();
    }
  }

  switch (opts.elementFormat.type) {
    case "Summary": {
      // Multi-line output with indentation for summaries
      const lines: string[] = [];
      for (let index = 0; index < path.length; index++) {
        const element = path[index];
        if (element === undefined) continue;

        const indent = opts.indent ? " ".repeat(index * 4) : "";
        const summary = envelopeSummary(element);
        const content = truncateWithEllipsis(summary, opts.elementFormat.maxLength);
        lines.push(`${indent}${content}`);
      }
      return lines.join("\n");
    }
    case "EnvelopeUR":
      // TODO: Implement proper UR string format when available
      return path.map((element) => element.digest().toString()).join(" ");
    case "DigestUR":
      // Single-line, space-separated digest strings
      return path.map((element) => element.digest().toString()).join(" ");
  }
}

/**
 * Format a single path with default options.
 *
 * @param path - The path to format
 * @returns The formatted path string
 */
export function formatPath(path: Path): string {
  return formatPathOpt(path, defaultFormatPathsOpts());
}

/**
 * Format multiple paths with captures and custom options.
 *
 * Captures come first, sorted lexicographically by name, with their name
 * prefixed by '@'. Regular paths follow after all captures.
 *
 * @param paths - The paths to format
 * @param captures - Map of capture name to captured paths
 * @param opts - Formatting options
 * @returns The formatted string
 */
export function formatPathsWithCapturesOpt(
  paths: Path[],
  captures: Map<string, Path[]>,
  opts: FormatPathsOpts = defaultFormatPathsOpts(),
): string {
  const result: string[] = [];

  // First, format all captures, sorted lexicographically by name
  const captureNames = Array.from(captures.keys()).sort();

  for (const captureName of captureNames) {
    const capturePaths = captures.get(captureName);
    if (capturePaths === undefined) continue;

    result.push(`@${captureName}`);
    for (const path of capturePaths) {
      const formattedPath = formatPathOpt(path, opts);
      // Add indentation to each line of the formatted path
      for (const line of formattedPath.split("\n")) {
        if (line.length > 0) {
          result.push(`    ${line}`);
        }
      }
    }
  }

  // Then, format all regular paths
  switch (opts.elementFormat.type) {
    case "EnvelopeUR":
    case "DigestUR": {
      // For UR formats, join paths with spaces on same line
      if (paths.length > 0) {
        const formattedPaths = paths.map((path) => formatPathOpt(path, opts)).join(" ");
        if (formattedPaths.length > 0) {
          result.push(formattedPaths);
        }
      }
      break;
    }
    case "Summary": {
      // For summary format, format each path separately
      for (const path of paths) {
        const formattedPath = formatPathOpt(path, opts);
        for (const line of formattedPath.split("\n")) {
          if (line.length > 0) {
            result.push(line);
          }
        }
      }
      break;
    }
  }

  return result.join("\n");
}

/**
 * Format multiple paths with captures using default options.
 *
 * @param paths - The paths to format
 * @param captures - Map of capture name to captured paths
 * @returns The formatted string
 */
export function formatPathsWithCaptures(paths: Path[], captures: Map<string, Path[]>): string {
  return formatPathsWithCapturesOpt(paths, captures, defaultFormatPathsOpts());
}

/**
 * Format multiple paths with custom options.
 *
 * @param paths - The paths to format
 * @param opts - Formatting options
 * @returns The formatted string
 */
export function formatPathsOpt(
  paths: Path[],
  opts: FormatPathsOpts = defaultFormatPathsOpts(),
): string {
  return formatPathsWithCapturesOpt(paths, new Map(), opts);
}

/**
 * Format multiple paths with default options.
 *
 * @param paths - The paths to format
 * @returns The formatted string
 */
export function formatPaths(paths: Path[]): string {
  return formatPathsOpt(paths, defaultFormatPathsOpts());
}
