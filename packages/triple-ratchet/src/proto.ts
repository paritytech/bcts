/**
 * Protobuf encoding/decoding for triple-ratchet wire messages.
 *
 * Implements the same varint-based proto2 encoding as the double-ratchet package,
 * extended with PQ ratchet and Kyber fields.
 *
 * TripleRatchetSignalMessage protobuf fields:
 *   1: ratchet_key (bytes)
 *   2: counter (uint32)
 *   3: previous_counter (uint32)
 *   4: ciphertext (bytes)
 *   5: pq_ratchet (bytes) -- NEW
 *
 * TripleRatchetPreKeySignalMessage protobuf fields:
 *   1: pre_key_id (uint32)
 *   2: base_key (bytes)
 *   3: identity_key (bytes)
 *   4: message (bytes)
 *   5: registration_id (uint32)
 *   6: signed_pre_key_id (uint32)
 *   7: kyber_pre_key_id (uint32) -- NEW
 *   8: kyber_ciphertext (bytes) -- NEW
 */

import { TripleRatchetError, TripleRatchetErrorCode } from "./error.js";

// ---------------------------------------------------------------------------
// Varint encoding/decoding
// ---------------------------------------------------------------------------

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return new Uint8Array(bytes);
}

function decodeVarint(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) {
      return [result >>> 0, pos];
    }
    shift += 7;
    if (shift > 35) {
      throw new TripleRatchetError("Varint too long", TripleRatchetErrorCode.InvalidMessage);
    }
  }
  throw new TripleRatchetError(
    "Unexpected end of varint",
    TripleRatchetErrorCode.InvalidMessage,
  );
}

// ---------------------------------------------------------------------------
// Field encoding helpers
// ---------------------------------------------------------------------------

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

function concatBuffers(...parts: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const p of parts) totalLen += p.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// TripleRatchetSignalMessage proto
// ---------------------------------------------------------------------------

export interface TripleRatchetSignalMessageProto {
  ratchetKey?: Uint8Array;
  counter?: number;
  previousCounter?: number;
  ciphertext?: Uint8Array;
  pqRatchet?: Uint8Array;
}

export function encodeTripleRatchetSignalMessage(
  msg: TripleRatchetSignalMessageProto,
): Uint8Array {
  const parts: Uint8Array[] = [];
  if (msg.ratchetKey != null) parts.push(encodeBytes(1, msg.ratchetKey));
  if (msg.counter !== undefined) parts.push(encodeUint32(2, msg.counter));
  if (msg.previousCounter !== undefined) parts.push(encodeUint32(3, msg.previousCounter));
  if (msg.ciphertext != null) parts.push(encodeBytes(4, msg.ciphertext));
  if (msg.pqRatchet != null && msg.pqRatchet.length > 0) {
    parts.push(encodeBytes(5, msg.pqRatchet));
  }
  return concatBuffers(...parts);
}

export function decodeTripleRatchetSignalMessage(
  data: Uint8Array,
): TripleRatchetSignalMessageProto {
  const msg: TripleRatchetSignalMessageProto = {};
  let offset = 0;

  while (offset < data.length) {
    const [tagValue, nextOffset] = decodeVarint(data, offset);
    offset = nextOffset;
    const fieldNumber = tagValue >>> 3;
    const wireType = tagValue & 0x7;

    if (wireType === 0) {
      const [value, newOffset] = decodeVarint(data, offset);
      offset = newOffset;
      if (fieldNumber === 2) msg.counter = value;
      else if (fieldNumber === 3) msg.previousCounter = value;
    } else if (wireType === 2) {
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      if (fieldNumber === 1) msg.ratchetKey = value;
      else if (fieldNumber === 4) msg.ciphertext = value;
      else if (fieldNumber === 5) msg.pqRatchet = value;
    } else {
      throw new TripleRatchetError(
        `Unsupported wire type: ${wireType}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }
  }

  return msg;
}

// ---------------------------------------------------------------------------
// TripleRatchetPreKeySignalMessage proto
// ---------------------------------------------------------------------------

export interface TripleRatchetPreKeySignalMessageProto {
  preKeyId?: number;
  baseKey?: Uint8Array;
  identityKey?: Uint8Array;
  message?: Uint8Array;
  registrationId?: number;
  signedPreKeyId?: number;
  kyberPreKeyId?: number;
  kyberCiphertext?: Uint8Array;
}

export function encodeTripleRatchetPreKeySignalMessage(
  msg: TripleRatchetPreKeySignalMessageProto,
): Uint8Array {
  const parts: Uint8Array[] = [];
  if (msg.preKeyId !== undefined) parts.push(encodeUint32(1, msg.preKeyId));
  if (msg.baseKey != null) parts.push(encodeBytes(2, msg.baseKey));
  if (msg.identityKey != null) parts.push(encodeBytes(3, msg.identityKey));
  if (msg.message != null) parts.push(encodeBytes(4, msg.message));
  if (msg.registrationId !== undefined) parts.push(encodeUint32(5, msg.registrationId));
  if (msg.signedPreKeyId !== undefined) parts.push(encodeUint32(6, msg.signedPreKeyId));
  if (msg.kyberPreKeyId !== undefined) parts.push(encodeUint32(7, msg.kyberPreKeyId));
  if (msg.kyberCiphertext != null) parts.push(encodeBytes(8, msg.kyberCiphertext));
  return concatBuffers(...parts);
}

export function decodeTripleRatchetPreKeySignalMessage(
  data: Uint8Array,
): TripleRatchetPreKeySignalMessageProto {
  const msg: TripleRatchetPreKeySignalMessageProto = {};
  let offset = 0;

  while (offset < data.length) {
    const [tagValue, nextOffset] = decodeVarint(data, offset);
    offset = nextOffset;
    const fieldNumber = tagValue >>> 3;
    const wireType = tagValue & 0x7;

    if (wireType === 0) {
      const [value, newOffset] = decodeVarint(data, offset);
      offset = newOffset;
      if (fieldNumber === 1) msg.preKeyId = value;
      else if (fieldNumber === 5) msg.registrationId = value;
      else if (fieldNumber === 6) msg.signedPreKeyId = value;
      else if (fieldNumber === 7) msg.kyberPreKeyId = value;
    } else if (wireType === 2) {
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      if (fieldNumber === 2) msg.baseKey = value;
      else if (fieldNumber === 3) msg.identityKey = value;
      else if (fieldNumber === 4) msg.message = value;
      else if (fieldNumber === 8) msg.kyberCiphertext = value;
    } else {
      throw new TripleRatchetError(
        `Unsupported wire type: ${wireType}`,
        TripleRatchetErrorCode.InvalidMessage,
      );
    }
  }

  return msg;
}
