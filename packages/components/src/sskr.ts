/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * SSKR Integration - CBOR wrappers for SSKR shares
 *
 * This module provides CBOR serialization for SSKR (Sharded Secret Key
 * Reconstruction) shares. It wraps the core SSKR functionality from
 * @bcts/sskr with CBOR tags.
 *
 * # CBOR Serialization
 *
 * SSKRShare is serialized with tag 40309:
 * ```
 * #6.40309(h'<share-bytes>')
 * ```
 *
 * Legacy tag 309 is also supported for reading.
 *
 * Ported from bc-components-rust/src/sskr_mod.rs
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  toByteString,
  expectBytes,
  createTaggedCbor,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
  tagValue,
} from "@bcts/dcbor";
import { SSKR_SHARE as TAG_SSKR_SHARE, SSKR_SHARE_V1 as TAG_SSKR_SHARE_V1 } from "@bcts/tags";

import { bytesToHex, hexToBytes } from "./utils.js";
import {
  sskrGenerate,
  sskrGenerateUsing,
  sskrCombine,
  Secret as SSKRSecret,
  GroupSpec as SSKRGroupSpec,
  Spec as SSKRSpec,
} from "@bcts/sskr";
import type { RandomNumberGenerator } from "@bcts/rand";

// Re-export from sskr package
export { sskrGenerate, sskrGenerateUsing, sskrCombine, SSKRSecret, SSKRGroupSpec, SSKRSpec };

/** Metadata size in bytes (identifier + thresholds + indices) */
const METADATA_SIZE_BYTES = 5;

/**
 * SSKRShareCbor - CBOR/UR wrapper for an SSKR share.
 *
 * An SSKR share is a binary encoding of:
 * - Identifier (2 bytes)
 * - Group metadata (1 byte): group_threshold-1 (4 bits) + group_count-1 (4 bits)
 * - Member metadata (1 byte): group_index (4 bits) + member_threshold-1 (4 bits)
 * - Member index (1 byte): reserved (4 bits, must be 0) + member_index (4 bits)
 * - Share value (variable length)
 */
