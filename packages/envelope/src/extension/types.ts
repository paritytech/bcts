/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { type EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { IS_A } from "@bcts/known-values";

/// Type system for Gordian Envelopes.
///
/// This module provides functionality for adding, querying, and verifying types
/// within envelopes. In Gordian Envelope, types are implemented using the
/// special `'isA'` KnownValue predicate (value 1), which is semantically
/// equivalent to the RDF `rdf:type` concept.
///
/// Type information enables:
/// - Semantic classification of envelopes
/// - Type verification before processing content
/// - Conversion between domain objects and envelopes
/// - Schema validation
///
/// ## Type Representation
///
/// Types are represented as assertions with the `'isA'` predicate and an object
/// that specifies the type. The type object is typically a string or an envelope.
///
/// ## Usage Patterns
///
/// The type system is commonly used in two ways:
///
/// 1. **Type Tagging**: Adding type information to envelopes to indicate their
///    semantic meaning
///
///    ```typescript
///    // Create an envelope representing a person
///    const person = Envelope.new("Alice")
///      .addType("Person")
///      .addAssertion("age", 30);
///    ```
///
/// 2. **Type Checking**: Verifying that an envelope has the expected type
///    before processing
///
///    ```typescript
///    function processPerson(envelope: Envelope): void {
///      // Verify this is a person before processing
///      envelope.checkType("Person");
///
///      // Now we can safely extract person-specific information
///      const name = envelope.subject().extractString();
///      const age = envelope.objectForPredicate("age").extractNumber();
///
///      console.log(`${name} is ${age} years old`);
///    }
///    ```

/// Implementation of addType()
// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
  Envelope.prototype.addType = function (this: Envelope, object: EnvelopeEncodableValue): Envelope {
    return this.addAssertion(IS_A, object);
  };

  /// Implementation of types()
  Envelope.prototype.types = function (this: Envelope): Envelope[] {
    return this.objectsForPredicate(IS_A);
  };

  /// Implementation of getType()
  Envelope.prototype.getType = function (this: Envelope): Envelope {
    const t = this.types();
    if (t.length === 0) {
      throw EnvelopeError.invalidType();
    }
    if (t.length === 1) {
      return t[0];
    }
    throw EnvelopeError.ambiguousType();
  };

  /// Implementation of hasType()
  Envelope.prototype.hasType = function (this: Envelope, t: EnvelopeEncodableValue): boolean {
    const e = Envelope.new(t);
    return this.types().some((x) => x.digest().equals(e.digest()));
  };

  /// Implementation of checkType()
  Envelope.prototype.checkType = function (this: Envelope, t: EnvelopeEncodableValue): void {
    if (!this.hasType(t)) {
      throw EnvelopeError.invalidType();
    }
  };
}
