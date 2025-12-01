import type { Cbor } from "@blockchain-commons/dcbor";
import { Envelope } from "./envelope";
import type { EnvelopeEncodableValue } from "./envelope-encodable";
import { EnvelopeError } from "./error";

/// Provides methods for querying envelope structure and extracting data.
///
/// The `queries` module contains methods for:
///
/// 1. **Structural queries**: Methods for examining the envelope's structure
///    (`subject()`, `assertions()`)
/// 2. **Type queries**: Methods for determining the envelope's type
///    (`isLeaf()`, `isNode()`, etc.)
/// 3. **Content extraction**: Methods for extracting typed content from
///    envelopes (`extractSubject()`, `extractObjectForPredicate()`)
/// 4. **Assertion queries**: Methods for finding assertions with specific
///    predicates (`assertionWithPredicate()`)
///
/// These methods enable traversal and inspection of envelope hierarchies,
/// allowing for flexible manipulation and access to envelope data structures.

declare module "./envelope" {
  interface Envelope {
    /// Returns true if the envelope has at least one assertion.
    ///
    /// @returns `true` if there are assertions, `false` otherwise
    hasAssertions(): boolean;

    /// Returns the envelope as an assertion if it is one.
    ///
    /// @returns The assertion envelope or undefined
    asAssertion(): Envelope | undefined;

    /// Returns the envelope as an assertion or throws an error.
    ///
    /// @returns The assertion envelope
    /// @throws {EnvelopeError} If the envelope is not an assertion
    tryAssertion(): Envelope;

    /// Returns the predicate of this assertion envelope.
    ///
    /// @returns The predicate envelope or undefined
    asPredicate(): Envelope | undefined;

    /// Returns the predicate of this assertion envelope or throws an error.
    ///
    /// @returns The predicate envelope
    /// @throws {EnvelopeError} If the envelope is not an assertion
    tryPredicate(): Envelope;

    /// Returns the object of this assertion envelope.
    ///
    /// @returns The object envelope or undefined
    asObject(): Envelope | undefined;

    /// Returns the object of this assertion envelope or throws an error.
    ///
    /// @returns The object envelope
    /// @throws {EnvelopeError} If the envelope is not an assertion
    tryObject(): Envelope;

    /// Checks if this envelope is case Assertion.
    ///
    /// @returns `true` if this is an assertion envelope
    isAssertion(): boolean;

    /// Checks if this envelope is case Elided.
    ///
    /// @returns `true` if this is an elided envelope
    isElided(): boolean;

    /// Checks if this envelope is case Leaf.
    ///
    /// @returns `true` if this is a leaf envelope
    isLeaf(): boolean;

    /// Checks if this envelope is case Node.
    ///
    /// @returns `true` if this is a node envelope
    isNode(): boolean;

    /// Checks if this envelope is case Wrapped.
    ///
    /// @returns `true` if this is a wrapped envelope
    isWrapped(): boolean;

    /// Checks if this envelope is internal (has child elements).
    ///
    /// Internal elements include node, wrapped, and assertion.
    ///
    /// @returns `true` if this envelope has children
    isInternal(): boolean;

    /// Checks if this envelope is obscured (elided, encrypted, or compressed).
    ///
    /// @returns `true` if this envelope is obscured
    isObscured(): boolean;

    /// Returns all assertions with the given predicate.
    ///
    /// Match is performed by comparing digests.
    ///
    /// @param predicate - The predicate to search for
    /// @returns An array of matching assertion envelopes
    assertionsWithPredicate(predicate: EnvelopeEncodableValue): Envelope[];

    /// Returns the assertion with the given predicate.
    ///
    /// @param predicate - The predicate to search for
    /// @returns The matching assertion envelope
    /// @throws {EnvelopeError} If no assertion or multiple assertions match
    assertionWithPredicate(predicate: EnvelopeEncodableValue): Envelope;

    /// Returns the assertion with the given predicate, or undefined if not
    /// found.
    ///
    /// @param predicate - The predicate to search for
    /// @returns The matching assertion envelope or undefined
    /// @throws {EnvelopeError} If multiple assertions match
    optionalAssertionWithPredicate(predicate: EnvelopeEncodableValue): Envelope | undefined;

    /// Returns the object of the assertion with the given predicate.
    ///
    /// @param predicate - The predicate to search for
    /// @returns The object envelope
    /// @throws {EnvelopeError} If no assertion or multiple assertions match
    objectForPredicate(predicate: EnvelopeEncodableValue): Envelope;

    /// Returns the object of the assertion with the given predicate, or
    /// undefined if not found.
    ///
    /// @param predicate - The predicate to search for
    /// @returns The object envelope or undefined
    /// @throws {EnvelopeError} If multiple assertions match
    optionalObjectForPredicate(predicate: EnvelopeEncodableValue): Envelope | undefined;

    /// Returns the objects of all assertions with the matching predicate.
    ///
    /// @param predicate - The predicate to search for
    /// @returns An array of object envelopes
    objectsForPredicate(predicate: EnvelopeEncodableValue): Envelope[];

    /// Returns the number of structural elements in the envelope.
    ///
    /// This includes the envelope itself and all nested elements.
    ///
    /// @returns The total element count
    elementsCount(): number;
  }
}

