/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Common utilities for commands.
 *
 * Port of `cmd/common.rs` from `frost-hubert-rust`.
 *
 * Rust's `cmd::common` exports four cross-cutting helpers used by
 * both the DKG and signing subcommand trees:
 *
 * - `parse_arid_ur` / `signing_key_from_verifying` — re-exported
 *   here so the TS module layout matches Rust. The implementations
 *   live alongside their other DKG-specific siblings in
 *   `cmd/dkg/common.ts` so callers in either tree can keep using
 *   them; this file just surfaces them at the parallel-to-Rust
 *   import path (`@bcts/frost-hubert/cmd/common`).
 * - `group_state_dir` and the verbose-flag helpers are TS-native here.
 *
 * `OptionalStorageSelector` is intentionally not ported: it's a
 * `clap`-specific argument struct and the TS port surfaces the same
 * effect via the `StorageSelection` string-literal union — see the
 * `parity audit` for context.
 *
 * @module
 */

import * as path from "node:path";

export { parseAridUr, signingKeyFromVerifying } from "./dkg/common.js";

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
