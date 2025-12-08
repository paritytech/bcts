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

declare module "./envelope" {
  interface Envelope {
    /// Returns a new envelope with multiple assertion envelopes added.
    ///
    /// This is a convenience method for adding multiple assertions at once.
    /// Each assertion in the array must be a valid assertion envelope or an
    /// obscured variant of one.
    ///
    /// @param assertions - An array of valid assertion envelopes to add
    /// @returns A new envelope with all the assertions added
    /// @throws {EnvelopeError} If any of the provided envelopes are not valid
    ///   assertion envelopes
    addAssertionEnvelopes(assertions: Envelope[]): Envelope;

    /// Adds an optional assertion envelope to this envelope.
    ///
    /// If the optional assertion is present, adds it to the envelope.
    /// Otherwise, returns the envelope unchanged. This method is particularly
    /// useful when working with functions that may or may not return an
    /// assertion.
    ///
    /// The method also ensures that duplicate assertions (with the same digest)
    /// are not added, making it idempotent.
    ///
    /// @param assertion - An optional assertion envelope to add
    /// @returns A new envelope with the assertion added if provided, or the
    ///   original envelope if no assertion was provided or it was a duplicate
    /// @throws {EnvelopeError} If the provided envelope is not a valid assertion
    ///   envelope or an obscured variant
    addOptionalAssertionEnvelope(assertion: Envelope | undefined): Envelope;

    /// Adds an assertion with the given predicate and optional object.
    ///
    /// This method is useful when you have a predicate but may or may not have
    /// an object value to associate with it. If the object is present, an
    /// assertion is created and added to the envelope. Otherwise, the
    /// envelope is returned unchanged.
    ///
    /// @param predicate - The predicate for the assertion
    /// @param object - An optional object value for the assertion
    /// @returns A new envelope with the assertion added if the object was
    ///   provided, or the original envelope if no object was provided
    addOptionalAssertion(
      predicate: EnvelopeEncodableValue,
      object: EnvelopeEncodableValue | undefined,
    ): Envelope;

    /// Adds an assertion with the given predicate and string value, but only if
    /// the string is non-empty.
    ///
    /// This is a convenience method that only adds an assertion if the string
    /// value is non-empty. It's particularly useful when working with user
    /// input or optional text fields that should only be included if they
    /// contain actual content.
    ///
    /// @param predicate - The predicate for the assertion
    /// @param str - The string value for the assertion
    /// @returns A new envelope with the assertion added if the string is
    ///   non-empty, or the original envelope if the string is empty
    addNonemptyStringAssertion(predicate: EnvelopeEncodableValue, str: string): Envelope;

    /// Returns a new envelope with the given array of assertions added.
    ///
    /// Similar to `addAssertionEnvelopes` but doesn't throw errors. This is
    /// useful when you're certain all envelopes in the array are valid
    /// assertion envelopes and don't need to handle errors.
    ///
    /// @param envelopes - An array of assertion envelopes to add
    /// @returns A new envelope with all the valid assertions added
    addAssertions(envelopes: Envelope[]): Envelope;

    /// Adds an assertion only if the provided condition is true.
    ///
    /// This method allows for conditional inclusion of assertions based on a
    /// boolean condition. It's a convenient way to add assertions only in
    /// certain circumstances without requiring separate conditional logic.
    ///
    /// @param condition - Boolean that determines whether to add the assertion
    /// @param predicate - The predicate for the assertion
    /// @param object - The object value for the assertion
    /// @returns A new envelope with the assertion added if the condition is
    ///   true, or the original envelope if the condition is false
    addAssertionIf(
      condition: boolean,
      predicate: EnvelopeEncodableValue,
      object: EnvelopeEncodableValue,
    ): Envelope;

    /// Adds an assertion envelope only if the provided condition is true.
    ///
    /// Similar to `addAssertionIf` but works with pre-constructed assertion
    /// envelopes. This is useful when you have already created an assertion
    /// envelope separately and want to conditionally add it.
    ///
    /// @param condition - Boolean that determines whether to add the assertion
    ///   envelope
    /// @param assertionEnvelope - The assertion envelope to add
    /// @returns A new envelope with the assertion added if the condition is
    ///   true, or the original envelope if the condition is false
    /// @throws {EnvelopeError} If the provided envelope is not a valid assertion
    ///   envelope or an obscured variant and the condition is true
    addAssertionEnvelopeIf(condition: boolean, assertionEnvelope: Envelope): Envelope;

    /// Returns a new envelope with the given assertion removed.
    ///
    /// Finds and removes an assertion matching the target assertion's digest.
    /// If the assertion doesn't exist, returns the same envelope unchanged.
    /// If removing the assertion would leave the envelope with no assertions,
    /// returns just the subject as a new envelope.
    ///
    /// @param target - The assertion envelope to remove
    /// @returns A new envelope with the specified assertion removed if found,
    ///   or the original envelope if not found
    removeAssertion(target: Envelope): Envelope;

    /// Returns a new envelope with the given assertion replaced by a new one.
    ///
    /// This method removes the specified assertion and adds a new one in its
    /// place. If the targeted assertion does not exist, returns the same
    /// envelope with the new assertion added.
    ///
    /// @param assertion - The assertion envelope to replace
    /// @param newAssertion - The new assertion envelope to add
    /// @returns A new envelope with the assertion replaced if found, or the
    ///   original envelope with the new assertion added if not found
    /// @throws {EnvelopeError} If the new assertion is not a valid assertion
    ///   envelope or an obscured variant
    replaceAssertion(assertion: Envelope, newAssertion: Envelope): Envelope;

    /// Returns a new envelope with its subject replaced by the provided one.
    ///
    /// This method preserves all assertions from the original envelope but
    /// applies them to a new subject. It effectively creates a new envelope
    /// with the provided subject and copies over all assertions from the
    /// current envelope.
    ///
    /// @param subject - The new subject for the envelope
    /// @returns A new envelope with the new subject and all assertions from the
    ///   original envelope
    replaceSubject(subject: Envelope): Envelope;

    /// Returns the assertions of this envelope.
    ///
    /// For a node envelope, returns the array of assertion envelopes.
    /// For all other envelope types, returns an empty array.
    ///
    /// @returns An array of assertion envelopes
    assertions(): Envelope[];
  }
}

/// Implementation of addAssertionEnvelopes
Envelope.prototype.addAssertionEnvelopes = function (
  this: Envelope,
  assertions: Envelope[],
): Envelope {
  let result = this;
  for (const assertion of assertions) {
    result = result.addAssertionEnvelope(assertion);
  }
  return result;
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
  let result = this;
  for (const envelope of envelopes) {
    result = result.addAssertionEnvelope(envelope);
  }
  return result;
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
