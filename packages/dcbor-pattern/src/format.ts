/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Format Module for dcbor-pattern
 *
 * This module provides formatting utilities for displaying paths returned by
 * pattern matching. Unlike `bc-envelope-pattern` which supports digest URs and
 * envelope URs, this module focuses on CBOR diagnostic notation formatting.
 *
 * ## Features
 *
 * - **Diagnostic formatting**: Format CBOR elements using either standard or
 *   flat diagnostic notation
 * - **Path indentation**: Automatically indent nested path elements
 * - **Truncation support**: Optionally truncate long representations with
 *   ellipsis
 * - **Flexible options**: Choose whether to show all elements or just the
 *   final destination
 *
 * @module format
 */

import { type Cbor, summary, diagnosticOpt } from "@bcts/dcbor";

/**
 * A Path is a sequence of CBOR values representing the traversal from root
 * to a matched element.
 */
export type Path = Cbor[];

/**
 * A builder that provides formatting options for each path element.
 */
export enum PathElementFormat {
  /**
   * Diagnostic summary format, with optional maximum length for truncation.
   */
  DiagnosticSummary = "diagnostic_summary",

  /**
   * Flat diagnostic format (single line), with optional maximum length for
   * truncation.
   */
  DiagnosticFlat = "diagnostic_flat",
}

/**
 * Options for formatting paths.
 */
export interface FormatPathsOpts {
  /**
   * Whether to indent each path element.
   * If true, each element will be indented by 4 spaces per level.
   * @default true
   */
  readonly indent: boolean;

  /**
   * Format for each path element.
   * @default PathElementFormat.DiagnosticSummary
   */
  readonly elementFormat: PathElementFormat;

  /**
   * Maximum length for element representation before truncation.
   * If undefined, no truncation is applied.
   */
  readonly maxLength: number | undefined;

  /**
   * If true, only the last element of each path will be formatted.
   * This is useful for displaying only the final destination of a path.
   * If false, all elements will be formatted.
   * @default false
   */
  readonly lastElementOnly: boolean;
}

/**
 * Default formatting options.
 */
export const DEFAULT_FORMAT_OPTS: FormatPathsOpts = {
  indent: true,
  elementFormat: PathElementFormat.DiagnosticSummary,
  maxLength: undefined,
  lastElementOnly: false,
} as const;

/**
 * Creates formatting options with builder pattern.
 */
export class FormatPathsOptsBuilder {
  private _opts: FormatPathsOpts;

  constructor() {
    this._opts = { ...DEFAULT_FORMAT_OPTS };
  }

  /**
   * Creates a new builder with default options.
   */
  static new(): FormatPathsOptsBuilder {
    return new FormatPathsOptsBuilder();
  }

  /**
   * Sets whether to indent each path element.
   */
  indent(indent: boolean): FormatPathsOptsBuilder {
    this._opts = { ...this._opts, indent };
    return this;
  }

  /**
   * Sets the format for each path element.
   */
  elementFormat(format: PathElementFormat): FormatPathsOptsBuilder {
    this._opts = { ...this._opts, elementFormat: format };
    return this;
  }

  /**
   * Sets the maximum length for element representation.
   */
  maxLength(length: number | undefined): FormatPathsOptsBuilder {
    this._opts = { ...this._opts, maxLength: length };
    return this;
  }

  /**
   * Sets whether to format only the last element of each path.
   */
  lastElementOnly(lastOnly: boolean): FormatPathsOptsBuilder {
    this._opts = { ...this._opts, lastElementOnly: lastOnly };
    return this;
  }

  /**
   * Builds the options object.
   */
  build(): FormatPathsOpts {
    return this._opts;
  }
}

/**
 * Truncates a string to the specified maximum length, appending an ellipsis if
 * truncated.
 *
 * @internal
 * @param s - The string to truncate
 * @param maxLength - Maximum length, or undefined for no truncation
 * @returns The possibly truncated string
 */
