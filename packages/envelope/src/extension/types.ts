/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Type system for Gordian Envelopes.
 *
 * Mirrors `bc-envelope-rust/src/extension/types.rs`. Types are represented as
 * `'isA'` (KnownValue 1) assertions, with the object specifying the type. The
 * type object is typically a string, an envelope, or a registered KnownValue.
 *
 * @example
 * ```typescript
 * // Tag with a string type
 * const person = Envelope.new("Alice")
 *   .addType("Person")
 *   .addAssertion("age", 30);
 *
 * // Tag with a KnownValue (e.g. the SEED_TYPE registry entry)
 * const seed = Envelope.new(seedData).addType(SEED_TYPE);
 * if (seed.hasTypeValue(SEED_TYPE)) { ... }
 * ```
 */

import { Envelope } from "../base/envelope";
import { type EnvelopeEncodableValue } from "../base/envelope-encodable";
import { EnvelopeError } from "../base/error";
import { IS_A } from "@bcts/known-values";
import type { KnownValue } from "@bcts/known-values";

// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
  /// Implementation of addType()
  Envelope.prototype.addType = function (this: Envelope, object: EnvelopeEncodableValue): Envelope {
    return this.addAssertion(IS_A, object);
  };

  /// Implementation of types()
  Envelope.prototype.types = function (this: Envelope): Envelope[] {
    return this.objectsForPredicate(IS_A);
  };

  /// Implementation of getType()
  ///
  /// Mirrors Rust `Envelope::get_type`
  /// (`bc-envelope-rust/src/extension/types.rs:209-216`):
  /// returns the single type if there is exactly one, otherwise raises
  /// `Error::AmbiguousType`. Earlier revisions of this port returned
  /// `InvalidType` when the count was 0 — Rust uses the same
  /// `AmbiguousType` variant for both 0 and >1 cases.
  Envelope.prototype.getType = function (this: Envelope): Envelope {
    const t = this.types();
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

  /// Implementation of hasTypeValue()
  ///
  /// Mirrors Rust `Envelope::has_type_value`
  /// (`bc-envelope-rust/src/extension/types.rs:280-285`).
  /// Specialised counterpart to {@link Envelope.hasType} for checking
  /// against registered KnownValue types (e.g. `SEED_TYPE`).
  Envelope.prototype.hasTypeValue = function (this: Envelope, t: KnownValue): boolean {
    const typeEnvelope = Envelope.newWithKnownValue(t);
    return this.types().some((x) => x.digest().equals(typeEnvelope.digest()));
  };

  /// Implementation of checkTypeValue()
  ///
  /// Mirrors Rust `Envelope::check_type_value`
  /// (`bc-envelope-rust/src/extension/types.rs:332-338`).
  /// Throws {@link EnvelopeError.invalidType} if the envelope does not
  /// carry the supplied KnownValue as its type.
  Envelope.prototype.checkTypeValue = function (this: Envelope, t: KnownValue): void {
    if (!this.hasTypeValue(t)) {
      throw EnvelopeError.invalidType();
    }
  };
}
