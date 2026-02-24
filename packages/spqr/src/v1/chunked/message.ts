/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Custom binary V1 message serialization for chunked SPQR.
 *
 * Wire format:
 *   [version: u8]          1 byte (V1 = 1)
 *   [epoch: varint]        1-10 bytes (LEB128)
 *   [index: varint]        1-5 bytes (LEB128)
 *   [msg_type: u8]         1 byte (0=None, 1=Hdr, 2=Ek, 3=EkCt1Ack, 4=Ct1Ack, 5=Ct1, 6=Ct2)
 *   [chunk_index: varint]  + [chunk_data: 32 bytes]  (optional, if msg_type has a chunk)
 */

import type { Chunk } from '../../encoding/polynomial.js';
import type { Message, MessagePayload } from './states.js';

// ---------------------------------------------------------------------------
// Message type enum
// ---------------------------------------------------------------------------

const enum MessageType {
  None = 0,
  Hdr = 1,
  Ek = 2,
  EkCt1Ack = 3,
  Ct1Ack = 4,
  Ct1 = 5,
  Ct2 = 6,
}

// ---------------------------------------------------------------------------
// Varint encoding/decoding (LEB128, matching protobuf varint)
// ---------------------------------------------------------------------------

/**
 * Encode a bigint as LEB128 varint into the output array.
 */
export function encodeVarint(value: bigint, into: number[]): void {
  let v = value;
  if (v < 0n) v = 0n;
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) {
      byte |= 0x80;
    }
    into.push(byte);
  } while (v > 0n);
}

/**
 * Decode a LEB128 varint from a Uint8Array at the given offset.
 * Updates offset.offset in place.
 */
export function decodeVarint(from: Uint8Array, at: { offset: number }): bigint {
  let result = 0n;
  let shift = 0n;
  while (shift < 70n) {
    if (at.offset >= from.length) {
      throw new Error('Varint: unexpected end of data');
    }
    const byte = from[at.offset++]!;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return result;
    }
    shift += 7n;
  }
  throw new Error('Varint: too many bytes');
}

/**
 * Encode a number (u32) as LEB128 varint into the output array.
 */
function encodeVarint32(value: number, into: number[]): void {
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v > 0) {
      byte |= 0x80;
    }
    into.push(byte);
  } while (v > 0);
}

/**
 * Decode a LEB128 varint as a u32 number.
 */
function decodeVarint32(from: Uint8Array, at: { offset: number }): number {
  let result = 0;
  let shift = 0;
  while (shift < 35) {
    if (at.offset >= from.length) {
      throw new Error('Varint32: unexpected end of data');
    }
    const byte = from[at.offset++]!;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return result >>> 0;
    }
    shift += 7;
  }
  throw new Error('Varint32: too many bytes');
}

// ---------------------------------------------------------------------------
// Chunk serialization
// ---------------------------------------------------------------------------

const CHUNK_DATA_SIZE = 32;

/** Encode a chunk (index varint + 32 data bytes) into the output array. */
export function encodeChunk(chunk: Chunk, into: number[]): void {
  encodeVarint32(chunk.index, into);
  for (let i = 0; i < CHUNK_DATA_SIZE; i++) {
    into.push(chunk.data[i]!);
  }
}

/** Decode a chunk from a Uint8Array at the given offset. */
export function decodeChunk(from: Uint8Array, at: { offset: number }): Chunk {
  const index = decodeVarint32(from, at);
  if (at.offset + CHUNK_DATA_SIZE > from.length) {
    throw new Error('Chunk: not enough data for chunk payload');
  }
  const data = from.slice(at.offset, at.offset + CHUNK_DATA_SIZE);
  at.offset += CHUNK_DATA_SIZE;
  return { index, data };
}

// ---------------------------------------------------------------------------
// Message serialization
// ---------------------------------------------------------------------------

/** Protocol version */
const V1 = 1;

/**
 * Serialize a Message with a given sequence index into binary wire format.
 */
export function serializeMessage(msg: Message, index: number): Uint8Array {
  const out: number[] = [];

  // Version byte
  out.push(V1);

  // Epoch (bigint varint)
  encodeVarint(msg.epoch, out);

  // Index (u32 varint)
  encodeVarint32(index, out);

  // Message type + payload
  const payload = msg.payload;
  switch (payload.type) {
    case 'none':
      out.push(MessageType.None);
      break;
    case 'hdr':
      out.push(MessageType.Hdr);
      encodeChunk(payload.chunk, out);
      break;
    case 'ek':
      out.push(MessageType.Ek);
      encodeChunk(payload.chunk, out);
      break;
    case 'ekCt1Ack':
      out.push(MessageType.EkCt1Ack);
      encodeChunk(payload.chunk, out);
      break;
    case 'ct1Ack':
      out.push(MessageType.Ct1Ack);
      // No value byte -- matches Rust wire format (Ct1Ack has no payload)
      break;
    case 'ct1':
      out.push(MessageType.Ct1);
      encodeChunk(payload.chunk, out);
      break;
    case 'ct2':
      out.push(MessageType.Ct2);
      encodeChunk(payload.chunk, out);
      break;
  }

  return new Uint8Array(out);
}

/**
 * Deserialize a Message from binary wire format.
 */
export function deserializeMessage(
  from: Uint8Array,
): { msg: Message; index: number; bytesRead: number } {
  const at = { offset: 0 };

  // Version byte
  if (at.offset >= from.length) {
    throw new Error('Message: empty data');
  }
  const version = from[at.offset++]!;
  if (version !== V1) {
    throw new Error(`Message: unsupported version ${version}`);
  }

  // Epoch
  const epoch = decodeVarint(from, at);
  if (epoch === 0n) {
    throw new Error('Message: epoch must be > 0');
  }

  // Index
  const index = decodeVarint32(from, at);

  // Message type
  if (at.offset >= from.length) {
    throw new Error('Message: missing message type');
  }
  const msgType = from[at.offset++]!;

  let payload: MessagePayload;
  switch (msgType) {
    case MessageType.None:
      payload = { type: 'none' };
      break;
    case MessageType.Hdr:
      payload = { type: 'hdr', chunk: decodeChunk(from, at) };
      break;
    case MessageType.Ek:
      payload = { type: 'ek', chunk: decodeChunk(from, at) };
      break;
    case MessageType.EkCt1Ack:
      payload = { type: 'ekCt1Ack', chunk: decodeChunk(from, at) };
      break;
    case MessageType.Ct1Ack:
      // No value byte -- matches Rust (hardcoded true, no data after type byte)
      payload = { type: 'ct1Ack' };
      break;
    case MessageType.Ct1:
      payload = { type: 'ct1', chunk: decodeChunk(from, at) };
      break;
    case MessageType.Ct2:
      payload = { type: 'ct2', chunk: decodeChunk(from, at) };
      break;
    default:
      throw new Error(`Message: unknown message type ${msgType}`);
  }

  return {
    msg: { epoch, payload },
    index,
    bytesRead: at.offset,
  };
}
