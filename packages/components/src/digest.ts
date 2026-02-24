/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * SHA-256 cryptographic digest (32 bytes)
 *
 * Ported from bc-components-rust/src/digest.rs
 *
 * A `Digest` represents the cryptographic hash of some data. In this
 * implementation, SHA-256 is used, which produces a 32-byte hash value.
 * Digests are used throughout the crate for data verification and as unique
 * identifiers derived from data.
 *
 * # CBOR Serialization
 *
 * `Digest` implements the CBOR tagged encoding interfaces, which means it can be
 * serialized to and deserialized from CBOR with a specific tag (TAG_DIGEST = 40001).
 *
 * # UR Serialization
 *
 * When serialized as a Uniform Resource (UR), a `Digest` is represented as a
 * binary blob with the type "digest".
 *
 * @example
 * ```typescript
 * import { Digest } from '@bcts/components';
 *
 * // Create a digest from a string
 * const data = new TextEncoder().encode("hello world");
 * const digest = Digest.fromImage(data);
 *
 * // Validate that the digest matches the original data
 * console.log(digest.validate(data)); // true
 *
 * // Create a digest from a hex string
 * const hexString = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
 * const digest2 = Digest.fromHex(hexString);
 *
 * // Retrieve the digest as hex
 * console.log(digest2.hex()); // b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
 * ```
 */

import { sha256, SHA256_SIZE } from "@bcts/crypto";
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
import { DIGEST as TAG_DIGEST } from "@bcts/tags";
import { UR, type UREncodable } from "@bcts/uniform-resources";
import { CryptoError } from "./error.js";
import { bytesToHex, hexToBytes, toBase64 } from "./utils.js";
import type { DigestProvider } from "./digest-provider.js";

