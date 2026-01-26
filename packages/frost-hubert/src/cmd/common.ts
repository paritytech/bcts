/**
 * Common utilities for commands.
 *
 * Port of cmd/common.rs from frost-hubert-rust.
 *
 * @module
 */

import * as path from "node:path";

/**
 * Get the group state directory for a given registry path and group ID.
 *
 * Port of `group_state_dir()` from cmd/common.rs.
 */
export function groupStateDir(registryPath: string, groupIdHex: string): string {
  const base = path.dirname(registryPath);
  return path.join(base, "group-state", groupIdHex);
}

/**
 * Global verbose flag.
 */
let verboseFlag = false;

/**
 * Set the verbose flag.
 */
export function setVerbose(value: boolean): void {
  verboseFlag = value;
}

/**
 * Check if verbose mode is enabled.
 *
 * Port of `is_verbose()` from cmd/common.rs.
 */
export function isVerbose(): boolean {
  return verboseFlag;
}
