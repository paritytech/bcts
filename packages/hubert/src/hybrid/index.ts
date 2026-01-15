/**
 * Hybrid module for Hubert distributed storage.
 *
 * This module combines Mainline DHT and IPFS for optimal storage.
 *
 * Port of hybrid/mod.rs from hubert-rust.
 *
 * @module
 */

// Error types
export {
  HybridError,
  ContentNotFoundError,
  NotReferenceEnvelopeError,
  InvalidReferenceAridError,
  NoIdAssertionError,
} from "./error.js";

// Reference envelope utilities
export { createReferenceEnvelope, isReferenceEnvelope, extractReferenceArid } from "./reference.js";

// Hybrid KvStore implementation
export { HybridKv } from "./kv.js";
