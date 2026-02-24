/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";
import type { EnvelopeEncodableValue } from "../base/envelope-encodable";
import {
  SecureRandomNumberGenerator,
  rngRandomData,
  rngNextInClosedRangeI32,
  type RandomNumberGenerator,
} from "@bcts/rand";
import { SALT as SALT_KV } from "@bcts/known-values";
import { Salt as SaltComponent } from "@bcts/components";

/// Extension for adding salt to envelopes to prevent correlation.
///
/// This module provides functionality for decorrelating envelopes by adding
/// random salt. Salt is added as an assertion with the predicate 'salt' and
/// a random value. When an envelope is elided, this salt ensures that the
/// digest of the elided envelope cannot be correlated with other elided
/// envelopes containing the same information.
///
/// Decorrelation is an important privacy feature that prevents third parties
/// from determining whether two elided envelopes originally contained the same
/// information by comparing their digests.
///
/// Based on bc-envelope-rust/src/extension/salt.rs and bc-components-rust/src/salt.rs
///
/// @example
/// ```typescript
/// // Create a simple envelope
/// const envelope = Envelope.new("Hello");
///
/// // Create a decorrelated version by adding salt
/// const salted = envelope.addSalt();
///
/// // The salted envelope has a different digest than the original
/// console.log(envelope.digest().equals(salted.digest())); // false
/// ```

// ============================================================================
// Envelope Prototype Extensions for Salted Assertions
// ============================================================================

/// The standard predicate for salt assertions (KnownValue matching Rust)
export const SALT = SALT_KV;

/// Minimum salt size in bytes (64 bits)
const MIN_SALT_SIZE = 8;

/// Creates a new SecureRandomNumberGenerator instance
function createSecureRng(): RandomNumberGenerator {
  return new SecureRandomNumberGenerator();
}

/// Generates random bytes using the rand package
function generateRandomBytes(length: number, rng?: RandomNumberGenerator): Uint8Array {
  const actualRng = rng ?? createSecureRng();
  return rngRandomData(actualRng, length);
}

/// Calculates salt size proportional to envelope size
/// This matches the Rust implementation in bc-components-rust/src/salt.rs
function calculateProportionalSaltSize(envelopeSize: number, rng?: RandomNumberGenerator): number {
  const actualRng = rng ?? createSecureRng();
  const count = envelopeSize;
  const minSize = Math.max(8, Math.ceil(count * 0.05));
  const maxSize = Math.max(minSize + 8, Math.ceil(count * 0.25));
  return rngNextInClosedRangeI32(actualRng, minSize, maxSize);
}

