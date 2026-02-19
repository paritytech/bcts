/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Digest, type DigestProvider } from "./digest";
import { Envelope } from "./envelope";
import { type EnvelopeEncodable } from "./envelope-encodable";
import { EnvelopeError } from "./error";
import { type Cbor, cbor as toCborValue, CborMap } from "@bcts/dcbor";

/// A predicate-object relationship representing an assertion about a subject.
///
/// In Gordian Envelope, assertions are the basic building blocks for attaching
/// information to a subject. An assertion consists of a predicate (which states
/// what is being asserted) and an object (which provides the assertion's
/// value).
///
/// Assertions can be attached to envelope subjects to form semantic statements
/// like: "subject hasAttribute value" or "document signedBy signature".
///
/// Assertions are equivalent to RDF (Resource Description Framework) triples,
/// where:
/// - The envelope's subject is the subject of the triple
/// - The assertion's predicate is the predicate of the triple
/// - The assertion's object is the object of the triple
///
/// Generally you do not create an instance of this type directly, but
/// instead use `Envelope.newAssertion()`, or the various functions
/// on `Envelope` that create assertions.
export class Assertion implements DigestProvider {
  private readonly _predicate: Envelope;
  private readonly _object: Envelope;
  private readonly _digest: Digest;

  /// Creates a new assertion and calculates its digest.
  ///
  /// This constructor takes a predicate and object, both of which are
  /// converted to envelopes using the `EnvelopeEncodable` trait. It then
  /// calculates the assertion's digest by combining the digests of the
  /// predicate and object.
  ///
  /// The digest is calculated according to the Gordian Envelope
  /// specification, which ensures that semantically equivalent assertions
  /// always produce the same digest.
  ///
  /// @param predicate - The predicate of the assertion, which states what is
  ///   being asserted
  /// @param object - The object of the assertion, which provides the assertion's
  ///   value
  ///
  /// @returns A new assertion with the specified predicate, object, and calculated
  /// digest.
  ///
  /// @example
  /// ```typescript
  /// // Direct method - create an assertion envelope
  /// const assertionEnvelope = Envelope.newAssertion("name", "Alice");
  ///
  /// // Or create and add an assertion to a subject
  /// const person = Envelope.new("person").addAssertion("name", "Alice");
  /// ```
  constructor(predicate: EnvelopeEncodable | Envelope, object: EnvelopeEncodable | Envelope) {
    this._predicate = predicate instanceof Envelope ? predicate : Envelope.new(predicate);
    this._object = object instanceof Envelope ? object : Envelope.new(object);
    this._digest = Digest.fromDigests([this._predicate.digest(), this._object.digest()]);
  }

  /// Returns the predicate of the assertion.
  ///
  /// The predicate states what is being asserted about the subject. It is
  /// typically a string or known value, but can be any envelope.
  ///
  /// @returns A clone of the assertion's predicate envelope.
  predicate(): Envelope {
    return this._predicate;
  }

  /// Returns the object of the assertion.
  ///
  /// The object provides the value or content of the assertion. It can be any
  /// type that can be represented as an envelope.
  ///
  /// @returns A clone of the assertion's object envelope.
  object(): Envelope {
    return this._object;
  }

  /// Returns the digest of this assertion.
  ///
  /// Implementation of the DigestProvider interface.
  ///
  /// @returns The assertion's digest
  digest(): Digest {
    return this._digest;
  }

  /// Checks if two assertions are equal based on digest equality.
  ///
  /// Two assertions are considered equal if they have the same digest,
  /// regardless of how they were constructed.
  ///
  /// @param other - The other assertion to compare with
  /// @returns `true` if the assertions are equal, `false` otherwise
  equals(other: Assertion): boolean {
    return this._digest.equals(other._digest);
  }

  /// Converts this assertion to CBOR.
  ///
  /// The CBOR representation of an assertion is a map with a single key-value
  /// pair, where the key is the predicate's CBOR and the value is the object's
  /// CBOR.
  ///
  /// @returns A CBOR representation of this assertion
  toCbor(): Cbor {
    const map = new CborMap();
    map.set(this._predicate.untaggedCbor(), this._object.untaggedCbor());
    return toCborValue(map);
  }

  /// Attempts to create an assertion from a CBOR value.
  ///
  /// The CBOR must be a map with exactly one entry, where the key represents
  /// the predicate and the value represents the object.
  ///
  /// @param cbor - The CBOR value to convert
  /// @returns A new Assertion instance
  /// @throws {EnvelopeError} If the CBOR is not a valid assertion
  static fromCbor(cbor: Cbor): Assertion {
    // Check if cbor is a Map
    if (!(cbor instanceof CborMap)) {
      throw EnvelopeError.invalidAssertion();
    }

    return Assertion.fromCborMap(cbor);
  }

  /// Attempts to create an assertion from a CBOR map.
  ///
  /// The map must have exactly one entry, where the key represents the
  /// predicate and the value represents the object. This is used in
  /// the deserialization process.
  ///
  /// @param map - The CBOR map to convert
  /// @returns A new Assertion instance
  /// @throws {EnvelopeError} If the map doesn't have exactly one entry
  static fromCborMap(map: CborMap): Assertion {
    if (map.size !== 1) {
      throw EnvelopeError.invalidAssertion();
    }

    const entries = Array.from(map.entries());
    const firstEntry = entries[0];
    if (firstEntry === undefined) {
      throw EnvelopeError.invalidAssertion();
    }
    const [predicateCbor, objectCbor] = firstEntry;

    const predicate = Envelope.fromUntaggedCbor(predicateCbor);

    const object = Envelope.fromUntaggedCbor(objectCbor);

    return new Assertion(predicate, object);
  }

  /// Creates a string representation of this assertion for debugging.
  ///
  /// @returns A string representation
  toString(): string {
    return `Assertion(${String(this._predicate)}: ${String(this._object)})`;
  }

  /// Creates a copy of this assertion.
  ///
  /// Since assertions are immutable and envelopes are cheap to clone,
  /// this returns the same instance.
  ///
  /// @returns This assertion instance
  clone(): Assertion {
    return this;
  }
}