export class SSKRShareCbor implements CborTaggedEncodable, CborTaggedDecodable<SSKRShareCbor> {
  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length < METADATA_SIZE_BYTES) {
      throw new Error(
        `SSKRShare must be at least ${METADATA_SIZE_BYTES} bytes, got ${data.length}`,
      );
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create an SSKRShareCbor from raw share bytes.
   *
   * @param data - The share bytes (5+ bytes)
   */
  static fromData(data: Uint8Array): SSKRShareCbor {
    return new SSKRShareCbor(data);
  }

  /**
   * Create an SSKRShareCbor from a hex string.
   *
   * @param hex - The share as a hex string
   */
  static fromHex(hex: string): SSKRShareCbor {
    return new SSKRShareCbor(hexToBytes(hex));
  }

  // ============================================================================
  // Instance Methods - Data Access
  // ============================================================================

  /**
   * Returns the raw share bytes.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Returns a copy of the raw share bytes.
   */
  data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Returns the share as a hex string.
   */
  hex(): string {
    return bytesToHex(this._data);
  }

  // ============================================================================
  // Instance Methods - Metadata Access
  // ============================================================================

  /**
   * Returns the identifier (2 bytes) as a number.
   */
  identifier(): number {
    return (this._data[0] << 8) | this._data[1];
  }

  /**
   * Returns the identifier as a hex string.
   */
  identifierHex(): string {
    return bytesToHex(this._data.subarray(0, 2));
  }

  /**
   * Returns the group threshold (minimum number of groups needed).
   */
  groupThreshold(): number {
    return (this._data[2] >> 4) + 1;
  }

  /**
   * Returns the total number of groups.
   */
  groupCount(): number {
    return (this._data[2] & 0x0f) + 1;
  }

  /**
   * Returns this share's group index (0-based).
   */
  groupIndex(): number {
    return this._data[3] >> 4;
  }

  /**
   * Returns the member threshold for this share's group.
   */
  memberThreshold(): number {
    return (this._data[3] & 0x0f) + 1;
  }

  /**
   * Returns this share's member index within its group (0-based).
   */
  memberIndex(): number {
    return this._data[4] & 0x0f;
  }

  /**
   * Returns the share value (the actual secret share data).
   */
  shareValue(): Uint8Array {
    return this._data.subarray(METADATA_SIZE_BYTES);
  }

  // ============================================================================
  // Equality and String Representation
  // ============================================================================

  /**
   * Compare with another SSKRShareCbor.
   */
  equals(other: SSKRShareCbor): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `SSKRShare(${this.identifierHex()}, group ${this.groupIndex() + 1}/${this.groupCount()}, member ${this.memberIndex() + 1}/${this.memberThreshold()})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with SSKRShare.
   * Includes both current tag (40309) and legacy tag (309) for compatibility.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SSKR_SHARE.value, TAG_SSKR_SHARE_V1.value]);
  }

  /**
   * Returns the untagged CBOR encoding.
   */
  untaggedCbor(): Cbor {
    return toByteString(this._data);
  }

  /**
   * Returns the tagged CBOR encoding.
   */
  taggedCbor(): Cbor {
    return createTaggedCbor(this);
  }

  /**
   * Returns the tagged value in CBOR binary representation.
   */
  taggedCborData(): Uint8Array {
    return this.taggedCbor().toData();
  }

  // ============================================================================
  // CBOR Deserialization (CborTaggedDecodable)
  // ============================================================================

  /**
   * Creates an SSKRShareCbor by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): SSKRShareCbor {
    const data = expectBytes(cborValue);
    return SSKRShareCbor.fromData(data);
  }

  /**
   * Creates an SSKRShareCbor by decoding it from tagged CBOR.
   * Accepts both tag 40309 and legacy tag 309.
   */
  fromTaggedCbor(cborValue: Cbor): SSKRShareCbor {
    const tag = tagValue(cborValue);

    // Accept both current and legacy tags
    if (tag !== TAG_SSKR_SHARE.value && tag !== TAG_SSKR_SHARE_V1.value) {
      throw new Error(
        `Invalid SSKRShare tag: expected ${TAG_SSKR_SHARE.value} or ${TAG_SSKR_SHARE_V1.value}, got ${tag}`,
      );
    }

    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): SSKRShareCbor {
    const dummy = new SSKRShareCbor(new Uint8Array(METADATA_SIZE_BYTES + 16));
    return dummy.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): SSKRShareCbor {
    const cborValue = decodeCbor(data);
    return SSKRShareCbor.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): SSKRShareCbor {
    const cborValue = decodeCbor(data);
    const dummy = new SSKRShareCbor(new Uint8Array(METADATA_SIZE_BYTES + 16));
    return dummy.fromUntaggedCbor(cborValue);
  }
}

// ============================================================================
// Type Alias for Rust Parity
// ============================================================================

/**
 * SSKRShare - Alias for SSKRShareCbor to match Rust API naming.
 *
 * In Rust, this type is called `SSKRShare`. The TypeScript implementation
 * uses `SSKRShareCbor` to distinguish it from raw share data, but we provide
 * this alias for API parity with bc-components-rust.
 */
export type SSKRShare = SSKRShareCbor;

/**
 * Create an SSKRShare from raw data.
 * This is a convenience function that matches the Rust constructor pattern.
 */
// eslint-disable-next-line no-redeclare -- Intentional: TypeScript allows type/value with same name
export const SSKRShare = {
  fromData: (data: Uint8Array): SSKRShareCbor => SSKRShareCbor.fromData(data),
  fromHex: (hex: string): SSKRShareCbor => SSKRShareCbor.fromHex(hex),
  fromTaggedCbor: (cborValue: Cbor): SSKRShareCbor => SSKRShareCbor.fromTaggedCbor(cborValue),
  fromTaggedCborData: (data: Uint8Array): SSKRShareCbor => SSKRShareCbor.fromTaggedCborData(data),
  fromUntaggedCborData: (data: Uint8Array): SSKRShareCbor =>
    SSKRShareCbor.fromUntaggedCborData(data),
};

// ============================================================================
// Wrapper Functions (Rust API Parity)
// ============================================================================

/**
 * Generates SSKR shares for the given spec and secret.
 *
 * This function matches the Rust `sskr_generate` API by returning wrapped
 * SSKRShare objects instead of raw byte arrays.
 *
 * @param spec - The SSKRSpec instance defining group/member thresholds
 * @param masterSecret - The SSKRSecret to be split into shares
 * @returns Nested array of SSKRShare instances (groups × members)
 *
 * @example
 * ```typescript
 * import { SSKRSecret, SSKRSpec, SSKRGroupSpec, sskrGenerateShares } from '@bcts/components';
 *
 * const secret = SSKRSecret.new(new Uint8Array(16).fill(0x42));
 * const group = SSKRGroupSpec.new(2, 3); // 2 of 3
 * const spec = SSKRSpec.new(1, [group]); // 1 group required
 *
 * const shares = sskrGenerateShares(spec, secret);
 * // shares[0] contains 3 SSKRShare instances
 * ```
 */
export function sskrGenerateShares(spec: SSKRSpec, masterSecret: SSKRSecret): SSKRShare[][] {
  const rawGroups = sskrGenerate(spec, masterSecret);
  return rawGroups.map((group) => group.map((shareData) => SSKRShareCbor.fromData(shareData)));
}

/**
 * Interface for RNG that only requires fillRandomData method.
 * This is a subset of the full RandomNumberGenerator interface.
 */
export interface SimpleRng {
  fillRandomData(data: Uint8Array): void;
}

/**
 * Generates SSKR shares using a custom random number generator.
 *
 * This function matches the Rust `sskr_generate_using` API by returning
 * wrapped SSKRShare objects and allowing a custom RNG for deterministic
 * testing.
 *
 * @param spec - The SSKRSpec instance defining group/member thresholds
 * @param masterSecret - The SSKRSecret to be split into shares
 * @param rng - Random number generator (must have fillRandomData method)
 * @returns Nested array of SSKRShare instances (groups × members)
 */
export function sskrGenerateSharesUsing(
  spec: SSKRSpec,
  masterSecret: SSKRSecret,
  rng: SimpleRng,
): SSKRShare[][] {
  // Cast to RandomNumberGenerator - sskrGenerateUsing only uses fillRandomData internally
  const rawGroups = sskrGenerateUsing(spec, masterSecret, rng as unknown as RandomNumberGenerator);
  return rawGroups.map((group) => group.map((shareData) => SSKRShareCbor.fromData(shareData)));
}

/**
 * Combines SSKR shares to reconstruct the original secret.
 *
 * This function matches the Rust `sskr_combine` API by accepting
 * wrapped SSKRShare objects.
 *
 * @param shares - Array of SSKRShare instances to combine
 * @returns The reconstructed SSKRSecret
 * @throws Error if shares cannot be combined (insufficient shares, mismatched IDs, etc.)
 *
 * @example
 * ```typescript
 * import { sskrGenerateShares, sskrCombineShares } from '@bcts/components';
 *
 * // Generate shares
 * const shares = sskrGenerateShares(spec, secret);
 *
 * // Combine 2 shares from the first group
 * const recoveredSecret = sskrCombineShares([shares[0][0], shares[0][1]]);
 * ```
 */
export function sskrCombineShares(shares: SSKRShare[]): SSKRSecret {
  const rawShares = shares.map((share) => share.data());
  return sskrCombine(rawShares);
}
