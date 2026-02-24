/**
 * SPQR Binary Message Format.
 *
 * Ported from Signal's spqr crate: v1/chunked/states/serialize.rs
 *
 * Wire format:
 *   [version: 1 byte]
 *   [epoch: varint, 1-10 bytes]
 *   [index: varint, 1-5 bytes]
 *   [msg_type: 1 byte]
 *   [data: variable, depending on msg_type]
 *
 * For unchunked messages, the data is the complete payload (not chunks).
 */

// ---- Version ----

export const enum SpqrVersion {
  V0 = 0,
  V1 = 1,
}

// ---- Message Types ----

export const enum MessageType {
  None = 0,
  Hdr = 1,
  Ek = 2,
  EkCt1Ack = 3,
  Ct1Ack = 4,
  Ct1 = 5,
  Ct2 = 6,
}

// ---- Payload ----

export type MessagePayload =
  | { type: MessageType.None }
  | { type: MessageType.Hdr; data: Uint8Array }
  | { type: MessageType.Ek; data: Uint8Array }
  | { type: MessageType.EkCt1Ack; data: Uint8Array }
  | { type: MessageType.Ct1Ack; ack: boolean }
  | { type: MessageType.Ct1; data: Uint8Array }
  | { type: MessageType.Ct2; data: Uint8Array };

// ---- Message ----

export interface SpqrMessage {
  epoch: number;
  payload: MessagePayload;
}

// ---- Varint encoding/decoding ----

const MAX_VARINT_BYTES = 10;

export function encodeVarint(value: number, into: number[]): void {
  let a = value;
  for (let i = 0; i < MAX_VARINT_BYTES; i++) {
    const byte = a & 0x7f;
    if (a < 0x80) {
      into.push(byte);
      break;
    } else {
      into.push(0x80 | byte);
      a = Math.floor(a / 128); // Use division for large numbers
    }
  }
}

export function decodeVarint(
  from: Uint8Array,
  at: { offset: number },
): number {
  let out = 0;
  let done = false;

  if (at.offset >= from.length) {
    throw new SpqrMessageError("Varint decode failed: out of bounds");
  }

  const maxI = Math.min(MAX_VARINT_BYTES, from.length - at.offset);
  let i = 0;

  while (i < maxI && !done) {
    const byte = from[at.offset + i];
    out += (byte & 0x7f) * Math.pow(2, 7 * i);
    i++;
    done = (byte & 0x80) === 0;
  }

  if (!done) {
    throw new SpqrMessageError("Varint decode failed: incomplete");
  }

  at.offset += i;
  return out;
}

// ---- Error ----

export class SpqrMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpqrMessageError";
  }
}

// ---- Serialization ----

/**
 * Serialize a message to wire format.
 *
 * Format: [version=1][epoch varint][index varint][msg_type byte][data...]
 *
 * For unchunked messages, data payloads are sent as raw bytes
 * (not wrapped in chunk index+data format).
 */
export function serializeMessage(
  msg: SpqrMessage,
  index: number,
): Uint8Array {
  const bytes: number[] = [];

  // Version byte
  bytes.push(SpqrVersion.V1);

  // Epoch as varint
  encodeVarint(msg.epoch, bytes);

  // Index as varint
  encodeVarint(index, bytes);

  // Message type byte
  const payload = msg.payload;
  bytes.push(payload.type);

  // Data payload
  switch (payload.type) {
    case MessageType.Hdr:
    case MessageType.Ek:
    case MessageType.EkCt1Ack:
    case MessageType.Ct1:
    case MessageType.Ct2:
      // For unchunked: write raw data bytes
      for (let i = 0; i < payload.data.length; i++) {
        bytes.push(payload.data[i]);
      }
      break;
    case MessageType.Ct1Ack:
      // Ct1Ack has no additional data in the unchunked format
      break;
    case MessageType.None:
      // No additional data
      break;
  }

  return new Uint8Array(bytes);
}

/**
 * Deserialize a message from wire format.
 *
 * Returns [message, index, bytesRead].
 */
export function deserializeMessage(
  from: Uint8Array,
): { msg: SpqrMessage; index: number; bytesRead: number } {
  if (from.length === 0 || from[0] !== SpqrVersion.V1) {
    throw new SpqrMessageError("Message decode failed: invalid version");
  }

  const at = { offset: 1 };

  const epoch = decodeVarint(from, at);
  if (epoch === 0) {
    throw new SpqrMessageError("Message decode failed: epoch must be > 0");
  }

  const index = decodeVarint(from, at);

  if (at.offset >= from.length) {
    throw new SpqrMessageError("Message decode failed: no message type");
  }

  const msgType = from[at.offset] as MessageType;
  at.offset += 1;

  let payload: MessagePayload;

  switch (msgType) {
    case MessageType.None:
      payload = { type: MessageType.None };
      break;
    case MessageType.Ct1Ack:
      payload = { type: MessageType.Ct1Ack, ack: true };
      break;
    case MessageType.Hdr:
      payload = {
        type: MessageType.Hdr,
        data: from.slice(at.offset),
      };
      at.offset = from.length;
      break;
    case MessageType.Ek:
      payload = {
        type: MessageType.Ek,
        data: from.slice(at.offset),
      };
      at.offset = from.length;
      break;
    case MessageType.EkCt1Ack:
      payload = {
        type: MessageType.EkCt1Ack,
        data: from.slice(at.offset),
      };
      at.offset = from.length;
      break;
    case MessageType.Ct1:
      payload = {
        type: MessageType.Ct1,
        data: from.slice(at.offset),
      };
      at.offset = from.length;
      break;
    case MessageType.Ct2:
      payload = {
        type: MessageType.Ct2,
        data: from.slice(at.offset),
      };
      at.offset = from.length;
      break;
    default:
      throw new SpqrMessageError(`Message decode failed: unknown type ${msgType}`);
  }

  return {
    msg: { epoch, payload },
    index,
    bytesRead: at.offset,
  };
}
