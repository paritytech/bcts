import type { Cbor } from "@bcts/dcbor";
import { tryIntoText, tryIntoBool, tryIntoByteString, isNull, decodeCbor } from "@bcts/dcbor";
import { Envelope } from "./envelope";
import type { EnvelopeEncodableValue } from "./envelope-encodable";
import { EnvelopeError } from "./error";

/// Provides functions for extracting typed values from envelopes.
///
/// This module defines conversion functions that parallel Rust's `TryFrom<Envelope>`
/// implementations. These allow extracting specific types from envelope leaf values.
///
/// In the Rust version, a macro (`impl_envelope_decodable!`) is used to generate
/// these implementations for many types. In TypeScript, we provide explicit
/// conversion functions instead.

/// Extracts a string value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The string value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractString(envelope: Envelope): string {
  const cbor = envelope.tryLeaf();
  try {
    return tryIntoText(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain a string",
      error instanceof Error ? error : undefined,
    );
  }
}

/// Extracts a number value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The number value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractNumber(envelope: Envelope): number {
  const cbor = envelope.tryLeaf();

  // Handle unsigned, negative, and simple (float) types
  if ("type" in cbor) {
    switch (cbor.type) {
      case 0: // MajorType.Unsigned
        return typeof cbor.value === "bigint" ? Number(cbor.value) : cbor.value;
      case 1: {
        // MajorType.Negative
        // Negative values are stored as magnitude, convert back
        const magnitude = typeof cbor.value === "bigint" ? Number(cbor.value) : cbor.value;
        return -magnitude - 1;
      }
      case 7: // MajorType.Simple
        if (
          typeof cbor.value === "object" &&
          cbor.value !== null &&
          "type" in cbor.value &&
          cbor.value.type === "Float"
        ) {
          return cbor.value.value;
        }
        break;
      case 2: // MajorType.ByteString
      case 3: // MajorType.TextString
      case 4: // MajorType.Array
      case 5: // MajorType.Map
      case 6: // MajorType.Tag
        // These CBOR types don't represent numbers
        break;
    }
  }

  throw EnvelopeError.cbor("envelope does not contain a number");
}

/// Extracts a boolean value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The boolean value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractBoolean(envelope: Envelope): boolean {
  const cbor = envelope.tryLeaf();
  try {
    return tryIntoBool(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain a boolean",
      error instanceof Error ? error : undefined,
    );
  }
}

/// Extracts a byte array value from an envelope.
///
/// @param envelope - The envelope to extract from
/// @returns The byte array value
/// @throws {EnvelopeError} If the envelope is not a leaf or cannot be converted
export function extractBytes(envelope: Envelope): Uint8Array {
  const cbor = envelope.tryLeaf();
  try {
    return tryIntoByteString(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "envelope does not contain bytes",
      error instanceof Error ? error : undefined,
    );
  }
}

/// Extracts null from an envelope.
///
/// @param envelope - The envelope to extract from
/// @throws {EnvelopeError} If the envelope is not a leaf containing null
export function extractNull(envelope: Envelope): null {
  const cbor = envelope.tryLeaf();
  if (isNull(cbor)) {
    return null;
  }
  throw EnvelopeError.cbor("envelope does not contain null");
}

/// Static methods for creating envelopes from CBOR data.
///
/// These are convenience methods that mirror the Rust implementation.
export class EnvelopeDecoder {
  /// Creates an envelope from a CBOR value.
  ///
  /// @param cbor - The CBOR value to convert into an envelope
  /// @returns A new envelope created from the CBOR data
  /// @throws {EnvelopeError} If the CBOR does not represent a valid envelope
  static tryFromCbor(cbor: Cbor): Envelope {
    try {
      return Envelope.fromTaggedCbor(cbor);
    } catch (error) {
      throw EnvelopeError.cbor("invalid envelope CBOR", error instanceof Error ? error : undefined);
    }
  }

  /// Creates an envelope from raw CBOR binary data.
  ///
  /// @param data - The raw CBOR binary data to convert into an envelope
  /// @returns A new envelope created from the CBOR data
  /// @throws {EnvelopeError} If the data is not valid CBOR or does not
  ///   represent a valid envelope structure
  static tryFromCborData(data: Uint8Array): Envelope {
    try {
      const cbor = decodeCbor(data);
      return EnvelopeDecoder.tryFromCbor(cbor);
    } catch (error) {
      throw EnvelopeError.cbor(
        "invalid envelope CBOR data",
        error instanceof Error ? error : undefined,
      );
    }
  }
}

/// Add the tryLeaf method to Envelope prototype.
///
/// This extracts the leaf CBOR value from an envelope.
Envelope.prototype.tryLeaf = function (this: Envelope): Cbor {
  const c = this.case();
  if (c.type !== "leaf") {
    throw EnvelopeError.notLeaf();
  }
  return c.cbor;
};

/// Add extraction convenience methods to Envelope prototype
Envelope.prototype.extractString = function (this: Envelope): string {
  return extractString(this);
};

Envelope.prototype.extractNumber = function (this: Envelope): number {
  return extractNumber(this);
};

