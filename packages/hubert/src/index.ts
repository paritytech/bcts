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
 * const envelope = Envelope.new("Hello, Hubert!");
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
// IPFS Module
// =============================================================================

export {
  // Error types
  IpfsError,
  EnvelopeTooLargeError,
  IpfsDaemonError,
  IpfsTimeoutError,
  UnexpectedIpnsPathFormatError,
  // IPFS value helpers
  addBytes,
  catBytes,
  pinCid,
  // IPFS KvStore implementation
  IpfsKv,
} from "./ipfs/index.js";

// =============================================================================
// Mainline Module
// =============================================================================

export {
  // Error types
  MainlineError,
  ValueTooLargeError,
  DhtError,
  PutQueryError,
  DecodeIdError,
  PutMutableError,
  MainlineIoError,
  // Mainline DHT KvStore implementation
  MainlineDhtKv,
} from "./mainline/index.js";

// =============================================================================
// Hybrid Module
// =============================================================================

export {
  // Error types
  HybridError,
  ContentNotFoundError,
  NotReferenceEnvelopeError,
  InvalidReferenceAridError,
  NoIdAssertionError,
  // Reference envelope utilities
  createReferenceEnvelope,
  isReferenceEnvelope,
  extractReferenceArid,
  // Hybrid KvStore implementation
  HybridKv,
} from "./hybrid/index.js";
