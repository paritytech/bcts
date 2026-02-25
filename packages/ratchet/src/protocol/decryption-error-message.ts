/**
 * DecryptionErrorMessage — notifies sender of decryption failure.
 *
 * Reference: libsignal/rust/protocol/src/protocol.rs:806-916
 */

import { InvalidMessageError } from "../error.js";
import { encodeVarint, decodeVarint } from "./proto.js";

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

function encodeUint32(fieldNumber: number, value: number): Uint8Array {
  const tag = fieldTag(fieldNumber, 0);
  const val = encodeVarint(value);
  const result = new Uint8Array(tag.length + val.length);
  result.set(tag, 0);
  result.set(val, tag.length);
  return result;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const a of arrays) totalLen += a.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

interface DecryptionErrorProto {
  ratchetKey?: Uint8Array;
  timestamp?: number;
  deviceId?: number;
}

function encodeDecryptionError(msg: DecryptionErrorProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (msg.ratchetKey) parts.push(encodeBytes(1, msg.ratchetKey));
  if (msg.timestamp !== undefined) parts.push(encodeUint32(2, msg.timestamp));
  if (msg.deviceId !== undefined) parts.push(encodeUint32(3, msg.deviceId));
  return concatBytes(...parts);
}

function decodeDecryptionError(data: Uint8Array): DecryptionErrorProto {
  const msg: DecryptionErrorProto = {};
  let offset = 0;
  while (offset < data.length) {
    const [tagValue, nextOffset] = decodeVarint(data, offset);
    offset = nextOffset;
    const fieldNumber = tagValue >>> 3;
    const wireType = tagValue & 0x7;
    if (wireType === 0) {
      const [value, newOffset] = decodeVarint(data, offset);
      offset = newOffset;
      if (fieldNumber === 2) msg.timestamp = value;
      else if (fieldNumber === 3) msg.deviceId = value;
    } else if (wireType === 2) {
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      if (fieldNumber === 1) msg.ratchetKey = value;
    } else {
      throw new InvalidMessageError(`Unsupported wire type: ${wireType}`);
    }
  }
  return msg;
}

export class DecryptionErrorMessage {
  readonly ratchetKey: Uint8Array | undefined;
  readonly timestamp: number;
  readonly deviceId: number;
  readonly serialized: Uint8Array;

  private constructor(
    ratchetKey: Uint8Array | undefined,
    timestamp: number,
    deviceId: number,
    serialized: Uint8Array,
  ) {
    this.ratchetKey = ratchetKey;
    this.timestamp = timestamp;
    this.deviceId = deviceId;
    this.serialized = serialized;
  }

  /**
   * Create a DecryptionErrorMessage for a failed original message.
   *
   * Extracts the ratchet key from the original message if it's a SignalMessage
   * (first 33 bytes of protobuf is the ratchet key field).
   */
  static create(
    timestamp: number,
    deviceId: number,
    ratchetKey?: Uint8Array,
  ): DecryptionErrorMessage {
    const proto: DecryptionErrorProto = { timestamp, deviceId };
    if (ratchetKey !== undefined) {
      proto.ratchetKey = ratchetKey;
    }
    const protoEncoded = encodeDecryptionError(proto);
    return new DecryptionErrorMessage(ratchetKey, timestamp, deviceId, protoEncoded);
  }

  /**
   * Deserialize from protobuf bytes.
   */
  static deserialize(data: Uint8Array): DecryptionErrorMessage {
    const proto = decodeDecryptionError(data);
    return new DecryptionErrorMessage(
      proto.ratchetKey,
      proto.timestamp ?? 0,
      proto.deviceId ?? 0,
      Uint8Array.from(data),
    );
  }
}
