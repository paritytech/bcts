/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Logging utilities for verbose output with timestamps.
 *
 * Port of logging.rs from hubert-rust.
 *
 * @module
 */

/**
 * Format a timestamp in ISO-8601 Zulu format with fractional seconds.
 *
 * Port of `timestamp()` from logging.rs lines 6-71.
 *
 * @returns Timestamp string in format "YYYY-MM-DDTHH:MM:SS.mmmZ"
 * @category Logging
 *
 * @example
 * ```typescript
 * timestamp() // => "2024-01-15T14:30:45.123Z"
 * ```
 */
export function timestamp(): string {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  const millis = String(now.getUTCMilliseconds()).padStart(3, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}Z`;
}

/**
 * Print a verbose message with timestamp prefix.
 *
 * Port of `verbose_println()` from logging.rs lines 74-78.
 *
 * @param message - The message to print
 * @category Logging
 *
 * @example
 * ```typescript
 * verbosePrintln("Starting operation...");
 * // Output: [2024-01-15T14:30:45.123Z] Starting operation...
 * ```
 */
export function verbosePrintln(message: string): void {
  if (message.length > 0) {
    console.log(`[${timestamp()}] ${message}`);
  }
}

/**
 * Print a polling dot on the same line (no newline).
 *
 * Port of `verbose_print_dot()` from logging.rs lines 81-84.
 *
 * @category Logging
 *
 * @example
 * ```typescript
 * verbosePrintDot(); // Prints "." without newline
 * ```
 */
export function verbosePrintDot(): void {
  process.stdout.write(".");
}

/**
 * Print a newline after dots.
 *
 * Port of `verbose_newline()` from logging.rs lines 87-89.
 *
 * @category Logging
 *
 * @example
 * ```typescript
 * verbosePrintDot();
 * verbosePrintDot();
 * verboseNewline(); // Completes the line of dots
 * ```
 */
export function verboseNewline(): void {
  console.log();
}