/// Implementation of hasAssertions()
Envelope.prototype.hasAssertions = function (this: Envelope): boolean {
  const c = this.case();
  return c.type === "node" && c.assertions.length > 0;
};

/// Implementation of asAssertion()
Envelope.prototype.asAssertion = function (this: Envelope): Envelope | undefined {
  const c = this.case();
  return c.type === "assertion" ? this : undefined;
};

/// Implementation of tryAssertion()
Envelope.prototype.tryAssertion = function (this: Envelope): Envelope {
  const result = this.asAssertion();
  if (!result) {
    throw EnvelopeError.notAssertion();
  }
  return result;
};

/// Implementation of asPredicate()
Envelope.prototype.asPredicate = function (this: Envelope): Envelope | undefined {
  // Refer to subject in case the assertion is a node and therefore has
  // its own assertions
  const subj = this.subject();
  const c = subj.case();
  if (c.type === "assertion") {
    return c.assertion.predicate();
  }
  return undefined;
};

/// Implementation of tryPredicate()
Envelope.prototype.tryPredicate = function (this: Envelope): Envelope {
  const result = this.asPredicate();
  if (!result) {
    throw EnvelopeError.notAssertion();
  }
  return result;
};

/// Implementation of asObject()
Envelope.prototype.asObject = function (this: Envelope): Envelope | undefined {
  // Refer to subject in case the assertion is a node and therefore has
  // its own assertions
  const subj = this.subject();
  const c = subj.case();
  if (c.type === "assertion") {
    return c.assertion.object();
  }
  return undefined;
};

/// Implementation of tryObject()
Envelope.prototype.tryObject = function (this: Envelope): Envelope {
  const result = this.asObject();
  if (!result) {
    throw EnvelopeError.notAssertion();
  }
  return result;
};

/// Implementation of isAssertion()
Envelope.prototype.isAssertion = function (this: Envelope): boolean {
  return this.case().type === "assertion";
};

/// Implementation of isElided()
Envelope.prototype.isElided = function (this: Envelope): boolean {
  return this.case().type === "elided";
};

/// Implementation of isLeaf()
Envelope.prototype.isLeaf = function (this: Envelope): boolean {
  return this.case().type === "leaf";
};

/// Implementation of isNode()
Envelope.prototype.isNode = function (this: Envelope): boolean {
  return this.case().type === "node";
};

/// Implementation of isWrapped()
Envelope.prototype.isWrapped = function (this: Envelope): boolean {
  return this.case().type === "wrapped";
};

/// Implementation of isInternal()
Envelope.prototype.isInternal = function (this: Envelope): boolean {
  const type = this.case().type;
  return type === "node" || type === "wrapped" || type === "assertion";
};

/// Implementation of isObscured()
Envelope.prototype.isObscured = function (this: Envelope): boolean {
  const type = this.case().type;
  return type === "elided" || type === "encrypted" || type === "compressed";
};

/// Implementation of assertionsWithPredicate()
Envelope.prototype.assertionsWithPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope[] {
  const predicateEnv = Envelope.new(predicate);
  const predicateDigest = predicateEnv.digest();

  return this.assertions().filter((assertion) => {
    const pred = assertion.subject().asPredicate();
    return pred && pred.digest().equals(predicateDigest);
  });
};

/// Implementation of assertionWithPredicate()
Envelope.prototype.assertionWithPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope {
  const matches = this.assertionsWithPredicate(predicate);

  if (matches.length === 0) {
    throw EnvelopeError.nonexistentPredicate();
  }
  if (matches.length > 1) {
    throw EnvelopeError.ambiguousPredicate();
  }

  return matches[0]!;
};

/// Implementation of optionalAssertionWithPredicate()
Envelope.prototype.optionalAssertionWithPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope | undefined {
  const matches = this.assertionsWithPredicate(predicate);

  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length > 1) {
    throw EnvelopeError.ambiguousPredicate();
  }

  return matches[0]!;
};

/// Implementation of objectForPredicate()
Envelope.prototype.objectForPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope {
  const assertion = this.assertionWithPredicate(predicate);
  const obj = assertion.asObject();
  if (!obj) {
    throw EnvelopeError.notAssertion();
  }
  return obj;
};

/// Implementation of optionalObjectForPredicate()
Envelope.prototype.optionalObjectForPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope | undefined {
  const matches = this.assertionsWithPredicate(predicate);

  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length > 1) {
    throw EnvelopeError.ambiguousPredicate();
  }

  const obj = matches[0]!.subject().asObject();
  return obj;
};

/// Implementation of objectsForPredicate()
Envelope.prototype.objectsForPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope[] {
  return this.assertionsWithPredicate(predicate).map((assertion) => {
    const obj = assertion.asObject();
    if (!obj) {
      throw EnvelopeError.notAssertion();
    }
    return obj;
  });
};

/// Implementation of elementsCount()
Envelope.prototype.elementsCount = function (this: Envelope): number {
  let count = 1; // Count this envelope

  const c = this.case();
  switch (c.type) {
    case "node":
      count += c.subject.elementsCount();
      for (const assertion of c.assertions) {
        count += assertion.elementsCount();
      }
      break;
    case "assertion":
      count += c.assertion.predicate().elementsCount();
      count += c.assertion.object().elementsCount();
      break;
    case "wrapped":
      count += c.envelope.elementsCount();
      break;
  }

  return count;
};
