/// UR (Uniform Resource) support for Gordian Envelope.
///
/// This module adds urString() and fromUrString() methods to the Envelope class,
/// enabling serialization to and from UR format as specified in BCR-2020-005.

import { UR } from "@bcts/uniform-resources";
import { Envelope } from "./envelope";

// ============================================================================
// Envelope Prototype Extensions for UR Support
// ============================================================================

declare module "./envelope" {
  interface Envelope {
    /// Returns the UR string representation of the envelope.
    ///
    /// This encodes the envelope as a Uniform Resource (UR) string with type "envelope".
    ///
    /// @returns A UR string like "ur:envelope/..."
    urString(): string;

    /// Returns the UR representation of the envelope.
    ///
    /// @returns A UR object
    ur(): UR;

    /// Returns the tagged CBOR bytes of the envelope.
    ///
    /// This is an alias for cborBytes() for compatibility with Rust API.
    taggedCborData(): Uint8Array;
  }

  namespace Envelope {
    /// Creates an envelope from a UR string.
    ///
    /// @param urString - A UR string like "ur:envelope/..."
    /// @returns A new Envelope instance
    /// @throws If the UR string is invalid or not an envelope type
    function fromUrString(urString: string): Envelope;

    /// Creates an envelope from a UR string (alias for fromUrString).
    function fromURString(urString: string): Envelope;

    /// Creates an envelope from a UR object.
    ///
    /// @param ur - A UR object with type "envelope"
    /// @returns A new Envelope instance
    function fromUR(ur: UR): Envelope;
  }
}

/// Implementation of urString
Envelope.prototype.urString = function (this: Envelope): string {
  // Use explicit return type to avoid circular type resolution issues
  const ur = UR.new("envelope", this.taggedCbor());
  return ur.string();
};

/// Implementation of ur
Envelope.prototype.ur = function (this: Envelope): UR {
  return UR.new("envelope", this.taggedCbor());
};

/// Implementation of taggedCborData (alias for cborBytes)
Envelope.prototype.taggedCborData = function (this: Envelope): Uint8Array {
  return this.cborBytes();
};

/// Implementation of fromUrString
Envelope.fromUrString = function (urString: string): Envelope {
  const ur = UR.fromURString(urString);
  return Envelope.fromUR(ur);
};

/// Implementation of fromURString (alias)
Envelope.fromURString = Envelope.fromUrString;

/// Implementation of fromUR
Envelope.fromUR = function (ur: UR): Envelope {
  ur.checkType("envelope");
  return Envelope.fromTaggedCbor(ur.cbor());
};
