/// Base module exports for Gordian Envelope.
///
/// This module provides the core functionality for working with Gordian
/// Envelopes, including the main Envelope class, assertions, digests,
/// error handling, and various utility functions.

// Core types
export { Envelope, type EnvelopeCase } from "./envelope";
export { Assertion } from "./assertion";
export { Digest, type DigestProvider } from "./digest";

// Error handling
export { EnvelopeError, ErrorCode } from "./error";

// Encodable/Decodable traits
export {
  type EnvelopeEncodable,
  type EnvelopeEncodableValue,
  isEnvelopeEncodable,
} from "./envelope-encodable";

// CBOR encoding/decoding
export {
  EnvelopeCBORTagged,
  EnvelopeCBORTaggedEncodable,
  EnvelopeCBORTaggedDecodable,
  envelopeToCbor,
  envelopeFromCbor,
  envelopeToBytes,
  envelopeFromBytes,
} from "./cbor";

// Envelope decoding utilities
export {
  extractString,
  extractNumber,
  extractBoolean,
  extractBytes,
  extractNull,
  EnvelopeDecoder,
  // Generic typed extraction
  type CborDecoder,
  extractSubject,
  tryObjectForPredicate,
  tryOptionalObjectForPredicate,
  extractObjectForPredicateWithDefault,
  extractObjectsForPredicate,
  tryObjectsForPredicate,
} from "./envelope-decodable";

// Elision and selective disclosure
export { ObscureType, type ObscureAction, elideAction } from "./elide";

// Walking/traversal
export { EdgeType, edgeLabel, type Visitor } from "./walk";

// Import side-effect modules to register prototype extensions
import "./assertions";
import "./leaf";
import "./queries";
import "./elide";
import "./wrap";
import "./walk";
import "./envelope-decodable";
