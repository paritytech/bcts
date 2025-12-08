import { Envelope } from "../base/envelope";
import { cborData } from "@blockchain-commons/dcbor";

/// Hex formatting for Gordian Envelopes.
///
/// This module provides methods for converting envelopes to hexadecimal
/// representations of their CBOR encoding, useful for debugging and
/// low-level inspection.

declare module "../base/envelope" {
  interface Envelope {
    /// Returns the CBOR hex dump of this envelope.
    ///
    /// The hex output shows the raw CBOR bytes in hexadecimal format,
    /// which is useful for debugging and understanding the binary structure.
    ///
    /// @returns A hexadecimal string representation of the envelope's CBOR
    ///   encoding
    ///
    /// @example
    /// ```typescript
    /// const envelope = Envelope.new("Hello");
    /// console.log(envelope.hex());
    /// // Output: d8c8456548656c6c6f
    /// ```
    hex(): string;

    /// Returns the CBOR bytes of this envelope as a Uint8Array.
    ///
    /// @returns The CBOR-encoded bytes
    ///
    /// @example
    /// ```typescript
    /// const envelope = Envelope.new("Hello");
    /// const bytes = envelope.cborBytes();
    /// console.log(bytes); // Uint8Array [...]
    /// ```
    cborBytes(): Uint8Array;
  }
}

/// Implementation of hex()
Envelope.prototype.hex = function (this: Envelope): string {
  const bytes = this.cborBytes();
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/// Implementation of cborBytes()
Envelope.prototype.cborBytes = function (this: Envelope): Uint8Array {
  const cbor = this.taggedCbor();
  return cborData(cbor);
};