const truncateWithEllipsis = (s: string, maxLength?: number): string => {
  if (maxLength === undefined || s.length <= maxLength) {
    return s;
  }
  if (maxLength > 1) {
    return `${s.slice(0, maxLength - 1)}…`;
  }
  return "…";
};

/**
 * Format a single CBOR element according to the specified format.
 *
 * @internal
 * @param cbor - The CBOR value to format
 * @param format - The format to use
 * @param maxLength - Maximum length before truncation
 * @returns The formatted string
 */
const formatCborElement = (cbor: Cbor, format: PathElementFormat, maxLength?: number): string => {
  let diagnostic: string;

  // Use the diagnostic functions from @bcts/dcbor
  if (format === PathElementFormat.DiagnosticSummary) {
    // summary() provides a compact representation with summarizers
    diagnostic = summary(cbor);
  } else {
    // diagnosticOpt with flat: true and summarize: true provides a single-line
    // representation with date/time formatting for known tags like tag 1
    diagnostic = diagnosticOpt(cbor, { flat: true, summarize: true });
  }

  return truncateWithEllipsis(diagnostic, maxLength);
};

/**
 * Format each path element on its own line, each line successively indented by
 * 4 spaces. Options can be provided to customize the formatting.
 *
 * @param path - The path to format
 * @param opts - Formatting options
 * @returns The formatted path string
 */
export const formatPathOpt = (path: Path, opts: FormatPathsOpts = DEFAULT_FORMAT_OPTS): string => {
  if (opts.lastElementOnly) {
    // Only format the last element, no indentation.
    const lastElement = path[path.length - 1];
    if (lastElement !== undefined) {
      return formatCborElement(lastElement, opts.elementFormat, opts.maxLength);
    }
    return "";
  }

  // Multi-line output with indentation for diagnostic formats.
  const lines: string[] = [];
  for (let index = 0; index < path.length; index++) {
    const element = path[index];
    const indent = opts.indent ? " ".repeat(index * 4) : "";
    const content = formatCborElement(element, opts.elementFormat, opts.maxLength);
    lines.push(`${indent}${content}`);
  }
  return lines.join("\n");
};

/**
 * Format each path element on its own line, each line successively indented by
 * 4 spaces.
 *
 * @param path - The path to format
 * @returns The formatted path string
 */
export const formatPath = (path: Path): string => {
  return formatPathOpt(path, DEFAULT_FORMAT_OPTS);
};

/**
 * Format multiple paths with captures in a structured way.
 * Captures come first, sorted lexicographically by name, with their name
 * prefixed by '@'. Regular paths follow after all captures.
 *
 * @param paths - The paths to format
 * @param captures - Named capture groups and their paths
 * @param opts - Formatting options
 * @returns The formatted string
 */
export const formatPathsWithCaptures = (
  paths: Path[],
  captures: Map<string, Path[]>,
  opts: FormatPathsOpts = DEFAULT_FORMAT_OPTS,
): string => {
  const result: string[] = [];

  // First, format all captures, sorted lexicographically by name
  const captureNames = Array.from(captures.keys()).sort();

  for (const captureName of captureNames) {
    const capturePaths = captures.get(captureName);
    if (capturePaths !== undefined) {
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
  }

  // Then, format all regular paths
  for (const path of paths) {
    const formattedPath = formatPathOpt(path, opts);
    for (const line of formattedPath.split("\n")) {
      if (line.length > 0) {
        result.push(line);
      }
    }
  }

  return result.join("\n");
};

/**
 * Format multiple paths with custom formatting options.
 *
 * @param paths - The paths to format
 * @param opts - Formatting options
 * @returns The formatted string
 */
export const formatPathsOpt = (
  paths: Path[],
  opts: FormatPathsOpts = DEFAULT_FORMAT_OPTS,
): string => {
  // Call formatPathsWithCaptures with empty captures
  return formatPathsWithCaptures(paths, new Map(), opts);
};

/**
 * Format multiple paths with default options.
 *
 * @param paths - The paths to format
 * @returns The formatted string
 */
export const formatPaths = (paths: Path[]): string => {
  return formatPathsOpt(paths, DEFAULT_FORMAT_OPTS);
};
