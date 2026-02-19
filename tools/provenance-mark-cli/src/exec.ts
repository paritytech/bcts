/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Exec interface - 1:1 port of exec.rs
 *
 * All CLI commands implement this interface.
 */

/**
 * Result type for command execution.
 * Commands return either a string output or throw an error.
 */
export type ExecResult = string;

/**
 * Interface that all CLI commands implement.
 * Each command's exec() method returns a string output.
 */
export interface Exec {
  /**
   * Execute the command and return the output string.
   * @throws Error if the command fails
   */
  exec(): ExecResult;
}
