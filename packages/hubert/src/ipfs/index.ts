/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * IPFS module for Hubert distributed storage.
 *
 * This module provides IPFS-backed storage using IPNS for ARID-based addressing.
 *
 * Port of ipfs/mod.rs from hubert-rust.
 *
 * @module
 */

// Error types
export {
  IpfsError,
  EnvelopeTooLargeError,
  IpfsDaemonError,
  IpfsTimeoutError,
  UnexpectedIpnsPathFormatError,
} from "./error.js";

// IPFS value helpers
export { addBytes, catBytes, pinCid } from "./value.js";

// IPFS KvStore implementation
export { IpfsKv } from "./kv.js";
