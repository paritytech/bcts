/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Server module for Hubert distributed storage.
 *
 * This module provides server-side storage implementations and the HTTP server.
 *
 * Port of server/mod.rs from hubert-rust.
 *
 * @module
 */

// Error types
export {
  ServerError,
  ServerGeneralError,
  ServerNetworkError,
  ServerParseError,
  SqliteError,
} from "./error.js";

// Storage backends
export { MemoryKv } from "./memory-kv.js";
export { SqliteKv } from "./sqlite-kv.js";
export { type ServerKv, createMemoryKv, createSqliteKv } from "./server-kv.js";

// HTTP server
export { Server, type ServerConfig, defaultServerConfig } from "./server.js";

// HTTP client
export { ServerKvClient } from "./kv.js";
