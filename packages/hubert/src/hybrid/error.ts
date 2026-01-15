/**
 * Hybrid-specific errors.
 *
 * Port of hybrid/error.rs from hubert-rust.
 *
 * @module
 */

import { HubertError } from "../error.js";

/**
 * Base class for Hybrid-specific errors.
 *
 * @category Hybrid
 */
export class HybridError extends HubertError {
  constructor(message: string) {
    super(message);
    this.name = "HybridError";
  }
}

/**
 * Referenced IPFS content not found.
 *
 * Port of `Error::ContentNotFound` from hybrid/error.rs line 4-5.
 *
 * @category Hybrid
 */
export class ContentNotFoundError extends HybridError {
  constructor() {
    super("Referenced IPFS content not found");
    this.name = "ContentNotFoundError";
  }
}

/**
 * Not a reference envelope.
 *
 * Port of `Error::NotReferenceEnvelope` from hybrid/error.rs line 7-8.
 *
 * @category Hybrid
 */
export class NotReferenceEnvelopeError extends HybridError {
  constructor() {
    super("Not a reference envelope");
    this.name = "NotReferenceEnvelopeError";
  }
}

/**
 * Invalid ARID in reference envelope.
 *
 * Port of `Error::InvalidReferenceArid` from hybrid/error.rs line 10-11.
 *
 * @category Hybrid
 */
export class InvalidReferenceAridError extends HybridError {
  constructor() {
    super("Invalid ARID in reference envelope");
    this.name = "InvalidReferenceAridError";
  }
}

/**
 * No id assertion found in reference envelope.
 *
 * Port of `Error::NoIdAssertion` from hybrid/error.rs line 13-14.
 *
 * @category Hybrid
 */
export class NoIdAssertionError extends HybridError {
  constructor() {
    super("No id assertion found in reference envelope");
    this.name = "NoIdAssertionError";
  }
}
