/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

// Ported from provenance-mark-rust/src/seed.rs

import { type Cbor, cbor, expectBytes } from "@bcts/dcbor";
import { randomData } from "@bcts/rand";

import { ProvenanceMarkError, ProvenanceMarkErrorType } from "./error.js";
import { extendKey } from "./crypto-utils.js";

export const PROVENANCE_SEED_LENGTH = 32;

/**
 * A seed for generating provenance marks.
 */
export class ProvenanceSeed {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    this.data = data;
  }

  /**
   * Create a new random seed using secure random number generation.
   */
  static new(): ProvenanceSeed {
    const data = randomData(PROVENANCE_SEED_LENGTH);
    return ProvenanceSeed.fromBytes(data);
  }

  /**
   * Create a new seed using custom random data.
   */
  static newUsing(randomData: Uint8Array): ProvenanceSeed {
    if (randomData.length < PROVENANCE_SEED_LENGTH) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidSeedLength, undefined, {
        actual: randomData.length,
      });
    }
    return ProvenanceSeed.fromBytes(randomData.slice(0, PROVENANCE_SEED_LENGTH));
  }

  /**
   * Create a new seed from a passphrase.
   */
  static newWithPassphrase(passphrase: string): ProvenanceSeed {
    const seedData = extendKey(new TextEncoder().encode(passphrase));
    return ProvenanceSeed.fromBytes(seedData);
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
  static fromBytes(bytes: Uint8Array): ProvenanceSeed {
    if (bytes.length !== PROVENANCE_SEED_LENGTH) {
      throw new ProvenanceMarkError(ProvenanceMarkErrorType.InvalidSeedLength, undefined, {
        actual: bytes.length,
      });
    }
    return new ProvenanceSeed(new Uint8Array(bytes));
  }

  /**
   * Create from a slice (validates length).
   */
  static fromSlice(bytes: Uint8Array): ProvenanceSeed {
    return ProvenanceSeed.fromBytes(bytes);
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
  static fromCbor(cborValue: Cbor): ProvenanceSeed {
    const bytes = expectBytes(cborValue);
    return ProvenanceSeed.fromBytes(bytes);
  }
}
