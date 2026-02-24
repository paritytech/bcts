/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Command module organization
 * Equivalent to Rust's cmd/mod.rs
 */

import type { Result } from "@bcts/dcbor";

export * from "./array.js";
export * from "./default.js";
export * from "./map.js";
export * from "./match.js";

/**
 * Trait for command execution
 * Equivalent to Rust's `pub trait Exec`
 */
export interface Exec {
  exec(): Result<string>;
}
