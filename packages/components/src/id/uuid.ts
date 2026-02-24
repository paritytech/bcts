/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * Universally Unique Identifier (UUID) - 16-byte identifier
 *
 * UUIDs are 128-bit (16-byte) identifiers that are designed to be unique
 * across space and time. This implementation creates type 4 (random) UUIDs,
 * following the UUID specification:
 *
 * - Version field (bits 48-51) is set to 4, indicating a random UUID
 * - Variant field (bits 64-65) is set to 2, indicating RFC 4122/DCE 1.1 UUID
 *   variant
 *
 * Unlike ARIDs, UUIDs:
 * - Are shorter (128 bits vs 256 bits)
 * - Contain version and variant metadata within the identifier
 * - Have a canonical string representation with 5 groups separated by hyphens
 *
 * The canonical textual representation of a UUID takes the form:
 * `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` where each `x` is a hexadecimal digit.
 *
 * # CBOR Serialization
 *
 * `UUID` is serialized to CBOR with tag 37 (standard UUID tag).
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `UUID` is represented with the
 * type "uuid".
 */

import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  toByteString,
  expectBytes,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { UUID as TAG_UUID } from "@bcts/tags";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { CryptoError } from "../error.js";
import { bytesToHex, toBase64 } from "../utils.js";

const UUID_SIZE = 16;

export class UUID implements CborTaggedEncodable, CborTaggedDecodable<UUID>, UREncodable {
  static readonly UUID_SIZE = UUID_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== UUID_SIZE) {
      throw CryptoError.invalidSize(UUID_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a new random UUID (v4).
   */
  static new(): UUID {
    return UUID.random();
  }

  /**
   * Create a UUID from raw bytes.
   */
  static fromData(data: Uint8Array): UUID {
    return new UUID(new Uint8Array(data));
  }

  /**
   * Restores a UUID from data (validates length).
   */
  static fromDataRef(data: Uint8Array): UUID {
    if (data.length !== UUID_SIZE) {
      throw CryptoError.invalidSize(UUID_SIZE, data.length);
    }
    return UUID.fromData(data);
  }

  /**
   * Create a UUID from raw bytes (legacy alias).
   */
  static from(data: Uint8Array): UUID {
    return UUID.fromData(data);
  }

  /**
   * Create a UUID from hex string (32 hex chars)
   */
  static fromHex(hex: string): UUID {
    if (hex.length !== 32) {
      throw CryptoError.invalidFormat(`UUID hex must be 32 characters, got ${hex.length}`);
    }
    const data = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      data[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return new UUID(data);
  }

  /**
   * Create a UUID from string representation (standard UUID format)
   * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  static fromString(uuidString: string): UUID {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuidString)) {
      throw CryptoError.invalidFormat(`Invalid UUID format: ${uuidString}`);
    }
    const hex = uuidString.replace(/-/g, "");
    return UUID.fromHex(hex);
  }

  /**
   * Generate a random UUID (v4)
   */
  static random(): UUID {
    const data = new Uint8Array(UUID_SIZE);
    globalThis.crypto.getRandomValues(data);

    // Set version to 4 (random)
    data[6] = (data[6] & 0x0f) | 0x40;
    // Set variant to RFC 4122
    data[8] = (data[8] & 0x3f) | 0x80;

    return new UUID(data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Get the data of the UUID.
   */
  data(): Uint8Array {
    return this._data;
  }

  /**
   * Get the UUID as a byte slice.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get the raw UUID bytes as a copy.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Get hex string representation (lowercase, matching Rust implementation).
   */
  hex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Get hex string representation (alias for hex()).
   */
  toHex(): string {
    return this.hex();
  }

  /**
   * Get standard UUID string representation.
   * Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  toString(): string {
    const hex = this.toHex();
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
  }

  /**
   * Get base64 representation.
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Compare with another UUID.
   */
  equals(other: UUID): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with UUID.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_UUID.value]);
  }

  /**
   * Returns the untagged CBOR encoding (as a byte string).
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
   * Creates a UUID by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): UUID {
    const data = expectBytes(cbor);
    return UUID.fromDataRef(data);
  }

  /**
   * Creates a UUID by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): UUID {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): UUID {
    const instance = new UUID(new Uint8Array(UUID_SIZE));
    return instance.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): UUID {
    const cbor = decodeCbor(data);
    return UUID.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): UUID {
    const cbor = decodeCbor(data);
    const bytes = expectBytes(cbor);
    return UUID.fromDataRef(bytes);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the UUID.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("uuid", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a UUID from a UR.
   */
  static fromUR(ur: UR): UUID {
    ur.checkType("uuid");
    const instance = new UUID(new Uint8Array(UUID_SIZE));
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a UUID from a UR string.
   */
  static fromURString(urString: string): UUID {
    const ur = UR.fromURString(urString);
    return UUID.fromUR(ur);
  }
}
