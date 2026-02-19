/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Envelope } from "./envelope";
import type { EnvelopeEncodableValue } from "./envelope-encodable";
import { EnvelopeError } from "./error";

/// Support for adding assertions.
///
/// Assertions are predicate-object pairs that make statements about an
/// envelope's subject. This implementation provides methods for adding various
/// types of assertions to envelopes.
///
/// These methods extend the Envelope class to provide a rich API for
/// working with assertions, matching the Rust bc-envelope implementation.

/// Implementation of addAssertionEnvelopes
Envelope.prototype.addAssertionEnvelopes = function (
  this: Envelope,
  assertions: Envelope[],
): Envelope {
  return assertions.reduce((result, assertion) => result.addAssertionEnvelope(assertion), this);
};

/// Implementation of addOptionalAssertionEnvelope
Envelope.prototype.addOptionalAssertionEnvelope = function (
  this: Envelope,
  assertion: Envelope | undefined,
): Envelope {
  if (assertion === undefined) {
    return this;
  }

  // Validate that the assertion is a valid assertion or obscured envelope
  if (!assertion.isSubjectAssertion() && !assertion.isSubjectObscured()) {
    throw EnvelopeError.invalidFormat();
  }

  const c = this.case();

  // Check if this is already a node
  if (c.type === "node") {
    // Check for duplicate assertions
    const isDuplicate = c.assertions.some((a) => a.digest().equals(assertion.digest()));
    if (isDuplicate) {
      return this;
    }

    // Add the new assertion
    return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, assertion]);
  }

  // Otherwise, create a new node with this envelope as subject
  return Envelope.newWithUncheckedAssertions(this.subject(), [assertion]);
};

/// Implementation of addOptionalAssertion
Envelope.prototype.addOptionalAssertion = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
  object: EnvelopeEncodableValue | undefined,
): Envelope {
  if (object === undefined || object === null) {
    return this;
  }
  return this.addAssertion(predicate, object);
};

/// Implementation of addNonemptyStringAssertion
Envelope.prototype.addNonemptyStringAssertion = function (
  this: Envelope,
  predicate: EnvelopeEncodableValue,
  str: string,
): Envelope {
  if (str.length === 0) {
    return this;
  }
  return this.addAssertion(predicate, str);
};

/// Implementation of addAssertions
Envelope.prototype.addAssertions = function (this: Envelope, envelopes: Envelope[]): Envelope {
  return envelopes.reduce((result, envelope) => result.addAssertionEnvelope(envelope), this);
};

/// Implementation of addAssertionIf
Envelope.prototype.addAssertionIf = function (
  this: Envelope,
  condition: boolean,
  predicate: EnvelopeEncodableValue,
  object: EnvelopeEncodableValue,
): Envelope {
  if (condition) {
    return this.addAssertion(predicate, object);
  }
  return this;
};

/// Implementation of addAssertionEnvelopeIf
Envelope.prototype.addAssertionEnvelopeIf = function (
  this: Envelope,
  condition: boolean,
  assertionEnvelope: Envelope,
): Envelope {
  if (condition) {
    return this.addAssertionEnvelope(assertionEnvelope);
  }
  return this;
};

/// Implementation of removeAssertion
Envelope.prototype.removeAssertion = function (this: Envelope, target: Envelope): Envelope {
  const assertions = this.assertions();
  const targetDigest = target.digest();

  const index = assertions.findIndex((a) => a.digest().equals(targetDigest));

  if (index === -1) {
    // Assertion not found, return unchanged
    return this;
  }

  // Remove the assertion
  const newAssertions = [...assertions.slice(0, index), ...assertions.slice(index + 1)];

  if (newAssertions.length === 0) {
    // No assertions left, return just the subject
    return this.subject();
  }

  // Return envelope with remaining assertions
  return Envelope.newWithUncheckedAssertions(this.subject(), newAssertions);
};

/// Implementation of replaceAssertion
Envelope.prototype.replaceAssertion = function (
  this: Envelope,
  assertion: Envelope,
  newAssertion: Envelope,
): Envelope {
  return this.removeAssertion(assertion).addAssertionEnvelope(newAssertion);
};

/// Implementation of replaceSubject
Envelope.prototype.replaceSubject = function (this: Envelope, subject: Envelope): Envelope {
  return this.assertions().reduce((e, a) => e.addAssertionEnvelope(a), subject);
};

/// Implementation of assertions
Envelope.prototype.assertions = function (this: Envelope): Envelope[] {
  const c = this.case();
  if (c.type === "node") {
    return c.assertions;
  }
  return [];
};

// Note: addAssertionSalted, addAssertionEnvelopeSalted, and addOptionalAssertionEnvelopeSalted
// are implemented in extension/salt.ts to keep all salt-related functionality together.
