/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * Mainline DHT module for Hubert distributed storage.
 *
 * This module provides Mainline DHT-backed storage using BEP-44 mutable items.
 *
 * Port of mainline/mod.rs from hubert-rust.
 *
 * @module
 */

// Error types
export {
  MainlineError,
  ValueTooLargeError,
  DhtError,
  PutQueryError,
  DecodeIdError,
  PutMutableError,
  MainlineIoError,
} from "./error.js";

// Mainline DHT KvStore implementation
export { MainlineDhtKv } from "./kv.js";
