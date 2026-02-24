/**
 * SenderKeyDistributionMessage — distributes sender key material.
 *
 * Reference: libsignal/rust/protocol/src/protocol.rs:596-740
 */

import { InvalidMessageError } from "../error.js";
import {
  encodeVarint,
  decodeVarint,
} from "./proto.js";

const SENDERKEY_MESSAGE_CURRENT_VERSION = 3;

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

interface SKDMProto {
  distributionId?: Uint8Array;
  chainId?: number;
  iteration?: number;
  chainKey?: Uint8Array;
  signingKey?: Uint8Array;
}

function encodeSKDM(msg: SKDMProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (msg.distributionId) parts.push(encodeBytes(1, msg.distributionId));
  if (msg.chainId !== undefined) parts.push(encodeUint32(2, msg.chainId));
  if (msg.iteration !== undefined) parts.push(encodeUint32(3, msg.iteration));
  if (msg.chainKey) parts.push(encodeBytes(4, msg.chainKey));
  if (msg.signingKey) parts.push(encodeBytes(5, msg.signingKey));
  return concatBytes(...parts);
}

function decodeSKDM(data: Uint8Array): SKDMProto {
  const msg: SKDMProto = {};
  let offset = 0;
  while (offset < data.length) {
    const [tagValue, nextOffset] = decodeVarint(data, offset);
    offset = nextOffset;
    const fieldNumber = tagValue >>> 3;
    const wireType = tagValue & 0x7;
    if (wireType === 0) {
      const [value, newOffset] = decodeVarint(data, offset);
      offset = newOffset;
      if (fieldNumber === 2) msg.chainId = value;
      else if (fieldNumber === 3) msg.iteration = value;
    } else if (wireType === 2) {
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      if (fieldNumber === 1) msg.distributionId = value;
      else if (fieldNumber === 4) msg.chainKey = value;
      else if (fieldNumber === 5) msg.signingKey = value;
    } else {
      throw new InvalidMessageError(`Unsupported wire type: ${wireType}`);
    }
  }
  return msg;
}

export class SenderKeyDistributionMessage {
  readonly messageVersion: number;
  readonly distributionId: Uint8Array;
  readonly chainId: number;
  readonly iteration: number;
  readonly chainKey: Uint8Array;
  readonly signingKey: Uint8Array;
  readonly serialized: Uint8Array;

  private constructor(
    messageVersion: number,
    distributionId: Uint8Array,
    chainId: number,
    iteration: number,
    chainKey: Uint8Array,
    signingKey: Uint8Array,
    serialized: Uint8Array,
  ) {
    this.messageVersion = messageVersion;
    this.distributionId = distributionId;
    this.chainId = chainId;
    this.iteration = iteration;
    this.chainKey = chainKey;
    this.signingKey = signingKey;
    this.serialized = serialized;
  }

  /**
   * Create a new SenderKeyDistributionMessage.
   */
  static create(
    messageVersion: number,
    distributionId: Uint8Array,
    chainId: number,
    iteration: number,
    chainKey: Uint8Array,
    signingKey: Uint8Array,
  ): SenderKeyDistributionMessage {
    // signingKey should be 33 bytes (0x05 prefix + 32 bytes) for serialization
    const serializedSigningKey =
      signingKey.length === 32
        ? (() => {
            const buf = new Uint8Array(33);
            buf[0] = 0x05;
            buf.set(signingKey, 1);
            return buf;
          })()
        : signingKey;

    const protoEncoded = encodeSKDM({
      distributionId,
      chainId,
      iteration,
      chainKey,
      signingKey: serializedSigningKey,
    });

    const versionByte =
      ((messageVersion & 0xf) << 4) | SENDERKEY_MESSAGE_CURRENT_VERSION;
    const serialized = new Uint8Array(1 + protoEncoded.length);
    serialized[0] = versionByte;
    serialized.set(protoEncoded, 1);

    return new SenderKeyDistributionMessage(
      messageVersion,
      distributionId,
      chainId,
      iteration,
      chainKey,
      signingKey,
      serialized,
    );
  }

  /**
   * Deserialize from wire bytes.
   */
  static deserialize(data: Uint8Array): SenderKeyDistributionMessage {
    if (data.length < 2) {
      throw new InvalidMessageError(
        `SenderKeyDistributionMessage too short: ${data.length}`,
      );
    }

    const messageVersion = data[0] >> 4;
    const proto = decodeSKDM(data.slice(1));

    if (!proto.distributionId || proto.distributionId.length !== 16) {
      throw new InvalidMessageError("Missing or invalid distribution ID");
    }
    if (proto.chainId === undefined) {
      throw new InvalidMessageError("Missing chain ID");
    }
    if (proto.iteration === undefined) {
      throw new InvalidMessageError("Missing iteration");
    }
    if (!proto.chainKey || proto.chainKey.length !== 32) {
      throw new InvalidMessageError("Missing or invalid chain key");
    }
    if (!proto.signingKey) {
      throw new InvalidMessageError("Missing signing key");
    }

    // Strip 0x05 prefix from signing key if present
    let signingKey: Uint8Array;
    if (proto.signingKey.length === 33 && proto.signingKey[0] === 0x05) {
      signingKey = proto.signingKey.slice(1);
    } else if (proto.signingKey.length === 32) {
      signingKey = proto.signingKey;
    } else {
      throw new InvalidMessageError(
        `Invalid signing key length: ${proto.signingKey.length}`,
      );
    }

    return new SenderKeyDistributionMessage(
      messageVersion,
      proto.distributionId,
      proto.chainId,
      proto.iteration,
      proto.chainKey,
      signingKey,
      Uint8Array.from(data),
    );
  }
}