Envelope.prototype.extractBoolean = function (this: Envelope): boolean {
  return extractBoolean(this);
};

Envelope.prototype.extractBytes = function (this: Envelope): Uint8Array {
  return extractBytes(this);
};

Envelope.prototype.extractNull = function (this: Envelope): null {
  return extractNull(this);
};

// ============================================================================
// Generic Typed Extraction Methods
// ============================================================================

/// Type for CBOR decoder functions
export type CborDecoder<T> = (cbor: Cbor) => T;

/// Extracts the subject of an envelope as type T using a decoder function.
///
/// This is the TypeScript equivalent of Rust's `TryFrom<Envelope>` trait bound.
/// Since TypeScript doesn't have trait bounds on generics, we pass a decoder
/// function explicitly.
///
/// @example
/// ```typescript
/// const envelope = Envelope.new(myEncryptedKey.taggedCbor());
/// const extracted = envelope.extractSubject(EncryptedKey.fromTaggedCbor);
/// ```
///
/// @param decoder - Function to decode CBOR to type T
/// @returns The decoded value of type T
/// @throws {EnvelopeError} If the envelope is not a leaf or decoding fails
export function extractSubject<T>(envelope: Envelope, decoder: CborDecoder<T>): T {
  const cbor = envelope.subject().tryLeaf();
  try {
    return decoder(cbor);
  } catch (error) {
    throw EnvelopeError.cbor(
      "failed to decode subject",
      error instanceof Error ? error : undefined,
    );
  }
}

/// Add extractSubject method to Envelope prototype
Envelope.prototype.extractSubject = function <T>(this: Envelope, decoder: CborDecoder<T>): T {
  return extractSubject(this, decoder);
};

/// Extracts the object for a predicate as type T using a decoder function.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns The decoded value of type T
/// @throws {EnvelopeError} If predicate not found or decoding fails
export function tryObjectForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T {
  const obj = envelope.objectForPredicate(predicate);
  return extractSubject(obj, decoder);
}

/// Add tryObjectForPredicate method to Envelope prototype
Envelope.prototype.tryObjectForPredicate = function <T>(
  this: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T {
  return tryObjectForPredicate(this, predicate, decoder);
};

/// Extracts the optional object for a predicate as type T using a decoder function.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns The decoded value of type T, or undefined if predicate not found
/// @throws {EnvelopeError} If decoding fails (but not if predicate not found)
export function tryOptionalObjectForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T | undefined {
  const obj = envelope.optionalObjectForPredicate(predicate);
  if (obj === undefined) {
    return undefined;
  }
  return extractSubject(obj, decoder);
}

/// Add tryOptionalObjectForPredicate method to Envelope prototype
Envelope.prototype.tryOptionalObjectForPredicate = function <T>(
  this: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T | undefined {
  return tryOptionalObjectForPredicate(this, predicate, decoder);
};

/// Extracts the object for a predicate as type T, with a default value if not found.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @param defaultValue - Value to return if predicate not found
/// @returns The decoded value of type T, or the default value
/// @throws {EnvelopeError} If decoding fails (but not if predicate not found)
export function extractObjectForPredicateWithDefault<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
  defaultValue: T,
): T {
  const result = tryOptionalObjectForPredicate(envelope, predicate, decoder);
  return result !== undefined ? result : defaultValue;
}

/// Add extractObjectForPredicateWithDefault method to Envelope prototype
Envelope.prototype.extractObjectForPredicateWithDefault = function <T>(
  this: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
  defaultValue: T,
): T {
  return extractObjectForPredicateWithDefault(this, predicate, decoder, defaultValue);
};

/// Extracts all objects for a predicate as type T using a decoder function.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns Array of decoded values of type T
/// @throws {EnvelopeError} If any decoding fails
export function extractObjectsForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T[] {
  const objects = envelope.objectsForPredicate(predicate);
  return objects.map((obj) => extractSubject(obj, decoder));
}

/// Add extractObjectsForPredicate method to Envelope prototype
Envelope.prototype.extractObjectsForPredicate = function <T>(
  this: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T[] {
  return extractObjectsForPredicate(this, predicate, decoder);
};

/// Extracts all objects for a predicate as type T, returning empty array if none found.
///
/// @param envelope - The envelope to query
/// @param predicate - The predicate to match
/// @param decoder - Function to decode CBOR to type T
/// @returns Array of decoded values of type T (empty if no matches)
/// @throws {EnvelopeError} If any decoding fails
export function tryObjectsForPredicate<T>(
  envelope: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T[] {
  try {
    return extractObjectsForPredicate(envelope, predicate, decoder);
  } catch (error) {
    // If it's a nonexistent predicate error, return empty array
    if (error instanceof EnvelopeError && error.code === "NONEXISTENT_PREDICATE") {
      return [];
    }
    throw error;
  }
}

/// Add tryObjectsForPredicate method to Envelope prototype
Envelope.prototype.tryObjectsForPredicate = function <T>(
  this: Envelope,
  predicate: EnvelopeEncodableValue,
  decoder: CborDecoder<T>,
): T[] {
  return tryObjectsForPredicate(this, predicate, decoder);
};
