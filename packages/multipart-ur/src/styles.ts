/**
 * Copyright © 2026 Blockchain Commons, LLC
 * Copyright © 2026 Parity Technologies
 *
 * Port of `bc-mur::styles`. ANSI styling for the `mur` CLI's help output,
 * mirroring the clap `Styles` configuration from rust:
 *
 *   - usage, header:   bold + underline + yellow
 *   - literal:         green
 *   - invalid, error:  bold + red
 *   - valid:           bold + underline + green
 *   - placeholder:     bright cyan
 *
 * Pure presentation helpers — no functional effect.
 */

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

const style =
  (codes: string) =>
  (s: string): string =>
    `${ESC}${codes}m${s}${RESET}`;

/** Styled-string helpers matching rust clap's `Styles::styled()` configuration. */
export interface Styles {
  usage(s: string): string;
  header(s: string): string;
  literal(s: string): string;
  invalid(s: string): string;
  error(s: string): string;
  valid(s: string): string;
  placeholder(s: string): string;
}

/** Returns the `Styles` object used by the `mur` CLI. */
export function getStyles(): Styles {
  return {
    usage: style("1;4;33"), // bold + underline + yellow
    header: style("1;4;33"), // bold + underline + yellow
    literal: style("32"), // green
    invalid: style("1;31"), // bold + red
    error: style("1;31"), // bold + red
    valid: style("1;4;32"), // bold + underline + green
    placeholder: style("96"), // bright cyan
  };
}
