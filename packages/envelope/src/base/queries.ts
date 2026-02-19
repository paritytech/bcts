/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Cbor type available if needed later
import { Envelope } from "./envelope";
import type { EnvelopeEncodableValue } from "./envelope-encodable";
import { EnvelopeError } from "./error";
import { POSITION } from "@bcts/known-values";

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
  if (result === undefined) {
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
  if (result === undefined) {
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
  if (result === undefined) {
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
    return pred?.digest().equals(predicateDigest) === true;
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

  return matches[0];
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

  return matches[0];
};

/// Implementation of objectForPredicate()
Envelope.prototype.objectForPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope {
  const assertion = this.assertionWithPredicate(predicate);
  const obj = assertion.asObject();
  if (obj === undefined) {
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

  const obj = matches[0].subject().asObject();
  return obj;
};

/// Implementation of objectsForPredicate()
Envelope.prototype.objectsForPredicate = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
): Envelope[] {
  return this.assertionsWithPredicate(predicate).map((assertion) => {
    const obj = assertion.asObject();
    if (obj === undefined) {
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
    case "leaf":
    case "elided":
    case "knownValue":
    case "encrypted":
    case "compressed":
      // These cases don't contribute additional elements
      break;
  }

  return count;
};

// ============================================================================
// Subject State Queries
// ============================================================================

/// Implementation of isSubjectEncrypted()
Envelope.prototype.isSubjectEncrypted = function (this: Envelope): boolean {
  const c = this.case();
  if (c.type === "encrypted") {
    return true;
  }
  if (c.type === "node") {
    return c.subject.isSubjectEncrypted();
  }
  return false;
};

/// Implementation of isSubjectCompressed()
Envelope.prototype.isSubjectCompressed = function (this: Envelope): boolean {
  const c = this.case();
  if (c.type === "compressed") {
    return true;
  }
  if (c.type === "node") {
    return c.subject.isSubjectCompressed();
  }
  return false;
};

/// Implementation of isSubjectElided()
Envelope.prototype.isSubjectElided = function (this: Envelope): boolean {
  const c = this.case();
  if (c.type === "elided") {
    return true;
  }
  if (c.type === "node") {
    return c.subject.isSubjectElided();
  }
  return false;
};

// ============================================================================
// Position Management
// ============================================================================

/// Implementation of setPosition()
Envelope.prototype.setPosition = function (this: Envelope, position: number): Envelope {
  // Find all POSITION assertions
  const positionAssertions = this.assertionsWithPredicate(POSITION);

  // If there is more than one POSITION assertion, throw an error
  if (positionAssertions.length > 1) {
    throw EnvelopeError.invalidFormat();
  }

  // If there is a single POSITION assertion, remove it and add the new position
  // Otherwise, just add the new position to this envelope
  const baseEnvelope =
    positionAssertions.length === 1 ? this.removeAssertion(positionAssertions[0]) : this;

  // Add a new POSITION assertion with the given position
  return baseEnvelope.addAssertion(POSITION, position);
};

/// Implementation of position()
Envelope.prototype.position = function (this: Envelope): number {
  // Find the POSITION assertion in the envelope
  const positionEnvelope = this.objectForPredicate(POSITION);

  // Extract the position value
  const positionValue = positionEnvelope.extractNumber();
  return positionValue;
};

/// Implementation of removePosition()
Envelope.prototype.removePosition = function (this: Envelope): Envelope {
  // Find all POSITION assertions
  const positionAssertions = this.assertionsWithPredicate(POSITION);

  // If there is more than one POSITION assertion, throw an error
  if (positionAssertions.length > 1) {
    throw EnvelopeError.invalidFormat();
  }

  // If there is a single POSITION assertion, remove it
  if (positionAssertions.length === 1) {
    return this.removeAssertion(positionAssertions[0]);
  }

  // No POSITION assertion, return unchanged
  return this;
};
