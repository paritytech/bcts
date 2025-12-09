import { Envelope } from "../base/envelope";
import { EnvelopeError } from "../base/error";

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

/// The standard predicate for salt assertions
export const SALT = "salt";

/// Minimum salt size in bytes (64 bits)
const MIN_SALT_SIZE = 8;

/// Default salt size range
const DEFAULT_SALT_RANGE = { min: 8, max: 16 };

/// Generates random bytes using crypto
function generateRandomBytes(length: number): Uint8Array {
  // Use Web Crypto API available in browsers and Node.js 19+
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }).crypto;

  if (cryptoObj?.getRandomValues !== undefined) {
    const array = new Uint8Array(length);
    cryptoObj.getRandomValues(array);
    return array;
  }

  throw new Error(
    "Web Crypto API not available. " +
      "Please use a modern browser or Node.js 19+ which includes global crypto support.",
  );
}

/// Calculates salt size proportional to envelope size
function calculateProportionalSaltSize(envelopeSize: number): number {
  // For small envelopes: 8-16 bytes
  // For larger envelopes: 5-25% of the envelope's size
  const minSize = DEFAULT_SALT_RANGE.min;
  const maxSize = DEFAULT_SALT_RANGE.max;

  if (envelopeSize <= 100) {
    return minSize + Math.floor(Math.random() * (maxSize - minSize + 1));
  }

  const proportional = Math.floor(envelopeSize * (0.05 + Math.random() * 0.2));
  return Math.max(minSize, Math.min(proportional, 1024)); // Cap at 1KB
}

declare module "../base/envelope" {
  interface Envelope {
    /// Adds a proportionally-sized salt assertion to decorrelate the envelope.
    ///
    /// This method adds random salt bytes as an assertion to the envelope. The
    /// size of the salt is proportional to the size of the envelope being
    /// salted:
    /// - For small envelopes: 8-16 bytes
    /// - For larger envelopes: 5-25% of the envelope's size
    ///
    /// Salt is added as an assertion with the predicate 'salt' and an object
    /// containing random bytes. This changes the digest of the envelope while
    /// preserving its semantic content, making it impossible to correlate with
    /// other envelopes containing the same information.
    ///
    /// @returns A new envelope with the salt assertion added
    ///
    /// @example
    /// ```typescript
    /// // Create an envelope with personally identifiable information
    /// const alice = Envelope.new("Alice")
    ///   .addAssertion("email", "alice@example.com")
    ///   .addAssertion("ssn", "123-45-6789");
    ///
    /// // Create a second envelope with the same information
    /// const alice2 = Envelope.new("Alice")
    ///   .addAssertion("email", "alice@example.com")
    ///   .addAssertion("ssn", "123-45-6789");
    ///
    /// // The envelopes have the same digest
    /// console.log(alice.digest().equals(alice2.digest())); // true
    ///
    /// // Add salt to both envelopes
    /// const aliceSalted = alice.addSalt();
    /// const alice2Salted = alice2.addSalt();
    ///
    /// // Now the envelopes have different digests, preventing correlation
    /// console.log(aliceSalted.digest().equals(alice2Salted.digest())); // false
    /// ```
    addSalt(): Envelope;

    /// Adds salt of a specific byte length to the envelope.
    ///
    /// This method adds salt of a specified number of bytes to decorrelate the
    /// envelope. It requires that the byte count be at least 8 bytes (64 bits)
    /// to ensure sufficient entropy for effective decorrelation.
    ///
    /// @param count - The exact number of salt bytes to add
    /// @returns A new envelope with salt added
    /// @throws {EnvelopeError} If the byte count is less than 8
    ///
    /// @example
    /// ```typescript
    /// const envelope = Envelope.new("Hello");
    ///
    /// // Add exactly 16 bytes of salt
    /// const salted = envelope.addSaltWithLength(16);
    ///
    /// // Trying to add less than 8 bytes will throw an error
    /// try {
    ///   envelope.addSaltWithLength(7);
    /// } catch (e) {
    ///   console.log("Error: salt must be at least 8 bytes");
    /// }
    /// ```
    addSaltWithLength(count: number): Envelope;

    /// Adds the given salt bytes as an assertion to the envelope.
    ///
    /// This method attaches specific salt bytes as an assertion to the
    /// envelope, using 'salt' as the predicate. This is useful when you need
    /// to control the specific salt content being added.
    ///
    /// @param saltBytes - A Uint8Array containing salt bytes
    /// @returns A new envelope with the salt assertion added
    ///
    /// @example
    /// ```typescript
    /// // Create salt with specific bytes
    /// const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    ///
    /// // Add this specific salt to an envelope
    /// const envelope = Envelope.new("Hello");
    /// const salted = envelope.addSaltBytes(salt);
    /// ```
    addSaltBytes(saltBytes: Uint8Array): Envelope;

    /// Adds salt with a byte length randomly chosen from the given range.
    ///
    /// This method adds salt with a length randomly selected from the specified
    /// range to decorrelate the envelope. This provides additional
    /// decorrelation by varying the size of the salt itself.
    ///
    /// @param min - Minimum number of salt bytes (must be at least 8)
    /// @param max - Maximum number of salt bytes
    /// @returns A new envelope with salt added
    /// @throws {EnvelopeError} If min is less than 8 or max is less than min
    ///
    /// @example
    /// ```typescript
    /// const envelope = Envelope.new("Hello");
    ///
    /// // Add salt with a length randomly chosen between 16 and 32 bytes
    /// const salted = envelope.addSaltInRange(16, 32);
    /// ```
    addSaltInRange(min: number, max: number): Envelope;
  }
}

/// Implementation of addSalt()
Envelope.prototype.addSalt = function (this: Envelope): Envelope {
  const envelopeSize = this.cborBytes().length;
  const saltSize = calculateProportionalSaltSize(envelopeSize);
  const saltBytes = generateRandomBytes(saltSize);
  return this.addAssertion(SALT, saltBytes);
};

/// Implementation of addSaltWithLength()
Envelope.prototype.addSaltWithLength = function (this: Envelope, count: number): Envelope {
  if (count < MIN_SALT_SIZE) {
    throw EnvelopeError.general(`Salt must be at least ${MIN_SALT_SIZE} bytes, got ${count}`);
  }
  const saltBytes = generateRandomBytes(count);
  return this.addAssertion(SALT, saltBytes);
};

/// Implementation of addSaltBytes()
Envelope.prototype.addSaltBytes = function (this: Envelope, saltBytes: Uint8Array): Envelope {
  if (saltBytes.length < MIN_SALT_SIZE) {
    throw EnvelopeError.general(
      `Salt must be at least ${MIN_SALT_SIZE} bytes, got ${saltBytes.length}`,
    );
  }
  return this.addAssertion(SALT, saltBytes);
};

/// Implementation of addSaltInRange()
Envelope.prototype.addSaltInRange = function (this: Envelope, min: number, max: number): Envelope {
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
  const saltSize = min + Math.floor(Math.random() * (max - min + 1));
  const saltBytes = generateRandomBytes(saltSize);
  return this.addAssertion(SALT, saltBytes);
};
