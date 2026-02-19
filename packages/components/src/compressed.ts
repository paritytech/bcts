/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 *
 * A compressed binary object with integrity verification.
 *
 * Ported from bc-components-rust/src/compressed.rs
 *
 * `Compressed` provides a way to efficiently store and transmit binary data
 * using the DEFLATE compression algorithm. It includes built-in integrity
 * verification through a CRC32 checksum and optional cryptographic digest.
 *
 * The compression is implemented using the raw DEFLATE format as described in
 * [IETF RFC 1951](https://www.ietf.org/rfc/rfc1951.txt).
 *
 * Features:
 * - Automatic compression with configurable compression level
 * - Integrity verification via CRC32 checksum
 * - Optional cryptographic digest for content identification
 * - Smart behavior for small data (stores decompressed if compression would
 *   increase size)
 * - CBOR serialization/deserialization support
 *
 * @example
 * ```typescript
 * import { Compressed } from '@bcts/components';
 *
 * // Compress a string
 * const data = new TextEncoder().encode(
 *   "This is a longer string that should compress well with repeated patterns."
 * );
 * const compressed = Compressed.fromDecompressedData(data);
 *
 * // The compressed size should be smaller than the original
 * console.log(compressed.compressionRatio()); // < 1.0
 *
 * // We can recover the original data
 * const decompressed = compressed.decompress();
 * ```
 */

import { deflate, inflate } from "pako";
import { crc32 } from "@bcts/crypto";
import {
  type Cbor,
  type Tag,
  type CborInput,
  type CborTaggedEncodable,
  type CborTaggedDecodable,
  cbor,
  toByteString,
  createTaggedCbor,
  validateTag,
  extractTaggedContent,
  decodeCbor,
  tagsForValues,
  expectArray,
  expectInteger,
  expectBytes,
} from "@bcts/dcbor";
import { COMPRESSED as TAG_COMPRESSED } from "@bcts/tags";
import { Digest } from "./digest.js";
import type { DigestProvider } from "./digest-provider.js";
import { CryptoError } from "./error.js";
import { bytesToHex } from "./utils.js";

/**
 * A compressed binary object with integrity verification.
 *
 * Uses DEFLATE compression with CRC32 checksums for integrity verification.
 * Optionally includes a cryptographic digest for content identification.
 */
export class Compressed
  implements CborTaggedEncodable, CborTaggedDecodable<Compressed>, DigestProvider
{
  /** CRC32 checksum of the decompressed data for integrity verification */
  private readonly _checksum: number;
  /** Size of the original decompressed data in bytes */
  private readonly _decompressedSize: number;
  /** The compressed data (or original data if compression is ineffective) */
  private readonly _compressedData: Uint8Array;
  /** Optional cryptographic digest of the content */
  private readonly _digest: Digest | undefined;

  private constructor(
    checksum: number,
    decompressedSize: number,
    compressedData: Uint8Array,
    digest?: Digest,
  ) {
    if (compressedData.length > decompressedSize) {
      throw CryptoError.cryptoOperation("compressed data is larger than decompressed size");
    }
    this._checksum = checksum;
    this._decompressedSize = decompressedSize;
    this._compressedData = new Uint8Array(compressedData);
    this._digest = digest;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Creates a new `Compressed` object with the specified parameters.
   *
   * This is a low-level constructor that allows direct creation of a
   * `Compressed` object without performing compression. It's primarily
   * intended for deserialization or when working with pre-compressed data.
   *
   * @param checksum - CRC32 checksum of the decompressed data
   * @param decompressedSize - Size of the original decompressed data in bytes
   * @param compressedData - The compressed data bytes
   * @param digest - Optional cryptographic digest of the content
   * @returns A new `Compressed` object
   * @throws CryptoError if the compressed data is larger than the decompressed size
   */
  static new(
    checksum: number,
    decompressedSize: number,
    compressedData: Uint8Array,
    digest?: Digest,
  ): Compressed {
    return new Compressed(checksum, decompressedSize, compressedData, digest);
  }

  /**
   * Creates a new `Compressed` object by compressing the provided data.
   *
   * This is the primary method for creating compressed data. It automatically
   * handles compression using the DEFLATE algorithm with compression level 6.
   *
   * If the compressed data would be larger than the original data (which can
   * happen with small or already compressed inputs), the original data is
   * stored instead.
   *
   * @param decompressedData - The original data to compress
   * @param digest - Optional cryptographic digest of the content
   * @returns A new `Compressed` object containing the compressed (or original) data
   */
  static fromDecompressedData(decompressedData: Uint8Array, digest?: Digest): Compressed {
    // Use raw DEFLATE compression (level 6 is default)
    const compressedData = deflate(decompressedData, { level: 6 });
    const checksum = crc32(decompressedData);
    const decompressedSize = decompressedData.length;
    const compressedSize = compressedData.length;

    // If compression didn't help, store original data
    if (compressedSize !== 0 && compressedSize < decompressedSize) {
      return new Compressed(checksum, decompressedSize, compressedData, digest);
    } else {
      return new Compressed(checksum, decompressedSize, new Uint8Array(decompressedData), digest);
    }
  }

  // ============================================================================
  // Instance Methods
  // ============================================================================

  /**
   * Decompresses and returns the original decompressed data.
   *
   * This method performs the reverse of the compression process, restoring
   * the original data. It also verifies the integrity of the data using the
   * stored checksum.
   *
   * @returns The decompressed data
   * @throws CryptoError if the compressed data is corrupt or checksum doesn't match
   */
  decompress(): Uint8Array {
    const compressedSize = this._compressedData.length;

    // If data wasn't actually compressed (sizes equal), return as-is
    if (compressedSize >= this._decompressedSize) {
      return new Uint8Array(this._compressedData);
    }

    try {
      const decompressedData = inflate(this._compressedData);

      // Verify checksum
      if (crc32(decompressedData) !== this._checksum) {
        throw CryptoError.cryptoOperation("compressed data checksum mismatch");
      }

      return decompressedData;
    } catch (e) {
      if (e instanceof CryptoError) throw e;
      throw CryptoError.cryptoOperation("corrupt compressed data");
    }
  }

  /**
   * Returns the size of the compressed data in bytes.
   */
  compressedSize(): number {
    return this._compressedData.length;
  }

  /**
   * Returns the size of the decompressed data in bytes.
   */
  decompressedSize(): number {
    return this._decompressedSize;
  }

  /**
   * Returns the CRC32 checksum of the decompressed data.
   */
  checksum(): number {
    return this._checksum;
  }

  /**
   * Returns the compression ratio of the data.
   *
   * The compression ratio is calculated as (compressed size) / (decompressed size),
   * so lower values indicate better compression.
   *
   * @returns A floating-point value representing the compression ratio.
   * - Values less than 1.0 indicate effective compression
   * - Values equal to 1.0 indicate no compression was applied
   * - Values of NaN can occur if the decompressed size is zero
   */
  compressionRatio(): number {
    return this._compressedData.length / this._decompressedSize;
  }

  /**
   * Returns the digest of the compressed data, if available.
   *
   * @returns The `Digest` associated with this compressed data, or undefined if none.
   */
  digestOpt(): Digest | undefined {
    return this._digest;
  }

  /**
   * Returns whether this compressed data has an associated digest.
   */
  hasDigest(): boolean {
    return this._digest !== undefined;
  }

  // ============================================================================
  // DigestProvider implementation
  // ============================================================================

  /**
   * Returns the cryptographic digest associated with this compressed data.
   *
   * @returns A `Digest`
   * @throws Error if there is no digest associated with this compressed data
   */
  digest(): Digest {
    if (this._digest === undefined) {
      throw new Error("No digest associated with this compressed data");
    }
    return this._digest;
  }

  // ============================================================================
  // Comparison and String representation
  // ============================================================================

  /**
   * Compare with another Compressed.
   */
  equals(other: Compressed): boolean {
    if (this._checksum !== other._checksum) return false;
    if (this._decompressedSize !== other._decompressedSize) return false;
    if (this._compressedData.length !== other._compressedData.length) return false;
    for (let i = 0; i < this._compressedData.length; i++) {
      if (this._compressedData[i] !== other._compressedData[i]) return false;
    }
    // Don't compare digests for equality
    return true;
  }

  /**
   * Get string representation.
   */
  toString(): string {
    const checksumHex = bytesToHex(
      new Uint8Array([
        (this._checksum >>> 24) & 0xff,
        (this._checksum >>> 16) & 0xff,
        (this._checksum >>> 8) & 0xff,
        this._checksum & 0xff,
      ]),
    );
    const digestStr = this._digest?.shortDescription() ?? "None";
    return `Compressed(checksum: ${checksumHex}, size: ${this.compressedSize()}/${this._decompressedSize}, ratio: ${this.compressionRatio().toFixed(2)}, digest: ${digestStr})`;
  }

  // ============================================================================
  // CBOR Serialization (CborTaggedEncodable)
  // ============================================================================

  /**
   * Returns the CBOR tags associated with Compressed.
   */
  cborTags(): Tag[] {
    return tagsForValues([TAG_COMPRESSED.value]);
  }

  /**
   * Returns the untagged CBOR encoding (as an array).
   *
   * Format:
   * ```
   * [
   *   checksum: uint,
   *   decompressed_size: uint,
   *   compressed_data: bytes,
   *   digest?: Digest  // Optional
   * ]
   * ```
   */
  untaggedCbor(): Cbor {
    const elements: CborInput[] = [
      this._checksum >>> 0, // Ensure unsigned 32-bit
      this._decompressedSize,
      toByteString(this._compressedData),
    ];
    if (this._digest !== undefined) {
      elements.push(this._digest.taggedCbor());
    }
    return cbor(elements);
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
   * Creates a Compressed by decoding it from untagged CBOR.
   */
  fromUntaggedCbor(cborValue: Cbor): Compressed {
    const elements = expectArray(cborValue);
    if (elements.length < 3 || elements.length > 4) {
      throw CryptoError.invalidData("invalid number of elements in compressed");
    }

    const checksum = expectInteger(elements[0]);
    const decompressedSize = expectInteger(elements[1]);
    const compressedData = expectBytes(elements[2]);

    let digest: Digest | undefined;
    if (elements.length === 4) {
      digest = Digest.fromTaggedCbor(elements[3]);
    }

    return Compressed.new(Number(checksum), Number(decompressedSize), compressedData, digest);
  }

  /**
   * Creates a Compressed by decoding it from tagged CBOR.
   */
  fromTaggedCbor(cborValue: Cbor): Compressed {
    validateTag(cborValue, this.cborTags());
    const content = extractTaggedContent(cborValue);
    return this.fromUntaggedCbor(content);
  }

  /**
   * Static method to decode from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): Compressed {
    const instance = Compressed.fromDecompressedData(new Uint8Array(0));
    return instance.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from tagged CBOR binary data.
   */
  static fromTaggedCborData(data: Uint8Array): Compressed {
    const cborValue = decodeCbor(data);
    return Compressed.fromTaggedCbor(cborValue);
  }

  /**
   * Static method to decode from untagged CBOR binary data.
   */
  static fromUntaggedCborData(data: Uint8Array): Compressed {
    const cborValue = decodeCbor(data);
    const instance = Compressed.fromDecompressedData(new Uint8Array(0));
    return instance.fromUntaggedCbor(cborValue);
  }
}
