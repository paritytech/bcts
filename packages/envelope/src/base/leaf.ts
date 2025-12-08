import type { Cbor, CborMap } from "@blockchain-commons/dcbor";
import { isNumber, isNaN, asArray, asMap, asText } from "@blockchain-commons/dcbor";
import { Envelope } from "./envelope";

/// Provides methods for working with envelope leaf nodes,
/// which are dCBOR values of any kind.
///
/// This module extends the Envelope class with convenience methods for
/// working with leaf values, including type checking and extraction.

declare module "./envelope" {
  interface Envelope {
    /// Checks if this envelope contains false.
    ///
    /// @returns `true` if the envelope's subject is false, `false` otherwise
    isFalse(): boolean;

    /// Checks if this envelope contains true.
    ///
    /// @returns `true` if the envelope's subject is true, `false` otherwise
    isTrue(): boolean;

    /// Checks if this envelope contains a boolean value.
    ///
    /// @returns `true` if the envelope's subject is a boolean, `false`
    ///   otherwise
    isBool(): boolean;

    /// Checks if this envelope is a leaf node that contains a number.
    ///
    /// @returns `true` if the envelope is a leaf containing a number, `false`
    ///   otherwise
    isNumber(): boolean;

    /// Checks if the subject of this envelope is a number.
    ///
    /// @returns `true` if the subject is a number, `false` otherwise
    isSubjectNumber(): boolean;

    /// Checks if this envelope is a leaf node that contains NaN.
    ///
    /// @returns `true` if the envelope is a leaf containing NaN, `false`
    ///   otherwise
    isNaN(): boolean;

    /// Checks if the subject of this envelope is NaN.
    ///
    /// @returns `true` if the subject is NaN, `false` otherwise
    isSubjectNaN(): boolean;

    /// Checks if this envelope contains null.
    ///
    /// @returns `true` if the envelope's subject is null, `false` otherwise
    isNull(): boolean;

    /// Attempts to extract the leaf CBOR as a byte string.
    ///
    /// @returns The byte string value
    /// @throws {EnvelopeError} If the envelope is not a leaf or not a byte
    ///   string
    tryByteString(): Uint8Array;

    /// Returns the leaf CBOR as a byte string if possible.
    ///
    /// @returns The byte string value or undefined
    asByteString(): Uint8Array | undefined;

    /// Returns the leaf CBOR as an array if possible.
    ///
    /// @returns The array value or undefined
    asArray(): Cbor[] | undefined;

    /// Returns the leaf CBOR as a map if possible.
    ///
    /// @returns The map value or undefined
    asMap(): CborMap | undefined;

    /// Returns the leaf CBOR as text if possible.
    ///
    /// @returns The text value or undefined
    asText(): string | undefined;

    /// Returns the leaf CBOR value if this envelope is a leaf.
    ///
    /// @returns The CBOR value or undefined
    asLeaf(): Cbor | undefined;
  }
}

// Note: Static methods Envelope.false() and Envelope.true() are implemented below
// but cannot be declared in TypeScript module augmentation due to reserved keywords.

/// Implementation of static false()
Envelope.false = function (): Envelope {
  return Envelope.newLeaf(false);
};

/// Implementation of static true()
Envelope.true = function (): Envelope {
  return Envelope.newLeaf(true);
};

/// Implementation of isFalse()
Envelope.prototype.isFalse = function (this: Envelope): boolean {
  try {
    return this.extractBoolean() === false;
  } catch {
    return false;
  }
};

/// Implementation of isTrue()
Envelope.prototype.isTrue = function (this: Envelope): boolean {
  try {
    return this.extractBoolean() === true;
  } catch {
    return false;
  }
};

/// Implementation of isBool()
Envelope.prototype.isBool = function (this: Envelope): boolean {
  try {
    const value = this.extractBoolean();
    return typeof value === "boolean";
  } catch {
    return false;
  }
};

/// Implementation of isNumber()
Envelope.prototype.isNumber = function (this: Envelope): boolean {
  const leaf = this.asLeaf();
  if (leaf === undefined) {
    return false;
  }

  return isNumber(leaf);
};

/// Implementation of isSubjectNumber()
Envelope.prototype.isSubjectNumber = function (this: Envelope): boolean {
  return this.subject().isNumber();
};

/// Implementation of isNaN()
Envelope.prototype.isNaN = function (this: Envelope): boolean {
  const leaf = this.asLeaf();
  if (leaf === undefined) {
    return false;
  }

  return isNaN(leaf);
};

/// Implementation of isSubjectNaN()
Envelope.prototype.isSubjectNaN = function (this: Envelope): boolean {
  return this.subject().isNaN();
};

/// Implementation of isNull()
Envelope.prototype.isNull = function (this: Envelope): boolean {
  try {
    this.extractNull();
    return true;
  } catch (_error) {
    return false;
  }
};

/// Implementation of tryByteString()
Envelope.prototype.tryByteString = function (this: Envelope): Uint8Array {
  return this.extractBytes();
};

/// Implementation of asByteString()
Envelope.prototype.asByteString = function (this: Envelope): Uint8Array | undefined {
  try {
    return this.extractBytes();
  } catch {
    return undefined;
  }
};

/// Implementation of asArray()
Envelope.prototype.asArray = function (this: Envelope): Cbor[] | undefined {
  const leaf = this.asLeaf();
  if (leaf === undefined) {
    return undefined;
  }

  return asArray(leaf);
};

/// Implementation of asMap()
Envelope.prototype.asMap = function (this: Envelope) {
  const leaf = this.asLeaf();
  if (leaf === undefined) {
    return undefined;
  }

  return asMap(leaf);
};

/// Implementation of asText()
Envelope.prototype.asText = function (this: Envelope): string | undefined {
  const leaf = this.asLeaf();
  if (leaf === undefined) {
    return undefined;
  }

  return asText(leaf);
};

/// Implementation of asLeaf()
Envelope.prototype.asLeaf = function (this: Envelope): Cbor | undefined {
  const c = this.case();
  if (c.type === "leaf") {
    return c.cbor;
  }
  return undefined;
};
