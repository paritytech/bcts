/**
 * Cryptographic seed with optional metadata (minimum 16 bytes)
 * Ported from bc-components-rust/src/seed.rs
 *
 * A `Seed` is a source of entropy used to generate cryptographic keys in a
 * deterministic manner. Unlike randomly generated keys, seed-derived keys can
 * be recreated if you have the original seed, making them useful for backup
 * and recovery scenarios.
 *
 * This implementation of `Seed` includes the random seed data as well as
 * optional metadata:
 * - A name (for identifying the seed)
 * - A note (for storing additional information)
 * - A creation date
 *
 * The minimum seed length is 16 bytes to ensure sufficient security and
 * entropy.
 *
 * # CBOR Serialization
 *
 * `Seed` implements the CBOR tagged encoding interfaces, which means it can be
 * serialized to and deserialized from CBOR with specific tags. The tags used
 * are `TAG_SEED` (40300) and the older `TAG_SEED_V1` (300) for backward compatibility.
 *
 * When serialized to CBOR, a `Seed` is represented as a map with the following
 * keys:
 * - 1: The seed data (required)
 * - 2: The creation date (optional)
 * - 3: The name (optional, omitted if empty)
 * - 4: The note (optional, omitted if empty)
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `Seed` is represented with the
 * type "seed".
 */

import { SecureRandomNumberGenerator } from "@bcts/rand";
import {
  type Cbor,
  type Tag,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  CborMap,
  CborDate,
  toByteString,
  expectMap,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
} from "@bcts/dcbor";
import { SEED as TAG_SEED, SEED_V1 as TAG_SEED_V1 } from "@bcts/tags";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";
import type { PrivateKeyDataProvider } from "./private-key-data-provider.js";

export interface SeedMetadata {
  name?: string;
  note?: string;
  createdAt?: Date;
}

