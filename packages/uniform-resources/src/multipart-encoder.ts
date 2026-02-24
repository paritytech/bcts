/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 */

import type { UR } from "./ur.js";
import { URError } from "./error.js";
import { FountainEncoder, type FountainPart } from "./fountain.js";
import { encodeBytewords, BytewordsStyle } from "./utils.js";
import { cbor } from "@bcts/dcbor";

/**
 * Encodes a UR as multiple parts using fountain codes.
 *
 * This allows large CBOR structures to be split into multiple UR strings
 * that can be transmitted separately and reassembled. The encoder uses
 * fountain codes for resilient transmission over lossy channels.
 *
 * For single-part URs (small payloads), use the regular UR.string() method.
 *
 * @example
 * ```typescript
 * const ur = UR.new('bytes', cbor);
 * const encoder = new MultipartEncoder(ur, 100);
 *
 * // Generate all pure parts
 * while (!encoder.isComplete()) {
 *   const part = encoder.nextPart();
 *   console.log(part); // "ur:bytes/1-10/..."
 * }
 *
 * // Generate additional rateless parts for redundancy
 * for (let i = 0; i < 5; i++) {
 *   const part = encoder.nextPart();
 *   console.log(part); // "ur:bytes/11-10/..."
 * }
 * ```
 */
export class MultipartEncoder {
  private readonly _ur: UR;
  private readonly _fountainEncoder: FountainEncoder;
  private _currentIndex = 0;

  /**
   * Creates a new multipart encoder for the given UR.
   *
   * @param ur - The UR to encode
   * @param maxFragmentLen - Maximum length of each fragment in bytes
   * @throws {URError} If encoding fails
   *
   * @example
   * ```typescript
   * const encoder = new MultipartEncoder(ur, 100);
   * ```
   */
  constructor(ur: UR, maxFragmentLen: number) {
    if (maxFragmentLen < 1) {
      throw new URError("Max fragment length must be at least 1");
    }
    this._ur = ur;

    // Create fountain encoder from CBOR data
    const cborData = ur.cbor().toData();
    this._fountainEncoder = new FountainEncoder(cborData, maxFragmentLen);
  }

  /**
   * Gets the next part of the encoding.
   *
   * Parts 1 through seqLen are "pure" fragments containing one piece each.
   * Parts beyond seqLen are "mixed" fragments using fountain codes for redundancy.
   *
   * @returns The next UR string part
   *
   * @example
   * ```typescript
   * const part = encoder.nextPart();
   * // Returns: "ur:bytes/1-3/lsadaoaxjygonesw"
   * ```
   */
  nextPart(): string {
    const part = this._fountainEncoder.nextPart();
    this._currentIndex++;
    return this._encodePart(part);
  }

  /**
   * Encodes a fountain part as a UR string.
   */
  private _encodePart(part: FountainPart): string {
    // For single-part messages, use simple format
    if (part.seqLen === 1) {
      return this._ur.string();
    }

    // Encode the part data as CBOR: [seqNum, seqLen, messageLen, checksum, data]
    // Using a simple format: seqNum-seqLen prefix followed by bytewords-encoded part
    const partData = this._encodePartData(part);
    const encoded = encodeBytewords(partData, BytewordsStyle.Minimal);

    return `ur:${this._ur.urTypeStr()}/${part.seqNum}-${part.seqLen}/${encoded}`;
  }

  /**
   * Encodes part metadata and data as CBOR for bytewords encoding.
   * Format: CBOR array [seqNum, seqLen, messageLen, checksum, data]
   */
  private _encodePartData(part: FountainPart): Uint8Array {
    // Create CBOR array with 5 elements: [seqNum, seqLen, messageLen, checksum, data]
    const cborArray = cbor([part.seqNum, part.seqLen, part.messageLen, part.checksum, part.data]);

    return cborArray.toData();
  }

  /**
   * Gets the current part index.
   */
  currentIndex(): number {
    return this._currentIndex;
  }

  /**
   * Gets the total number of pure parts.
   *
   * Note: Fountain codes can generate unlimited parts beyond this count
   * for additional redundancy.
   */
  partsCount(): number {
    return this._fountainEncoder.seqLen;
  }
}
