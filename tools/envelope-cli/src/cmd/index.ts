/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Commands module - 1:1 port of cmd/mod.rs
 *
 * All envelope CLI commands.
 */

// Basic commands
export * as compress from "./compress.js";
export * as decompress from "./decompress.js";
export * as digest from "./digest.js";
export * as extract from "./extract.js";
export * as format from "./format.js";
export * as salt from "./salt.js";

// Crypto commands
export * as encrypt from "./encrypt.js";
export * as decrypt from "./decrypt.js";
export * as sign from "./sign.js";
export * as verify from "./verify.js";
export * as info from "./info.js";

// Import/Export commands
export * as importCmd from "./import.js";
export * as exportCmd from "./export.js";

// Pattern command
export * as pattern from "./pattern.js";

// Module commands
export * as assertion from "./assertion/index.js";
export * as attachment from "./attachment/index.js";
export * as elide from "./elide/index.js";
export * as generate from "./generate/index.js";
export * as proof from "./proof/index.js";
export * as sskr from "./sskr/index.js";
export * as subject from "./subject/index.js";
export * as walk from "./walk/index.js";
export * as xid from "./xid/index.js";
