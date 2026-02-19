/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * CLI styling utilities
 * Ported from seedtool-cli-rust/src/styles.rs
 */

import chalk from "chalk";

/**
 * Get CLI styles matching the Rust clap styling.
 * Matches Rust get_styles function.
 *
 * These styles are used for CLI help text formatting:
 * - usage: Bold, underlined, yellow - for usage section headers
 * - header: Bold, underlined, yellow - for section headers
 * - literal: Green - for command/argument literals
 * - invalid: Bold, red - for invalid input indicators
 * - error: Bold, red - for error messages
 * - valid: Bold, underlined, green - for valid input indicators
 * - placeholder: Bright cyan - for placeholder values
 */
export const styles = {
  /** Style for usage section headers */
  usage: chalk.bold.underline.yellow,

  /** Style for section headers */
  header: chalk.bold.underline.yellow,

  /** Style for command/argument literals */
  literal: chalk.green,

  /** Style for invalid input indicators */
  invalid: chalk.bold.red,

  /** Style for error messages */
  error: chalk.bold.red,

  /** Style for valid input indicators */
  valid: chalk.bold.underline.green,

  /** Style for placeholder values */
  placeholder: chalk.cyanBright,
};

/**
 * Get styles object for use with commander.js
 * Note: Commander uses different styling API than clap
 */
export function getStyles(): typeof styles {
  return styles;
}
