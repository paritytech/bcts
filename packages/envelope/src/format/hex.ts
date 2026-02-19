/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Envelope } from "../base/envelope";
import { cborData } from "@bcts/dcbor";

/// Hex formatting for Gordian Envelopes.
///
/// This module provides methods for converting envelopes to hexadecimal
/// representations of their CBOR encoding, useful for debugging and
/// low-level inspection.

// Note: Method declarations are in the base Envelope class.
// This module provides the prototype implementations.

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
