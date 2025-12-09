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

const MIN_SEED_SIZE = 16;

export interface SeedMetadata {
  name?: string;
  note?: string;
  createdAt?: Date;
}

export class Seed implements CborTaggedEncodable, CborTaggedDecodable<Seed>, UREncodable {
  // Defensive copy: internal data is never exposed directly to prevent external mutation
  private readonly data: Uint8Array;
  private metadata: SeedMetadata | undefined;

  private constructor(data: Uint8Array, metadata?: SeedMetadata) {
    if (data.length < MIN_SEED_SIZE) {
      throw CryptoError.invalidSize(MIN_SEED_SIZE, data.length);
    }
    // Defensive copy on construction to ensure immutability of internal state
    this.data = new Uint8Array(data);
    this.metadata = metadata;
  }

  /**
   * Create a Seed from raw bytes.
   *
   * Note: The input data is copied to prevent external mutation of the seed's internal state.
   */
  static from(data: Uint8Array, metadata?: SeedMetadata): Seed {
    return new Seed(new Uint8Array(data), metadata);
  }

  /**
   * Create a Seed from hex string
   */
  static fromHex(hex: string, metadata?: SeedMetadata): Seed {
    return new Seed(hexToBytes(hex), metadata);
  }

  /**
   * Generate a random seed with specified size
   */
  static random(size = 32, metadata?: SeedMetadata): Seed {
    if (size < MIN_SEED_SIZE) {
      throw CryptoError.invalidSize(MIN_SEED_SIZE, size);
    }
    const rng = new SecureRandomNumberGenerator();
    return new Seed(rng.randomData(size), metadata);
  }

  /**
   * Generate a random seed using provided RNG
   */
  static randomUsing(rng: SecureRandomNumberGenerator, size = 32, metadata?: SeedMetadata): Seed {
    if (size < MIN_SEED_SIZE) {
      throw CryptoError.invalidSize(MIN_SEED_SIZE, size);
    }
    return new Seed(rng.randomData(size), metadata);
  }

  /**
   * Get the raw seed bytes.
   *
   * Note: Returns a copy to prevent external mutation of the seed's internal state.
   */
  toData(): Uint8Array {
    return new Uint8Array(this.data);
  }

  /**
   * Get hex string representation
   */
  toHex(): string {
    return bytesToHex(this.data);
  }

  /**
   * Get base64 representation
   */
  toBase64(): string {
    return toBase64(this.data);
  }

  /**
   * Get seed size in bytes
   */
  size(): number {
    return this.data.length;
  }

  /**
   * Get name
   */
  name(): string | undefined {
    return this.metadata?.name;
  }

  /**
   * Set name
   */
  setName(name: string): void {
    this.metadata ??= {};
    this.metadata.name = name;
  }

  /**
   * Get note
   */
  note(): string | undefined {
    return this.metadata?.note;
  }

  /**
   * Set note
   */
  setNote(note: string): void {
    this.metadata ??= {};
    this.metadata.note = note;
  }

  /**
   * Get creation date
   */
  createdAt(): Date | undefined {
    return this.metadata?.createdAt;
  }

  /**
   * Set creation date
   */
  setCreatedAt(date: Date): void {
    this.metadata ??= {};
    this.metadata.createdAt = date;
  }

  /**
   * Get metadata
   */
  getMetadata(): SeedMetadata | undefined {
    return this.metadata !== undefined ? { ...this.metadata } : undefined;
  }

  /**
   * Compare with another Seed
   */
  equals(other: Seed): boolean {
    if (this.data.length !== other.data.length) return false;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] !== other.data[i]) return false;
    }
    return true;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return `Seed(${this.toHex().substring(0, 16)}..., ${this.size()} bytes)`;
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
    map.insert(1, toByteString(this.data));
    if (this.metadata?.createdAt !== undefined) {
      const cborDate = CborDate.fromDatetime(this.metadata.createdAt);
      map.insert(2, cborDate.taggedCbor());
    }
    if (this.metadata?.name !== undefined && this.metadata.name.length > 0) {
      map.insert(3, this.metadata.name);
    }
    if (this.metadata?.note !== undefined && this.metadata.note.length > 0) {
      map.insert(4, this.metadata.note);
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
    let createdAt: Date | undefined;
    const dateValue = map.get<number, Cbor>(2);
    if (dateValue !== undefined) {
      // The date is stored as a tagged CBOR value (tag 1)
      const cborDate = CborDate.fromTaggedCbor(cbor(dateValue));
      createdAt = cborDate.datetime();
    }

    // Key 3: name (optional)
    const name = map.get<number, string>(3);

    // Key 4: note (optional)
    const note = map.get<number, string>(4);

    const metadata: SeedMetadata | undefined =
      name !== undefined || note !== undefined || createdAt !== undefined
        ? { name: name ?? undefined, note: note ?? undefined, createdAt }
        : undefined;

    return Seed.from(new Uint8Array(data), metadata);
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
  static fromTaggedCbor(cbor: Cbor): Seed {
    const instance = Seed.random(MIN_SEED_SIZE);
    return instance.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): Seed {
    const cbor = decodeCbor(data);
    return Seed.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): Seed {
    const cbor = decodeCbor(data);
    const instance = Seed.random(MIN_SEED_SIZE);
    return instance.fromUntaggedCbor(cbor);
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
    const instance = Seed.random(MIN_SEED_SIZE);
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