export class Digest
  implements DigestProvider, CborTaggedEncodable, CborTaggedDecodable<Digest>, UREncodable
{
  static readonly DIGEST_SIZE = SHA256_SIZE;

  private readonly _data: Uint8Array;

  private constructor(data: Uint8Array) {
    if (data.length !== Digest.DIGEST_SIZE) {
      throw CryptoError.invalidSize(Digest.DIGEST_SIZE, data.length);
    }
    this._data = new Uint8Array(data);
  }

  /**
   * Get the digest data.
   */
  data(): Uint8Array {
    return this._data;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create a Digest from a 32-byte array.
   */
  static fromData(data: Uint8Array): Digest {
    return new Digest(new Uint8Array(data));
  }

  /**
   * Create a Digest from data, validating the length.
   * Alias for fromData for compatibility with Rust API.
   */
  static fromDataRef(data: Uint8Array): Digest {
    return Digest.fromData(data);
  }

  /**
   * Create a Digest from hex string.
   *
   * @throws Error if the hex string is not exactly 64 characters.
   */
  static fromHex(hex: string): Digest {
    return new Digest(hexToBytes(hex));
  }

  /**
   * Compute SHA-256 digest of data (called "image" in Rust).
   *
   * @param image - The data to hash
   */
  static fromImage(image: Uint8Array): Digest {
    const hashData = sha256(image);
    return new Digest(new Uint8Array(hashData));
  }

  /**
   * Compute SHA-256 digest from multiple data parts.
   *
   * The parts are concatenated and then hashed.
   *
   * @param imageParts - Array of byte arrays to concatenate and hash
   */
  static fromImageParts(imageParts: Uint8Array[]): Digest {
    const totalLength = imageParts.reduce((sum, part) => sum + part.length, 0);
    const buf = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of imageParts) {
      buf.set(part, offset);
      offset += part.length;
    }
    return Digest.fromImage(buf);
  }

  /**
   * Compute SHA-256 digest from an array of Digests.
   *
   * The digest bytes are concatenated and then hashed.
   *
   * @param digests - Array of Digests to combine
   */
  static fromDigests(digests: Digest[]): Digest {
    const buf = new Uint8Array(digests.length * Digest.DIGEST_SIZE);
    let offset = 0;
    for (const digest of digests) {
      buf.set(digest._data, offset);
      offset += Digest.DIGEST_SIZE;
    }
    return Digest.fromImage(buf);
  }

  /**
   * Compute SHA-256 digest of data (legacy alias for fromImage).
   * @deprecated Use fromImage instead
   */
  static hash(data: Uint8Array): Digest {
    return Digest.fromImage(data);
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Get the raw digest bytes as a copy.
   */
  toData(): Uint8Array {
    return new Uint8Array(this._data);
  }

  /**
   * Get a reference to the raw digest bytes.
   */
  asBytes(): Uint8Array {
    return this._data;
  }

  /**
   * Get hex string representation.
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
   * Get base64 representation.
   */
  toBase64(): string {
    return toBase64(this._data);
  }

  /**
   * Get the first four bytes of the digest as a hexadecimal string.
   * Useful for short descriptions.
   */
  shortDescription(): string {
    return bytesToHex(this._data.slice(0, 4));
  }

  /**
   * Validate the digest against the given image.
   *
   * The image is hashed with SHA-256 and compared to this digest.
   * @returns `true` if the digest matches the image.
   */
  validate(image: Uint8Array): boolean {
    return this.equals(Digest.fromImage(image));
  }

  /**
   * Compare with another Digest.
   */
  equals(other: Digest): boolean {
    if (this._data.length !== other._data.length) return false;
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i] !== other._data[i]) return false;
    }
    return true;
  }

  /**
   * Compare digests lexicographically.
   */
  compare(other: Digest): number {
    for (let i = 0; i < this._data.length; i++) {
      const a = this._data[i];
      const b = other._data[i];
      if (a < b) return -1;
      if (a > b) return 1;
    }
    return 0;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    return `Digest(${this.hex()})`;
  }

  // ============================================================================
  // DigestProvider Implementation
  // ============================================================================

  /**
   * A Digest is its own digest provider - returns itself.
   */
  digest(): Digest {
    return this;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with Digest.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_DIGEST.value]);
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
   * Creates a Digest by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cbor: Cbor): Digest {
    const data = expectBytes(cbor);
    return Digest.fromData(data);
  }

  /**
   * Creates a Digest by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cbor: Cbor): Digest {
    validateTag(cbor, this.cborTags());
    const content = extractTaggedContent(cbor);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cbor: Cbor): Digest {
    const instance = new Digest(new Uint8Array(Digest.DIGEST_SIZE));
    return instance.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): Digest {
    const cbor = decodeCbor(data);
    return Digest.fromTaggedCbor(cbor);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): Digest {
    const cbor = decodeCbor(data);
    const bytes = expectBytes(cbor);
    return Digest.fromData(bytes);
  }

  // ============================================================================
  // UR Serialization (UREncodable)
  // ============================================================================

  /**
   * Returns the UR representation of the Digest.
   * Note: URs use untagged CBOR since the type is conveyed by the UR type itself.
   */
  ur(): UR {
    return UR.new("digest", this.untaggedCbor());
  }

  /**
   * Returns the UR string representation.
   */
  urString(): string {
    return this.ur().string();
  }

  /**
   * Creates a Digest from a UR.
   */
  static fromUR(ur: UR): Digest {
    ur.checkType("digest");
    const instance = new Digest(new Uint8Array(Digest.DIGEST_SIZE));
    return instance.fromUntaggedCbor(ur.cbor());
  }

  /**
   * Creates a Digest from a UR string.
   */
  static fromURString(urString: string): Digest {
    const ur = UR.fromURString(urString);
    return Digest.fromUR(ur);
  }

  // ============================================================================
  // Static Utility Methods
  // ============================================================================

  /**
   * Validate the given data against the digest, if any.
   *
   * Returns `true` if the digest is `undefined` or if the digest matches the
   * image's digest. Returns `false` if the digest does not match.
   */
  static validateOpt(image: Uint8Array, digest: Digest | undefined): boolean {
    if (digest === undefined) {
      return true;
    }
    return digest.validate(image);
  }
}
