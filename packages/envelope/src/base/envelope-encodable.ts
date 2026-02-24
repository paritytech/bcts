/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { CborTaggedEncodable } from "@bcts/dcbor";
import type { KnownValue } from "@bcts/known-values";
import type { Envelope } from "./envelope";

/// A trait for types that can be encoded as a Gordian Envelope.
///
/// This interface defines the contract for converting a value into an envelope.
/// Types implementing this interface can be used directly with envelope
/// construction functions without explicit conversion.
///
/// There are numerous built-in implementations for common types including:
/// - Primitive types (numbers, strings, booleans)
/// - CBOR values
/// - Cryptographic types (digests, keys, etc.)
/// - Assertions
/// - Other envelopes
///
/// @example
/// ```typescript
/// // String implements EnvelopeEncodable
/// const e1 = Envelope.new("Hello");
///
/// // Numbers implement EnvelopeEncodable
/// const e2 = Envelope.new(42);
///
/// // Using in envelope construction
/// const envelope = Envelope.new("subject")
///     .addAssertion("name", "Alice")  // Uses EnvelopeEncodable for both predicate and object
///     .addAssertion("age", 30);       // Uses EnvelopeEncodable for the numeric object
/// ```
export interface EnvelopeEncodable {
  /// Converts this value into a Gordian Envelope.
  ///
  /// This is the core method of the interface, converting the implementing type
  /// into an envelope representation. Most implementations will convert the
  /// value to a leaf envelope containing the value.
  ///
  /// @returns A new envelope containing the value.
  intoEnvelope(): Envelope;
}

/// Type guard to check if a value implements EnvelopeEncodable.
///
/// @param value - The value to check
/// @returns `true` if the value implements EnvelopeEncodable, `false` otherwise
export function isEnvelopeEncodable(value: unknown): value is EnvelopeEncodable {
  return (
    typeof value === "object" &&
    value !== null &&
    "intoEnvelope" in value &&
    typeof (value as EnvelopeEncodable).intoEnvelope === "function"
  );
}

/// Helper type for values that can be encoded as envelopes.
///
/// This includes:
/// - Types that directly implement EnvelopeEncodable
/// - Primitive types (string, number, boolean)
/// - Uint8Array (for binary data)
/// - null and undefined
///
/// The Envelope class will handle conversion of these types automatically.
export type EnvelopeEncodableValue =
  | EnvelopeEncodable
  | string
  | number
  | boolean
  | bigint
  | Uint8Array
  | null
  | undefined
  | Envelope
  | KnownValue
  | CborTaggedEncodable;
