/**
 * Hubert - Distributed infrastructure for secure multiparty transactions.
 *
 * This library provides distributed key-value storage using ARID-based addressing
 * with multiple storage backends for FROST threshold signature protocols.
 *
 * Port of lib.rs from hubert-rust.
 *
 * @packageDocumentation
 * @module @bcts/hubert
 *
 * @example Basic Usage
 * ```typescript
 * import { KvStore, deriveIpfsKeyName } from "@bcts/hubert";
 * import { ARID } from "@bcts/components";
 * import { Envelope } from "@bcts/envelope";
 *
 * // Create an ARID
 * const arid = ARID.new();
 *
 * // Create an envelope
 * const envelope = Envelope.wrap("Hello, Hubert!");
 *
 * // Use any KvStore implementation to store/retrieve
 * async function example(store: KvStore) {
 *   await store.put(arid, envelope);
 *   const result = await store.get(arid);
 * }
 * ```
 */

// =============================================================================
// Error Types
// =============================================================================

export {
  HubertError,
  AlreadyExistsError,
  NotFoundError,
  InvalidAridError,
  IoError,
} from "./error.js";

// =============================================================================
// KvStore Interface
// =============================================================================

export { type KvStore } from "./kv-store.js";

// =============================================================================
// ARID Derivation
// =============================================================================

export {
  deriveKey,
  deriveIpfsKeyName,
  deriveMainlineKey,
  obfuscateWithArid,
} from "./arid-derivation.js";

// =============================================================================
// Logging Utilities
// =============================================================================

export { timestamp, verbosePrintln, verbosePrintDot, verboseNewline } from "./logging.js";

// =============================================================================
// Server Module
// =============================================================================

export {
  // Error types
  ServerError,
  ServerGeneralError,
  ServerNetworkError,
  ServerParseError,
  SqliteError,
  // Storage backends
  MemoryKv,
  SqliteKv,
  type ServerKv,
  createMemoryKv,
  createSqliteKv,
  // HTTP server
  Server,
  type ServerConfig,
  defaultServerConfig,
  // HTTP client
  ServerKvClient,
} from "./server/index.js";

// =============================================================================
// Re-exports from submodules (for convenience)
// These will be populated as submodules are implemented
// =============================================================================

// IPFS module exports (will be added in Phase 3)
// export { IpfsKv } from "./ipfs/index.js";

// Mainline module exports (will be added in Phase 4)
// export { MainlineDhtKv } from "./mainline/index.js";

// Hybrid module exports (will be added in Phase 5)
// export { HybridKv } from "./hybrid/index.js";
