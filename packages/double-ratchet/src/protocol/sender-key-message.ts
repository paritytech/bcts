// Copyright © 2025 Signal Messenger, LLC
// Copyright © 2026 Parity Technologies

/**
 * SenderKeyMessage — encrypted group message with Ed25519 signature.
 *
 * Reference: libsignal/rust/protocol/src/protocol.rs:455-594
 */

import { ed25519 } from "@noble/curves/ed25519.js";
import { InvalidMessageError } from "../error.js";
import { encodeVarint, decodeVarint } from "./proto.js";
import {
  CiphertextMessageType,
  type CiphertextMessage,
  type CiphertextMessageConvertible,
} from "./ciphertext-message.js";

const SENDERKEY_MESSAGE_CURRENT_VERSION = 3;
const SIGNATURE_LENGTH = 64;

// Proto encoding helpers (reuse pattern from proto.ts)
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

interface SenderKeyMessageProto {
  distributionId?: Uint8Array;
  chainId?: number;
  iteration?: number;
  ciphertext?: Uint8Array;
}

function encodeSenderKeyMessage(msg: SenderKeyMessageProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (msg.distributionId != null) parts.push(encodeBytes(1, msg.distributionId));
  if (msg.chainId !== undefined) parts.push(encodeUint32(2, msg.chainId));
  if (msg.iteration !== undefined) parts.push(encodeUint32(3, msg.iteration));
  if (msg.ciphertext != null) parts.push(encodeBytes(4, msg.ciphertext));
  return concatBytes(...parts);
}

function decodeSenderKeyMessage(data: Uint8Array): SenderKeyMessageProto {
  const msg: SenderKeyMessageProto = {};
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
      else if (fieldNumber === 4) msg.ciphertext = value;
    } else {
      throw new InvalidMessageError(`Unsupported wire type: ${wireType}`);
    }
  }
  return msg;
}

export class SenderKeyMessage implements CiphertextMessageConvertible {
  readonly messageVersion: number;
  readonly distributionId: Uint8Array;
  readonly chainId: number;
  readonly iteration: number;
  readonly ciphertext: Uint8Array;
  readonly serialized: Uint8Array;

  private readonly _signature: Uint8Array;

  private constructor(
    messageVersion: number,
    distributionId: Uint8Array,
    chainId: number,
    iteration: number,
    ciphertext: Uint8Array,
    signature: Uint8Array,
    serialized: Uint8Array,
  ) {
    this.messageVersion = messageVersion;
    this.distributionId = distributionId;
    this.chainId = chainId;
    this.iteration = iteration;
    this.ciphertext = ciphertext;
    this._signature = signature;
    this.serialized = serialized;
  }

  /**
   * Create a new SenderKeyMessage, signing with Ed25519.
   *
   * @param messageVersion - Message version (typically 3)
   * @param distributionId - 16-byte UUID identifying the group
   * @param chainId - Chain ID within the sender key state
   * @param iteration - Message counter in the chain
   * @param ciphertext - AES-256-CBC encrypted plaintext
   * @param signingPrivateKey - 32-byte Ed25519 private key for signing
   */
  static create(
    messageVersion: number,
    distributionId: Uint8Array,
    chainId: number,
    iteration: number,
    ciphertext: Uint8Array,
    signingPrivateKey: Uint8Array,
  ): SenderKeyMessage {
    const protoEncoded = encodeSenderKeyMessage({
      distributionId,
      chainId,
      iteration,
      ciphertext,
    });

    const versionByte = ((messageVersion & 0xf) << 4) | SENDERKEY_MESSAGE_CURRENT_VERSION;
    const messageContent = new Uint8Array(1 + protoEncoded.length);
    messageContent[0] = versionByte;
    messageContent.set(protoEncoded, 1);

    // Sign with Ed25519
    const signature = ed25519.sign(messageContent, signingPrivateKey);

    // Final: versionByte + proto + 64-byte signature
    const serialized = concatBytes(messageContent, signature);

    return new SenderKeyMessage(
      messageVersion,
      distributionId,
      chainId,
      iteration,
      ciphertext,
      signature,
      serialized,
    );
  }

  /**
   * Deserialize a SenderKeyMessage from wire bytes.
   */
  static deserialize(data: Uint8Array): SenderKeyMessage {
    if (data.length < 1 + SIGNATURE_LENGTH) {
      throw new InvalidMessageError(`SenderKeyMessage too short: ${data.length} bytes`);
    }

    const messageVersion = data[0] >> 4;
    const signature = data.slice(data.length - SIGNATURE_LENGTH);
    const protoData = data.slice(1, data.length - SIGNATURE_LENGTH);

    const proto = decodeSenderKeyMessage(protoData);

    if (proto.distributionId?.length !== 16) {
      throw new InvalidMessageError("Missing or invalid distribution ID");
    }
    if (proto.chainId === undefined) {
      throw new InvalidMessageError("Missing chain ID");
    }
    if (proto.iteration === undefined) {
      throw new InvalidMessageError("Missing iteration");
    }
    if (proto.ciphertext == null) {
      throw new InvalidMessageError("Missing ciphertext");
    }

    return new SenderKeyMessage(
      messageVersion,
      proto.distributionId,
      proto.chainId,
      proto.iteration,
      proto.ciphertext,
      signature,
      Uint8Array.from(data),
    );
  }

  /**
   * Verify the Ed25519 signature using the sender's public signing key.
   */
  verifySignature(signingPublicKey: Uint8Array): boolean {
    const content = this.serialized.slice(0, this.serialized.length - SIGNATURE_LENGTH);
    try {
      return ed25519.verify(this._signature, content, signingPublicKey);
    } catch {
      return false;
    }
  }

  /**
   * Return this message wrapped as a CiphertextMessage with type SenderKey.
   * Matches libsignal's CiphertextMessageConvertible interface.
   */
  asCiphertextMessage(): CiphertextMessage {
    return { type: CiphertextMessageType.SenderKey, message: this };
  }
}
