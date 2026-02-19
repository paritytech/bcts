/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import type { Cbor } from "@bcts/dcbor";
import { isNumber, isNaN, asArray, asMap, asText } from "@bcts/dcbor";
import type { KnownValue } from "@bcts/known-values";
import { UNIT } from "@bcts/known-values";
import { Envelope } from "./envelope";
import { EnvelopeError } from "./error";

/// Provides methods for working with envelope leaf nodes,
/// which are dCBOR values of any kind.
///
/// This module extends the Envelope class with convenience methods for
/// working with leaf values, including type checking and extraction.

// Note: Static methods Envelope.false() and Envelope.true() are implemented below
// but cannot be declared in TypeScript module augmentation due to reserved keywords.

/// Implementation of static false()
(Envelope as unknown as { false: () => Envelope }).false = function (): Envelope {
  return Envelope.newLeaf(false);
};

/// Implementation of static true()
(Envelope as unknown as { true: () => Envelope }).true = function (): Envelope {
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

  // Check for NaN in CBOR simple types
  if ("type" in leaf && leaf.type === 7) {
    return isNaN(leaf as unknown as Parameters<typeof isNaN>[0]);
  }
  return false;
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
Envelope.prototype.asArray = function (this: Envelope): readonly Cbor[] | undefined {
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

// ============================================================================
// Known Value Methods
// ============================================================================

/// Implementation of static unit()
/// Unit envelopes have the known value ''. They represent a position
/// where no meaningful data *can* exist. In this sense they make a
/// semantically stronger assertion than `null`, which represents a
/// position where no meaningful data currently exists, but could exist in
/// the future.
(Envelope as unknown as { unit: () => Envelope }).unit = function (): Envelope {
  return Envelope.new(UNIT);
};

/// Implementation of asKnownValue()
Envelope.prototype.asKnownValue = function (this: Envelope): KnownValue | undefined {
  const c = this.case();
  if (c.type === "knownValue") {
    return c.value;
  }
  return undefined;
};

/// Implementation of tryKnownValue()
Envelope.prototype.tryKnownValue = function (this: Envelope): KnownValue {
  const kv = this.asKnownValue();
  if (kv === undefined) {
    throw EnvelopeError.notKnownValue();
  }
  return kv;
};

/// Implementation of isKnownValue()
Envelope.prototype.isKnownValue = function (this: Envelope): boolean {
  return this.case().type === "knownValue";
};

/// Implementation of isSubjectUnit()
Envelope.prototype.isSubjectUnit = function (this: Envelope): boolean {
  const kv = this.subject().asKnownValue();
  if (kv === undefined) {
    return false;
  }
  return kv.equals(UNIT);
};

/// Implementation of checkSubjectUnit()
Envelope.prototype.checkSubjectUnit = function (this: Envelope): Envelope {
  if (this.isSubjectUnit()) {
    return this;
  }
  throw EnvelopeError.subjectNotUnit();
};