/// Implementation of addSalt()
// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
if (Envelope?.prototype) {
  Envelope.prototype.addSalt = function (this: Envelope): Envelope {
    const rng = createSecureRng();
    const envelopeSize = this.cborBytes().length;
    const saltSize = calculateProportionalSaltSize(envelopeSize, rng);
    const saltBytes = generateRandomBytes(saltSize, rng);
    return this.addAssertion(SALT, SaltComponent.fromData(saltBytes));
  };

  /// Implementation of addSaltWithLength()
  Envelope.prototype.addSaltWithLength = function (this: Envelope, count: number): Envelope {
    if (count < MIN_SALT_SIZE) {
      throw EnvelopeError.general(`Salt must be at least ${MIN_SALT_SIZE} bytes, got ${count}`);
    }
    const saltBytes = generateRandomBytes(count);
    return this.addAssertion(SALT, SaltComponent.fromData(saltBytes));
  };

  /// Alias for addSaltWithLength (Rust API compatibility)
  Envelope.prototype.addSaltWithLen = Envelope.prototype.addSaltWithLength;

  /// Implementation of addSaltBytes()
  Envelope.prototype.addSaltBytes = function (this: Envelope, saltBytes: Uint8Array): Envelope {
    if (saltBytes.length < MIN_SALT_SIZE) {
      throw EnvelopeError.general(
        `Salt must be at least ${MIN_SALT_SIZE} bytes, got ${saltBytes.length}`,
      );
    }
    return this.addAssertion(SALT, SaltComponent.fromData(saltBytes));
  };

  /// Implementation of addSaltInRange()
  Envelope.prototype.addSaltInRange = function (
    this: Envelope,
    min: number,
    max: number,
  ): Envelope {
    if (min < MIN_SALT_SIZE) {
      throw EnvelopeError.general(
        `Minimum salt size must be at least ${MIN_SALT_SIZE} bytes, got ${min}`,
      );
    }
    if (max < min) {
      throw EnvelopeError.general(
        `Maximum salt size must be at least minimum, got min=${min} max=${max}`,
      );
    }
    const rng = createSecureRng();
    const saltSize = rngNextInClosedRangeI32(rng, min, max);
    const saltBytes = generateRandomBytes(saltSize, rng);
    return this.addAssertion(SALT, SaltComponent.fromData(saltBytes));
  };

  /// Implementation of addAssertionSalted()
  Envelope.prototype.addAssertionSalted = function (
    this: Envelope,
    predicate: EnvelopeEncodableValue,
    object: EnvelopeEncodableValue,
    salted: boolean,
  ): Envelope {
    // Create the assertion envelope
    const assertion = Envelope.newAssertion(predicate, object);

    // If not salted, use the normal addAssertionEnvelope
    if (!salted) {
      return this.addAssertionEnvelope(assertion);
    }

    // Add salt to the assertion envelope (this creates a node with assertion as subject)
    const saltedAssertion = assertion.addSalt();

    // When salted, we need to use newWithUncheckedAssertions because the salted
    // assertion is a node (not pure assertion type) and would fail normal validation
    const c = this.case();
    if (c.type === "node") {
      return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, saltedAssertion]);
    }
    return Envelope.newWithUncheckedAssertions(this, [saltedAssertion]);
  };

  /// Implementation of addAssertionEnvelopeSalted()
  Envelope.prototype.addAssertionEnvelopeSalted = function (
    this: Envelope,
    assertionEnvelope: Envelope,
    salted: boolean,
  ): Envelope {
    // If not salted, use the normal addAssertionEnvelope
    if (!salted) {
      return this.addAssertionEnvelope(assertionEnvelope);
    }

    // Add salt to the assertion envelope (this creates a node with assertion as subject)
    const saltedAssertion = assertionEnvelope.addSalt();

    // When salted, we need to use newWithUncheckedAssertions because the salted
    // assertion is a node (not pure assertion type) and would fail normal validation
    const c = this.case();
    if (c.type === "node") {
      return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, saltedAssertion]);
    }
    return Envelope.newWithUncheckedAssertions(this, [saltedAssertion]);
  };

  /// Implementation of addOptionalAssertionEnvelopeSalted()
  Envelope.prototype.addOptionalAssertionEnvelopeSalted = function (
    this: Envelope,
    assertionEnvelope: Envelope | undefined,
    salted: boolean,
  ): Envelope {
    if (assertionEnvelope === undefined) {
      return this;
    }

    // If not salted, use the normal addOptionalAssertionEnvelope
    if (!salted) {
      return this.addOptionalAssertionEnvelope(assertionEnvelope);
    }

    // Add salt to the assertion envelope (this creates a node with assertion as subject)
    const saltedAssertion = assertionEnvelope.addSalt();

    // When salted, we need to use newWithUncheckedAssertions because the salted
    // assertion is a node (not pure assertion type) and would fail normal validation
    const c = this.case();
    if (c.type === "node") {
      // Check for duplicate assertions
      const isDuplicate = c.assertions.some((a) => a.digest().equals(saltedAssertion.digest()));
      if (isDuplicate) {
        return this;
      }
      return Envelope.newWithUncheckedAssertions(c.subject, [...c.assertions, saltedAssertion]);
    }
    return Envelope.newWithUncheckedAssertions(this.subject(), [saltedAssertion]);
  };
}
