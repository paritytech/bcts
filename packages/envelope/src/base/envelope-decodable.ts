import type { Cbor } from "@blockchain-commons/dcbor";
import {
  tryIntoText,
  tryIntoBool,
  tryIntoByteString,
  isNull,
  decodeCbor,
} from "@blockchain-commons/dcbor";
import { Envelope } from "./envelope";
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

/// Extension methods for Envelope to support CBOR decoding.
///
/// These methods are added to the Envelope class prototype to match
/// the Rust API.
declare module "./envelope" {
  interface Envelope {
    /// Attempts to extract the leaf CBOR value from this envelope.
    ///
    /// @returns The CBOR value contained in the leaf
    /// @throws {EnvelopeError} If the envelope is not a leaf
    tryLeaf(): Cbor;

    /// Converts this envelope to a string.
    ///
    /// @returns The string value
    /// @throws {EnvelopeError} If the envelope cannot be converted
    extractString(): string;

    /// Converts this envelope to a number.
    ///
    /// @returns The number value
    /// @throws {EnvelopeError} If the envelope cannot be converted
    extractNumber(): number;

    /// Converts this envelope to a boolean.
    ///
    /// @returns The boolean value
    /// @throws {EnvelopeError} If the envelope cannot be converted
    extractBoolean(): boolean;

    /// Converts this envelope to a byte array.
    ///
    /// @returns The byte array value
    /// @throws {EnvelopeError} If the envelope cannot be converted
    extractBytes(): Uint8Array;
  }
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
