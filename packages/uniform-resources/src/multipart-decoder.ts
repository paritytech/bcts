import { decodeCbor, MajorType, type Cbor } from "@bcts/dcbor";
import { InvalidSchemeError, InvalidTypeError, UnexpectedTypeError, URError } from "./error.js";
import { UR } from "./ur.js";
import { URType } from "./ur-type.js";
import { FountainDecoder, type FountainPart } from "./fountain.js";
import { decodeBytewords, BytewordsStyle } from "./utils.js";

/**
 * Decodes multiple UR parts back into a single UR.
 *
 * This reassembles multipart URs that were encoded using fountain codes.
 * The decoder can handle out-of-order reception and packet loss.
 *
 * @example
 * ```typescript
 * const decoder = new MultipartDecoder();
 *
 * for (const urPart of urParts) {
 *   decoder.receive(urPart);
 *   if (decoder.isComplete()) {
 *     const ur = decoder.message();
 *     break;
 *   }
 * }
 * ```
 */
export class MultipartDecoder {
  private _urType: URType | null = null;
  private _fountainDecoder: FountainDecoder | null = null;
  private _decodedMessage: UR | null = null;

  /**
   * Receives a UR part string.
   *
   * @param part - A UR part string (e.g., "ur:bytes/1-10/..." or "ur:bytes/...")
   * @throws {InvalidSchemeError} If the part doesn't start with "ur:"
   * @throws {UnexpectedTypeError} If the type doesn't match previous parts
   */
  receive(part: string): void {
    const { urType, partInfo } = this._parsePart(part);

    // Validate type consistency
    if (this._urType === null) {
      this._urType = urType;
    } else if (!this._urType.equals(urType)) {
      throw new UnexpectedTypeError(this._urType.string(), urType.string());
    }

    // Handle the part
    if (partInfo.isSinglePart) {
      // Single-part UR - decode immediately
      this._decodedMessage = UR.fromURString(part);
    } else {
      // Multipart UR - use fountain decoder
      this._fountainDecoder ??= new FountainDecoder();

      const fountainPart = this._decodeFountainPart(partInfo);
      this._fountainDecoder.receive(fountainPart);

      // Try to get the complete message
      if (this._fountainDecoder.isComplete()) {
        const message = this._fountainDecoder.message();
        if (message !== null) {
          const cbor = decodeCbor(message);
          this._decodedMessage = UR.new(this._urType, cbor);
        }
      }
    }
  }

  /**
   * Parses a UR part string to extract type and part info.
   */
  private _parsePart(part: string): { urType: URType; partInfo: PartInfo } {
    const lowercased = part.toLowerCase();

    if (!lowercased.startsWith("ur:")) {
      throw new InvalidSchemeError();
    }

    const afterScheme = lowercased.substring(3);
    const components = afterScheme.split("/");

    if (components.length === 0 || components[0] === "") {
      throw new InvalidTypeError();
    }

    const urType = new URType(components[0]);

    // Check if this is a multipart UR (format: type/seqNum-seqLen/data)
    if (components.length >= 3) {
      const seqPart = components[1];
      const seqMatch = /^(\d+)-(\d+)$/.exec(seqPart);

      if (seqMatch !== null) {
        const seqNum = parseInt(seqMatch[1], 10);
        const seqLen = parseInt(seqMatch[2], 10);
        const encodedData = components.slice(2).join("/");

        return {
          urType,
          partInfo: {
            isSinglePart: false,
            seqNum,
            seqLen,
            encodedData,
          },
        };
      }
    }

    // Single-part UR
    return {
      urType,
      partInfo: { isSinglePart: true },
    };
  }

  /**
   * Decodes a multipart UR's fountain part data.
   *
   * The multipart body is a CBOR array: [seqNum, seqLen, messageLen, checksum, data]
   */
  private _decodeFountainPart(partInfo: MultipartInfo): FountainPart {
    // Decode bytewords to get CBOR data
    const cborData = decodeBytewords(partInfo.encodedData, BytewordsStyle.Minimal);

    // Decode the CBOR array
    const decoded = decodeCbor(cborData);

    // The decoded value should be an array with 5 elements
    if (decoded.type !== MajorType.Array) {
      throw new URError("Invalid multipart data: expected CBOR array");
    }

    const items = decoded.value as Cbor[];
    if (items.length !== 5) {
      throw new URError(`Invalid multipart data: expected 5 elements, got ${items.length}`);
    }

    // Extract the fields: [seqNum, seqLen, messageLen, checksum, data]
    const seqNum = Number(items[0].value);
    const seqLen = Number(items[1].value);
    const messageLen = Number(items[2].value);
    const checksum = Number(items[3].value);
    const data = items[4].value as Uint8Array;

    // Verify seqNum and seqLen match the URL path values
    if (seqNum !== partInfo.seqNum || seqLen !== partInfo.seqLen) {
      throw new URError(
        `Multipart metadata mismatch: URL says ${partInfo.seqNum}-${partInfo.seqLen}, CBOR says ${seqNum}-${seqLen}`,
      );
    }

    return {
      seqNum,
      seqLen,
      messageLen,
      checksum,
      data,
    };
  }

  /**
   * Checks if the message is complete.
   */
  isComplete(): boolean {
    return this._decodedMessage !== null;
  }

  /**
   * Gets the decoded UR message.
   *
   * @returns The decoded UR, or null if not yet complete
   */
  message(): UR | null {
    return this._decodedMessage;
  }
}

/**
 * Part info for single-part URs.
 */
interface SinglePartInfo {
  isSinglePart: true;
}

/**
 * Part info for multipart URs.
 */
interface MultipartInfo {
  isSinglePart: false;
  seqNum: number;
  seqLen: number;
  encodedData: string;
}

type PartInfo = SinglePartInfo | MultipartInfo;
