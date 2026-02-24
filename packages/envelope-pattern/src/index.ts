/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * @bcts/envelope-pattern - Pattern matching for Gordian Envelope structures
 *
 * This is a 1:1 TypeScript port of bc-envelope-pattern-rust.
 *
 * @module envelope-pattern
 */

// Re-export types from dcbor-pattern that are used in this package
export { Interval, Quantifier, Reluctance } from "@bcts/dcbor-pattern";

// Error types
export * from "./error";

// Format utilities
export * from "./format";

// Pattern types and matching
export * from "./pattern";

// Parsing
export * from "./parse";

/**
 * Package version.
 */
export const VERSION = "1.0.0-alpha.11";
