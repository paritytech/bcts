/**
 * PlaintextContent — wraps a DecryptionErrorMessage for plaintext delivery.
 *
 * Reference: libsignal/rust/protocol/src/protocol.rs:742-804
 */

import { InvalidMessageError } from "../error.js";
import { encodeVarint, decodeVarint } from "./proto.js";
import {
  CiphertextMessageType,
  type CiphertextMessage,
  type CiphertextMessageConvertible,
} from "./ciphertext-message.js";

const PLAINTEXT_VERSION = 8;

function fieldTag(fieldNumber: number, wireType: number): Uint8Array {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeBytes(fieldNumber: number, value: Uint8Array): Uint8Array {
  const tag = fieldTag(fieldNumber, 2);
  const len = encodeVarint(value.length);
  const result = new Uint8Array(tag.length + len.length + value.length);
  result.set(tag, 0);
  result.set(len, tag.length);
  result.set(value, tag.length + len.length);
  return result;
}

export class PlaintextContent implements CiphertextMessageConvertible {
  readonly body: Uint8Array;
  readonly serialized: Uint8Array;

  private constructor(body: Uint8Array, serialized: Uint8Array) {
    this.body = body;
    this.serialized = serialized;
  }

  /**
   * Create from inner content bytes (e.g., a serialized DecryptionErrorMessage).
   */
  static create(body: Uint8Array): PlaintextContent {
    const protoEncoded = encodeBytes(1, body);
    const versionByte = ((PLAINTEXT_VERSION & 0xf) << 4) | PLAINTEXT_VERSION;
    const serialized = new Uint8Array(1 + protoEncoded.length);
    serialized[0] = versionByte;
    serialized.set(protoEncoded, 1);
    return new PlaintextContent(body, serialized);
  }

  /**
   * Deserialize from wire bytes.
   */
  static deserialize(data: Uint8Array): PlaintextContent {
    if (data.length < 2) {
      throw new InvalidMessageError("PlaintextContent too short");
    }

    // Skip version byte, parse protobuf
    const protoData = data.slice(1);
    let offset = 0;
    let body: Uint8Array | undefined;

    while (offset < protoData.length) {
      const [tagValue, nextOffset] = decodeVarint(protoData, offset);
      offset = nextOffset;
      const fieldNumber = tagValue >>> 3;
      const wireType = tagValue & 0x7;
      if (wireType === 2) {
        const [len, lenOffset] = decodeVarint(protoData, offset);
        offset = lenOffset;
        const value = protoData.slice(offset, offset + len);
        offset += len;
        if (fieldNumber === 1) body = value;
      } else if (wireType === 0) {
        const [, newOffset] = decodeVarint(protoData, offset);
        offset = newOffset;
      } else {
        throw new InvalidMessageError(`Unsupported wire type: ${wireType}`);
      }
    }

    if (body == null) {
      throw new InvalidMessageError("Missing body in PlaintextContent");
    }

    return new PlaintextContent(body, Uint8Array.from(data));
  }

  /**
   * Return this message wrapped as a CiphertextMessage with type Plaintext.
   * Matches libsignal's CiphertextMessageConvertible interface.
   */
  asCiphertextMessage(): CiphertextMessage {
    return { type: CiphertextMessageType.Plaintext, message: this };
  }
}
