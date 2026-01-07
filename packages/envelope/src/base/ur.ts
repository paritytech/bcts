/// UR (Uniform Resource) support for Gordian Envelope.
///
/// This module adds urString() and fromUrString() methods to the Envelope class,
/// enabling serialization to and from UR format as specified in BCR-2020-005.

import { UR } from "@bcts/uniform-resources";
import { Envelope } from "./envelope";

// ============================================================================
// Envelope Prototype Extensions for UR Support
// ============================================================================

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