export class Seed
  implements CborTaggedEncodable, CborTaggedDecodable<Seed>, UREncodable, PrivateKeyDataProvider
{
  /**
   * Minimum seed length in bytes (matches Rust MIN_SEED_LENGTH).
   */
  static readonly MIN_SEED_LENGTH = 16;

  // Defensive copy: internal data is never exposed directly to prevent external mutation
  private readonly _data: Uint8Array;
  private _name: string;
  private _note: string;
  private _creationDate: Date | undefined;

  private constructor(data: Uint8Array, name?: string, note?: string, creationDate?: Date) {
    if (data.length < Seed.MIN_SEED_LENGTH) {
      throw CryptoError.dataTooShort("seed", Seed.MIN_SEED_LENGTH, data.length);
    }
    // Defensive copy on construction to ensure immutability of internal state
    this._data = new Uint8Array(data);
    this._name = name ?? "";
    this._note = note ?? "";
    this._creationDate = creationDate;
  }

  // ============================================================================
  // Static Factory Methods (Rust API Parity)
  // ============================================================================

  /**
   * Create a new random seed with default length (16 bytes).
   *
   * Rust equivalent: `Seed::new()`
   */
  static new(): Seed {
    return Seed.newWithLen(Seed.MIN_SEED_LENGTH);
  }

  /**
   * Create a new random seed with a specified length.
   *
   * Rust equivalent: `Seed::new_with_len(count)`
   *
   * @param count - Number of bytes (must be >= 16)
   * @throws CryptoError if count < 16
   */
  static newWithLen(count: number): Seed {
    const rng = new SecureRandomNumberGenerator();
    return Seed.newWithLenUsing(count, rng);
  }

  /**
   * Create a new random seed with a specified length using provided RNG.
   *
   * Rust equivalent: `Seed::new_with_len_using(count, rng)`
   *
   * @param count - Number of bytes (must be >= 16)
   * @param rng - Random number generator
   * @throws CryptoError if count < 16
   */
  static newWithLenUsing(count: number, rng: { randomData: (size: number) => Uint8Array }): Seed {
    const data = rng.randomData(count);
    return Seed.newOpt(data, undefined, undefined, undefined);
  }

  /**
   * Create a new seed from data and optional metadata.
   *
   * Rust equivalent: `Seed::new_opt(data, name, note, creation_date)`
   *
   * @param data - Seed bytes (must be >= 16 bytes)
   * @param name - Optional name for the seed
   * @param note - Optional note for the seed
   * @param creationDate - Optional creation date
   * @throws CryptoError if data < 16 bytes
   */
  static newOpt(
    data: Uint8Array,
    name: string | undefined,
    note: string | undefined,
    creationDate: Date | undefined,
  ): Seed {
    return new Seed(data, name, note, creationDate);
  }

  // ============================================================================
  // Static Factory Methods (TypeScript Convenience)
  // ============================================================================

  /**
   * Create a Seed from raw bytes with optional metadata.
   *
   * Note: The input data is copied to prevent external mutation of the seed's internal state.
   *
   * @param data - Seed bytes (must be >= 16 bytes)
   * @param metadata - Optional metadata object
   */
  static from(data: Uint8Array, metadata?: SeedMetadata): Seed {
    return new Seed(new Uint8Array(data), metadata?.name, metadata?.note, metadata?.createdAt);
  }

  /**
   * Create a Seed from hex string with optional metadata.
   *
   * @param hex - Hex string representing seed bytes
   * @param metadata - Optional metadata object
   */
  static fromHex(hex: string, metadata?: SeedMetadata): Seed {
    return Seed.from(hexToBytes(hex), metadata);
  }

  /**
   * Generate a random seed with specified size (default 32 bytes).
   *
   * Convenience method that wraps `newWithLen()`.
   *
   * @param size - Number of bytes (must be >= 16, default 32)
   * @param metadata - Optional metadata object
   */
  static random(size = 32, metadata?: SeedMetadata): Seed {
    const seed = Seed.newWithLen(size);
    if (metadata?.name !== undefined) seed.setName(metadata.name);
    if (metadata?.note !== undefined) seed.setNote(metadata.note);
    if (metadata?.createdAt !== undefined) seed.setCreationDate(metadata.createdAt);
    return seed;
  }

  /**
   * Generate a random seed using provided RNG.
   *
   * Convenience method that wraps `newWithLenUsing()`.
   *
   * @param rng - Random number generator
   * @param size - Number of bytes (must be >= 16, default 32)
   * @param metadata - Optional metadata object
   */
  static randomUsing(
    rng: { randomData: (size: number) => Uint8Array },
    size = 32,
    metadata?: SeedMetadata,
  ): Seed {
    const seed = Seed.newWithLenUsing(size, rng);
    if (metadata?.name !== undefined) seed.setName(metadata.name);
    if (metadata?.note !== undefined) seed.setNote(metadata.note);
    if (metadata?.createdAt !== undefined) seed.setCreationDate(metadata.createdAt);
    return seed;
  }

  // ============================================================================
  // Instance Methods - Data Access (Rust API Parity)
  // ============================================================================

  /**
   * Return the data of the seed as a reference to the internal bytes.
   *
   * Rust equivalent: `seed.as_bytes()`
   *
   * Note: Returns a reference to internal data. For a copy, use `toData()`.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get the raw seed bytes (copy).
   *
   * Note: Returns a copy to prevent external mutation of the seed's internal state.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Get hex string representation.
   */
  toHex(): string {
    return bytesToHex(this._data);
  }

  /**
   * Get base64 representation.
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Get seed size in bytes.
   */
  size(): number {
    return this._data.length;
  }

  // ============================================================================
  // Instance Methods - Metadata Access (Rust API Parity)
  // ============================================================================

  /**
   * Return the name of the seed.
   *
   * Rust equivalent: `seed.name()` - returns empty string if not set.
   */
  name(): string {
    return this._name;
  }

  /**
   * Set the name of the seed.
   *
   * Rust equivalent: `seed.set_name(name)`
   */
  setName(name: string): void {
    this._name = name;
  }

  /**
   * Return the note of the seed.
   *
   * Rust equivalent: `seed.note()` - returns empty string if not set.
   */
  note(): string {
    return this._note;
  }

  /**
   * Set the note of the seed.
   *
   * Rust equivalent: `seed.set_note(note)`
   */
  setNote(note: string): void {
    this._note = note;
  }

  /**
   * Return the creation date of the seed.
   *
   * Rust equivalent: `seed.creation_date()`
   */
  creationDate(): Date | undefined {
    return this._creationDate;
  }

  /**
   * Set the creation date of the seed.
   *
   * Rust equivalent: `seed.set_creation_date(date)`
   */
  setCreationDate(creationDate: Date | undefined): void {
    this._creationDate = creationDate;
  }

  /**
   * Return the creation date of the seed (alias for creationDate).
   *
   * @deprecated Use `creationDate()` for Rust API parity.
   */
  createdAt(): Date | undefined {
    return this.creationDate();
  }

  /**
   * Set the creation date of the seed (alias for setCreationDate).
   *
   * @deprecated Use `setCreationDate()` for Rust API parity.
   */
  setCreatedAt(date: Date): void {
    this.setCreationDate(date);
  }

  /**
   * Get metadata as an object.
   *
   * TypeScript convenience method - returns a snapshot of current metadata.
   */
  getMetadata(): SeedMetadata {
    const metadata: SeedMetadata = {};
    if (this._name.length > 0) {
      metadata.name = this._name;
    }
    if (this._note.length > 0) {
      metadata.note = this._note;
    }
    if (this._creationDate !== undefined) {
      metadata.createdAt = this._creationDate;
    }
    return metadata;
  }

  // ============================================================================
  // Instance Methods - Comparison and Display
  // ============================================================================

  /**
   * Compare with another Seed.
   */
  equals(other: Seed): boolean {
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
    return `Seed(${this.toHex().substring(0, 16)}..., ${this.size()} bytes)`;
  }

  // ============================================================================
  // PrivateKeyDataProvider Implementation
  // ============================================================================

  /**
   * Returns unique data from which cryptographic keys can be derived.
   *
   * This implementation returns a copy of the seed data, which can be used
   * as entropy for deriving private keys in various cryptographic schemes.
   *
   * @returns A Uint8Array containing the seed data
   */
  privateKeyData(): Uint8Array {
    return this.toData();
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with Seed.
   * Includes TAG_SEED (40300) and TAG_SEED_V1 (300) for backward compatibility.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_SEED.value, TAG_SEED_V1.value]);
  }

  /**
   * Returns the untagged CBOR encoding (as a map).
   * Map keys:
   * - 1: seed data (required)
   * - 2: creation date (optional)
   * - 3: name (optional, omitted if empty)
   * - 4: note (optional, omitted if empty)
   */
  untaggedCbor(): Cbor {
    const map = CborMap.new();
    map.insert(1, toByteString(this._data));
    if (this._creationDate !== undefined) {
      const cborDate = CborDate.fromDatetime(this._creationDate);
      map.insert(2, cborDate.taggedCbor());
    }
    if (this._name.length > 0) {
      map.insert(3, this._name);
    }
    if (this._note.length > 0) {
      map.insert(4, this._note);
    }
    return cbor(map);
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
   * Creates a Seed by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): Seed {
    const map = expectMap(cborValue);

    // Key 1: seed data (required)
    // CborMap.extract() returns native types (Uint8Array for byte strings)
    const data = map.extract<number, Uint8Array>(1);
    if (data.length === 0) {
      throw CryptoError.invalidData("Seed data is empty");
    }

    // Key 2: creation date (optional)
    // For tagged values (like dates), the extract returns the tagged Cbor object
    let creationDate: Date | undefined;
    const dateValue = map.get<number, Cbor>(2);
    if (dateValue !== undefined) {
      // The date is stored as a tagged CBOR value (tag 1)
      const cborDate = CborDate.fromTaggedCbor(cbor(dateValue));
      creationDate = cborDate.datetime();
    }

    // Key 3: name (optional)
    const name = map.get<number, string>(3);

    // Key 4: note (optional)
    const note = map.get<number, string>(4);

    return Seed.newOpt(new Uint8Array(data), name, note, creationDate);
  }

  /**
   * Creates a Seed by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): Seed {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): Seed {
    const instance = Seed.new();
    return instance.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): Seed {
    const cborValue = decodeCbor(data);
    return Seed.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): Seed {
    const cborValue = decodeCbor(data);
    const instance = Seed.new();
    return instance.fromUntaggedCbor(cborValue);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the Seed.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("seed", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a Seed from a UR.
   */
  static fromUR(ur: UR): Seed {
    ur.checkType("seed");
    const instance = Seed.new();
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a Seed from a UR string.
   */
  static fromURString(urString: string): Seed {
    const ur = UR.fromURString(urString);
    return Seed.fromUR(ur);
  }
}
