/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from provenance-mark-rust/src/rng_state.rs

import { type Cbor, cbor, expectBytes } from "@bcts/dcbor";

import { ProvenanceMarkError, ProvenanceMarkErrorType } from "./error.js";

export const RNG_STATE_LENGTH = 32;

/**
 * RNG state for provenance marks (32 bytes).
 */
export class RngState {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    this.data = data;
  }

  /**
   * Get the raw bytes.
   */
  toBytes(): Uint8Array {
    return new Uint8Array(this.data);
  }

  /**
   * Create from a 32-byte array.
   */
  static fromBytes(bytes: Uint8Array): RngState {
    if (bytes.length !== RNG_STATE_LENGTH) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidSeedLength, undefined, {
        actual: bytes.length,
      });
    }
    return new RngState(new Uint8Array(bytes));
  }

  /**
   * Create from a slice (validates length).
   */
  static fromSlice(bytes: Uint8Array): RngState {
    return RngState.fromBytes(bytes);
  }

  /**
   * Get the hex representation.
   */
  hex(): string {
    return Array.from(this.data)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Convert to CBOR (byte string).
   */
  toCbor(): Cbor {
    return cbor(this.data);
  }

  /**
   * Create from CBOR (byte string).
   */
  static fromCbor(cborValue: Cbor): RngState {
    const bytes = expectBytes(cborValue);
    return RngState.fromBytes(bytes);
  }
}
