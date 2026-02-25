/**
 * Hand-written protobuf encoder/decoder for Signal Protocol wire messages.
 *
 * Implements proto2 encoding for wire messages (SignalMessage, PreKeySignalMessage)
 * compatible with Signal's prost-generated Rust code.
 *
 * Wire type encoding:
 *   0 = varint, 2 = length-delimited (bytes)
 *
 * Reference: libsignal/rust/protocol/src/proto/wire.proto
 */

// --- Varint encoding/decoding ---

export function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0; // ensure unsigned
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v & 0x7f);
  return new Uint8Array(bytes);
}

/**
 * Encode a 64-bit varint. Supports values up to Number.MAX_SAFE_INTEGER (2^53 - 1).
 * Uses floating-point division for the upper bits since JavaScript numbers lose
 * precision above 32 bits with bitwise operators.
 */
export function encodeVarint64(value: number): Uint8Array {
  if (value < 0) {
    throw new Error("Cannot encode negative value as varint64");
  }
  // For values that fit in 32 bits, use the fast path
  if (value <= 0xffffffff) {
    return encodeVarint(value);
  }
  const bytes: number[] = [];
  let v = value;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128); // avoid bitwise which truncates to 32 bits
  }
  bytes.push(v & 0x7f);
  return new Uint8Array(bytes);
}

export function decodeVarint(data: Uint8Array, offset: number): [number, number] {
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
      throw new Error("Varint too long");
    }
  }
  throw new Error("Unexpected end of varint");
}

/**
 * Decode a 64-bit varint. Returns a JavaScript number (safe up to 2^53 - 1).
 */
export function decodeVarint64(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let multiplier = 1;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos];
    result += (byte & 0x7f) * multiplier;
    pos++;
    if ((byte & 0x80) === 0) {
      return [result, pos];
    }
    multiplier *= 128;
    if (multiplier > 2 ** 56) {
      throw new Error("Varint64 too long");
    }
  }
  throw new Error("Unexpected end of varint");
}

// --- Field encoding helpers ---

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

// --- SignalMessage proto ---

export interface SignalMessageProto {
  ratchetKey?: Uint8Array;
  counter?: number;
  previousCounter?: number;
  ciphertext?: Uint8Array;
}

export function encodeSignalMessage(msg: SignalMessageProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (msg.ratchetKey != null) parts.push(encodeBytes(1, msg.ratchetKey));
  if (msg.counter !== undefined) parts.push(encodeUint32(2, msg.counter));
  if (msg.previousCounter !== undefined) parts.push(encodeUint32(3, msg.previousCounter));
  if (msg.ciphertext != null) parts.push(encodeBytes(4, msg.ciphertext));

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

export function decodeSignalMessage(data: Uint8Array): SignalMessageProto {
  const msg: SignalMessageProto = {};
  let offset = 0;

  while (offset < data.length) {
    const [tagValue, nextOffset] = decodeVarint(data, offset);
    offset = nextOffset;
    const fieldNumber = tagValue >>> 3;
    const wireType = tagValue & 0x7;

    if (wireType === 0) {
      // varint
      const [value, newOffset] = decodeVarint(data, offset);
      offset = newOffset;
      if (fieldNumber === 2) msg.counter = value;
      else if (fieldNumber === 3) msg.previousCounter = value;
    } else if (wireType === 2) {
      // length-delimited
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      if (fieldNumber === 1) msg.ratchetKey = value;
      else if (fieldNumber === 4) msg.ciphertext = value;
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }

  return msg;
}

// --- PreKeySignalMessage proto ---

export interface PreKeySignalMessageProto {
  registrationId?: number;
  preKeyId?: number;
  signedPreKeyId?: number;
  baseKey?: Uint8Array;
  identityKey?: Uint8Array;
  message?: Uint8Array;
}

export function encodePreKeySignalMessage(msg: PreKeySignalMessageProto): Uint8Array {
  const parts: Uint8Array[] = [];
  // Note: field numbers match Signal's proto2 definition
  if (msg.preKeyId !== undefined) parts.push(encodeUint32(1, msg.preKeyId));
  if (msg.baseKey != null) parts.push(encodeBytes(2, msg.baseKey));
  if (msg.identityKey != null) parts.push(encodeBytes(3, msg.identityKey));
  if (msg.message != null) parts.push(encodeBytes(4, msg.message));
  if (msg.registrationId !== undefined) parts.push(encodeUint32(5, msg.registrationId));
  if (msg.signedPreKeyId !== undefined) parts.push(encodeUint32(6, msg.signedPreKeyId));

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

export function decodePreKeySignalMessage(data: Uint8Array): PreKeySignalMessageProto {
  const msg: PreKeySignalMessageProto = {};
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
    } else if (wireType === 2) {
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      if (fieldNumber === 2) msg.baseKey = value;
      else if (fieldNumber === 3) msg.identityKey = value;
      else if (fieldNumber === 4) msg.message = value;
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }

  return msg;
}

// ============================================================================
// Generic protobuf encoder/decoder for complex messages
// ============================================================================

/**
 * Encode a bytes field (length-delimited).
 * Re-exported for use by other modules.
 */
export function encodeBytesField(fieldNumber: number, value: Uint8Array): Uint8Array {
  const tag = fieldTag(fieldNumber, 2);
  const len = encodeVarint(value.length);
  const result = new Uint8Array(tag.length + len.length + value.length);
  result.set(tag, 0);
  result.set(len, tag.length);
  result.set(value, tag.length + len.length);
  return result;
}

/**
 * Encode a varint field.
 * Re-exported for use by other modules.
 */
export function encodeUint32Field(fieldNumber: number, value: number): Uint8Array {
  const tag = fieldTag(fieldNumber, 0);
  const val = encodeVarint(value);
  const result = new Uint8Array(tag.length + val.length);
  result.set(tag, 0);
  result.set(val, tag.length);
  return result;
}

/**
 * Encode a 64-bit varint field.
 * Required for fields like timestamps that exceed 32-bit range.
 */
export function encodeUint64Field(fieldNumber: number, value: number): Uint8Array {
  const tag = fieldTag(fieldNumber, 0);
  const val = encodeVarint64(value);
  const result = new Uint8Array(tag.length + val.length);
  result.set(tag, 0);
  result.set(val, tag.length);
  return result;
}

/**
 * Encode a fixed64 field (wire type 1, 8-byte little-endian).
 * Required for fields like SignedPreKeyRecord.timestamp that use fixed64 in libsignal.
 */
export function encodeFixed64Field(fieldNumber: number, value: number): Uint8Array {
  const tag = fieldTag(fieldNumber, 1); // wire type 1 = fixed64
  const result = new Uint8Array(tag.length + 8);
  result.set(tag, 0);
  // Write 8-byte little-endian
  const off = tag.length;
  const lo = value >>> 0;
  const hi = Math.floor(value / 0x100000000) >>> 0;
  result[off] = lo & 0xff;
  result[off + 1] = (lo >>> 8) & 0xff;
  result[off + 2] = (lo >>> 16) & 0xff;
  result[off + 3] = (lo >>> 24) & 0xff;
  result[off + 4] = hi & 0xff;
  result[off + 5] = (hi >>> 8) & 0xff;
  result[off + 6] = (hi >>> 16) & 0xff;
  result[off + 7] = (hi >>> 24) & 0xff;
  return result;
}

/**
 * Decode a fixed64 value from 8 bytes (little-endian) into a JavaScript number.
 * Safe for values up to Number.MAX_SAFE_INTEGER (2^53 - 1).
 */
export function decodeFixed64(data: Uint8Array, offset: number): number {
  const lo =
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0;
  const hi =
    (data[offset + 4] |
      (data[offset + 5] << 8) |
      (data[offset + 6] << 16) |
      (data[offset + 7] << 24)) >>>
    0;
  return lo + hi * 0x100000000;
}

/**
 * Encode a nested message (as length-delimited bytes).
 */
export function encodeNestedMessage(fieldNumber: number, innerBytes: Uint8Array): Uint8Array {
  return encodeBytesField(fieldNumber, innerBytes);
}

/**
 * Concatenate multiple Uint8Arrays.
 */
export function concatProtoFields(...fields: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const f of fields) totalLen += f.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const f of fields) {
    result.set(f, offset);
    offset += f.length;
  }
  return result;
}

/**
 * Generic protobuf field value.
 */
export type ProtoFieldValue = number | Uint8Array;

/**
 * Parsed protobuf fields -- maps field number to value(s).
 * Varint fields (wire type 0) -> number
 * Fixed64 fields (wire type 1) -> number
 * Length-delimited fields (wire type 2) -> Uint8Array
 * Repeated fields -> array of values
 */
export interface ParsedProtoFields {
  varints: Map<number, number>;
  /** Fixed64 fields (wire type 1, 8-byte little-endian) */
  fixed64s: Map<number, number>;
  bytes: Map<number, Uint8Array>;
  /** For repeated fields: maps field number to array of bytes values */
  repeatedBytes: Map<number, Uint8Array[]>;
  /** For repeated varint fields */
  repeatedVarints: Map<number, number[]>;
}

/**
 * Parse raw protobuf bytes into a field map.
 * Handles varint (wire type 0) and length-delimited (wire type 2) fields.
 * Accumulates repeated fields into arrays.
 */
export function parseProtoFields(data: Uint8Array): ParsedProtoFields {
  const result: ParsedProtoFields = {
    varints: new Map(),
    fixed64s: new Map(),
    bytes: new Map(),
    repeatedBytes: new Map(),
    repeatedVarints: new Map(),
  };
  let offset = 0;

  while (offset < data.length) {
    const [tagValue, nextOffset] = decodeVarint(data, offset);
    offset = nextOffset;
    const fieldNumber = tagValue >>> 3;
    const wireType = tagValue & 0x7;

    if (wireType === 0) {
      // Varint (use 64-bit decoder for large values like timestamps)
      const [value, newOffset] = decodeVarint64(data, offset);
      offset = newOffset;
      result.varints.set(fieldNumber, value);
      // Also accumulate in repeated
      if (!result.repeatedVarints.has(fieldNumber)) {
        result.repeatedVarints.set(fieldNumber, []);
      }
      const varintArr = result.repeatedVarints.get(fieldNumber);
      if (varintArr == null) throw new Error("expected repeatedVarints entry");
      varintArr.push(value);
    } else if (wireType === 2) {
      // Length-delimited (bytes/string/nested message)
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      result.bytes.set(fieldNumber, value); // last wins for non-repeated
      // Also accumulate in repeated
      if (!result.repeatedBytes.has(fieldNumber)) {
        result.repeatedBytes.set(fieldNumber, []);
      }
      const bytesArr = result.repeatedBytes.get(fieldNumber);
      if (bytesArr == null) throw new Error("expected repeatedBytes entry");
      bytesArr.push(value);
    } else if (wireType === 5) {
      // Fixed32 -- skip 4 bytes
      offset += 4;
    } else if (wireType === 1) {
      // Fixed64 -- read 8-byte little-endian value
      const value = decodeFixed64(data, offset);
      offset += 8;
      result.fixed64s.set(fieldNumber, value);
    } else {
      throw new Error(`Unsupported wire type: ${wireType}`);
    }
  }

  return result;
}

// ============================================================================
// Session Serialization Protobuf (storage.proto)
// ============================================================================

/**
 * SessionStructure protobuf schema (matches libsignal storage.proto).
 */
export interface SessionStructureProto {
  sessionVersion?: number; // field 1, varint
  localIdentityPublic?: Uint8Array; // field 2, bytes
  remoteIdentityPublic?: Uint8Array; // field 3, bytes
  rootKey?: Uint8Array; // field 4, bytes
  previousCounter?: number; // field 5, varint
  senderChain?: ChainStructureProto; // field 6, nested
  receiverChains?: ChainStructureProto[]; // field 7, repeated nested
  pendingPreKey?: PendingPreKeyProto; // field 9, nested
  remoteRegistrationId?: number; // field 10, varint
  localRegistrationId?: number; // field 11, varint
  aliceBaseKey?: Uint8Array; // field 13, bytes
}

export interface ChainStructureProto {
  senderRatchetKey?: Uint8Array; // field 1, bytes
  senderRatchetKeyPrivate?: Uint8Array; // field 2, bytes
  chainKey?: ChainKeyProto; // field 3, nested
  messageKeys?: MessageKeyProto[]; // field 4, repeated nested
}

export interface ChainKeyProto {
  index?: number; // field 1, varint
  key?: Uint8Array; // field 2, bytes
}

export interface MessageKeyProto {
  index?: number; // field 1, varint
  cipherKey?: Uint8Array; // field 2, bytes
  macKey?: Uint8Array; // field 3, bytes
  iv?: Uint8Array; // field 4, bytes
  seed?: Uint8Array; // field 5, bytes
}

export interface PendingPreKeyProto {
  preKeyId?: number; // field 1, varint
  signedPreKeyId?: number; // field 3, varint
  baseKey?: Uint8Array; // field 2, bytes
  timestamp?: number; // field 4, varint64 (ms since epoch)
}

/**
 * RecordStructure -- wraps current + previous session states.
 */
export interface RecordStructureProto {
  currentSession?: Uint8Array; // field 1, bytes (serialized SessionStructure)
  previousSessions?: Uint8Array[]; // field 2, repeated bytes
}

// --- Encoders ---

export function encodeChainKey(ck: ChainKeyProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (ck.index !== undefined) parts.push(encodeUint32Field(1, ck.index));
  if (ck.key != null) parts.push(encodeBytesField(2, ck.key));
  return concatProtoFields(...parts);
}

export function encodeMessageKey(mk: MessageKeyProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (mk.index !== undefined) parts.push(encodeUint32Field(1, mk.index));
  if (mk.cipherKey != null) parts.push(encodeBytesField(2, mk.cipherKey));
  if (mk.macKey != null) parts.push(encodeBytesField(3, mk.macKey));
  if (mk.iv != null) parts.push(encodeBytesField(4, mk.iv));
  if (mk.seed != null) parts.push(encodeBytesField(5, mk.seed));
  return concatProtoFields(...parts);
}

export function encodeChainStructure(chain: ChainStructureProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (chain.senderRatchetKey != null) parts.push(encodeBytesField(1, chain.senderRatchetKey));
  if (chain.senderRatchetKeyPrivate != null) parts.push(encodeBytesField(2, chain.senderRatchetKeyPrivate));
  if (chain.chainKey != null) parts.push(encodeNestedMessage(3, encodeChainKey(chain.chainKey)));
  if (chain.messageKeys != null) {
    for (const mk of chain.messageKeys) {
      parts.push(encodeNestedMessage(4, encodeMessageKey(mk)));
    }
  }
  return concatProtoFields(...parts);
}

export function encodePendingPreKey(pk: PendingPreKeyProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (pk.preKeyId !== undefined) parts.push(encodeUint32Field(1, pk.preKeyId));
  if (pk.baseKey != null) parts.push(encodeBytesField(2, pk.baseKey));
  if (pk.signedPreKeyId !== undefined) parts.push(encodeUint32Field(3, pk.signedPreKeyId));
  if (pk.timestamp !== undefined) parts.push(encodeUint64Field(4, pk.timestamp));
  return concatProtoFields(...parts);
}

export function encodeSessionStructure(ss: SessionStructureProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (ss.sessionVersion !== undefined) parts.push(encodeUint32Field(1, ss.sessionVersion));
  if (ss.localIdentityPublic != null) parts.push(encodeBytesField(2, ss.localIdentityPublic));
  if (ss.remoteIdentityPublic != null) parts.push(encodeBytesField(3, ss.remoteIdentityPublic));
  if (ss.rootKey != null) parts.push(encodeBytesField(4, ss.rootKey));
  if (ss.previousCounter !== undefined) parts.push(encodeUint32Field(5, ss.previousCounter));
  if (ss.senderChain != null) parts.push(encodeNestedMessage(6, encodeChainStructure(ss.senderChain)));
  if (ss.receiverChains != null) {
    for (const rc of ss.receiverChains) {
      parts.push(encodeNestedMessage(7, encodeChainStructure(rc)));
    }
  }
  if (ss.pendingPreKey) parts.push(encodeNestedMessage(9, encodePendingPreKey(ss.pendingPreKey)));
  if (ss.remoteRegistrationId !== undefined)
    parts.push(encodeUint32Field(10, ss.remoteRegistrationId));
  if (ss.localRegistrationId !== undefined)
    parts.push(encodeUint32Field(11, ss.localRegistrationId));
  if (ss.aliceBaseKey) parts.push(encodeBytesField(13, ss.aliceBaseKey));
  return concatProtoFields(...parts);
}

export function encodeRecordStructure(rs: RecordStructureProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (rs.currentSession) parts.push(encodeBytesField(1, rs.currentSession));
  if (rs.previousSessions) {
    for (const ps of rs.previousSessions) {
      parts.push(encodeBytesField(2, ps));
    }
  }
  return concatProtoFields(...parts);
}

// --- Decoders ---

export function decodeChainKey(data: Uint8Array): ChainKeyProto {
  const fields = parseProtoFields(data);
  return {
    index: fields.varints.get(1),
    key: fields.bytes.get(2),
  };
}

export function decodeMessageKey(data: Uint8Array): MessageKeyProto {
  const fields = parseProtoFields(data);
  return {
    index: fields.varints.get(1),
    cipherKey: fields.bytes.get(2),
    macKey: fields.bytes.get(3),
    iv: fields.bytes.get(4),
    seed: fields.bytes.get(5),
  };
}

export function decodeChainStructure(data: Uint8Array): ChainStructureProto {
  const fields = parseProtoFields(data);
  const messageKeys = fields.repeatedBytes.get(4)?.map(decodeMessageKey);
  const chainKeyBytes = fields.bytes.get(3);
  return {
    senderRatchetKey: fields.bytes.get(1),
    senderRatchetKeyPrivate: fields.bytes.get(2),
    chainKey: chainKeyBytes ? decodeChainKey(chainKeyBytes) : undefined,
    messageKeys,
  };
}

export function decodePendingPreKey(data: Uint8Array): PendingPreKeyProto {
  const fields = parseProtoFields(data);
  return {
    preKeyId: fields.varints.get(1),
    baseKey: fields.bytes.get(2),
    signedPreKeyId: fields.varints.get(3),
    timestamp: fields.varints.get(4),
  };
}

export function decodeSessionStructure(data: Uint8Array): SessionStructureProto {
  const fields = parseProtoFields(data);
  const senderChainBytes = fields.bytes.get(6);
  const receiverChainBytesArr = fields.repeatedBytes.get(7);
  const pendingPreKeyBytes = fields.bytes.get(9);

  return {
    sessionVersion: fields.varints.get(1),
    localIdentityPublic: fields.bytes.get(2),
    remoteIdentityPublic: fields.bytes.get(3),
    rootKey: fields.bytes.get(4),
    previousCounter: fields.varints.get(5),
    senderChain: senderChainBytes ? decodeChainStructure(senderChainBytes) : undefined,
    receiverChains: receiverChainBytesArr?.map(decodeChainStructure),
    pendingPreKey: pendingPreKeyBytes ? decodePendingPreKey(pendingPreKeyBytes) : undefined,
    remoteRegistrationId: fields.varints.get(10),
    localRegistrationId: fields.varints.get(11),
    aliceBaseKey: fields.bytes.get(13),
  };
}

export function decodeRecordStructure(data: Uint8Array): RecordStructureProto {
  const fields = parseProtoFields(data);
  return {
    currentSession: fields.bytes.get(1),
    previousSessions: fields.repeatedBytes.get(2),
  };
}

// --- Sender Key protobuf schemas ---

export interface SenderKeyStateChainKeyProto {
  iteration?: number; // field 1
  seed?: Uint8Array; // field 2
}

export interface SenderKeyStateMessageKeyProto {
  iteration?: number; // field 1
  seed?: Uint8Array; // field 2
}

export interface SenderSigningKeyProto {
  publicKey?: Uint8Array; // field 1
  privateKey?: Uint8Array; // field 2
}

export interface SenderKeyStateStructureProto {
  messageVersion?: number; // field 5
  chainId?: number; // field 1
  senderChainKey?: SenderKeyStateChainKeyProto; // field 2
  senderSigningKey?: SenderSigningKeyProto; // field 3
  senderMessageKeys?: SenderKeyStateMessageKeyProto[]; // field 4
}

export interface SenderKeyRecordStructureProto {
  senderKeyStates?: SenderKeyStateStructureProto[]; // field 1
}

export function encodeSenderKeyStateChainKey(ck: SenderKeyStateChainKeyProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (ck.iteration !== undefined) parts.push(encodeUint32Field(1, ck.iteration));
  if (ck.seed) parts.push(encodeBytesField(2, ck.seed));
  return concatProtoFields(...parts);
}

export function encodeSenderKeyStateMessageKey(mk: SenderKeyStateMessageKeyProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (mk.iteration !== undefined) parts.push(encodeUint32Field(1, mk.iteration));
  if (mk.seed) parts.push(encodeBytesField(2, mk.seed));
  return concatProtoFields(...parts);
}

export function encodeSenderSigningKey(sk: SenderSigningKeyProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (sk.publicKey) parts.push(encodeBytesField(1, sk.publicKey));
  if (sk.privateKey) parts.push(encodeBytesField(2, sk.privateKey));
  return concatProtoFields(...parts);
}

export function encodeSenderKeyStateStructure(state: SenderKeyStateStructureProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (state.chainId !== undefined) parts.push(encodeUint32Field(1, state.chainId));
  if (state.senderChainKey)
    parts.push(encodeNestedMessage(2, encodeSenderKeyStateChainKey(state.senderChainKey)));
  if (state.senderSigningKey)
    parts.push(encodeNestedMessage(3, encodeSenderSigningKey(state.senderSigningKey)));
  if (state.senderMessageKeys) {
    for (const mk of state.senderMessageKeys) {
      parts.push(encodeNestedMessage(4, encodeSenderKeyStateMessageKey(mk)));
    }
  }
  if (state.messageVersion !== undefined) parts.push(encodeUint32Field(5, state.messageVersion));
  return concatProtoFields(...parts);
}

export function encodeSenderKeyRecordStructure(record: SenderKeyRecordStructureProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (record.senderKeyStates) {
    for (const state of record.senderKeyStates) {
      parts.push(encodeNestedMessage(1, encodeSenderKeyStateStructure(state)));
    }
  }
  return concatProtoFields(...parts);
}

export function decodeSenderKeyStateChainKey(data: Uint8Array): SenderKeyStateChainKeyProto {
  const fields = parseProtoFields(data);
  return {
    iteration: fields.varints.get(1),
    seed: fields.bytes.get(2),
  };
}

export function decodeSenderKeyStateMessageKey(data: Uint8Array): SenderKeyStateMessageKeyProto {
  const fields = parseProtoFields(data);
  return {
    iteration: fields.varints.get(1),
    seed: fields.bytes.get(2),
  };
}

export function decodeSenderSigningKey(data: Uint8Array): SenderSigningKeyProto {
  const fields = parseProtoFields(data);
  return {
    publicKey: fields.bytes.get(1),
    privateKey: fields.bytes.get(2),
  };
}

export function decodeSenderKeyStateStructure(data: Uint8Array): SenderKeyStateStructureProto {
  const fields = parseProtoFields(data);
  const chainKeyBytes = fields.bytes.get(2);
  const signingKeyBytes = fields.bytes.get(3);
  const messageKeyBytesArr = fields.repeatedBytes.get(4);
  return {
    chainId: fields.varints.get(1),
    senderChainKey: chainKeyBytes ? decodeSenderKeyStateChainKey(chainKeyBytes) : undefined,
    senderSigningKey: signingKeyBytes ? decodeSenderSigningKey(signingKeyBytes) : undefined,
    senderMessageKeys: messageKeyBytesArr?.map(decodeSenderKeyStateMessageKey),
    messageVersion: fields.varints.get(5),
  };
}

export function decodeSenderKeyRecordStructure(data: Uint8Array): SenderKeyRecordStructureProto {
  const fields = parseProtoFields(data);
  const statesArr = fields.repeatedBytes.get(1);
  return {
    senderKeyStates: statesArr?.map(decodeSenderKeyStateStructure),
  };
}

// --- PreKey record protobuf ---

export interface PreKeyRecordProto {
  id?: number; // field 1
  publicKey?: Uint8Array; // field 2
  privateKey?: Uint8Array; // field 3
}

export interface SignedPreKeyRecordProto {
  id?: number; // field 1
  publicKey?: Uint8Array; // field 2
  privateKey?: Uint8Array; // field 3
  signature?: Uint8Array; // field 4
  timestamp?: number; // field 5 (fixed64, matches libsignal storage.proto)
}

export function encodePreKeyRecord(pk: PreKeyRecordProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (pk.id !== undefined) parts.push(encodeUint32Field(1, pk.id));
  if (pk.publicKey) parts.push(encodeBytesField(2, pk.publicKey));
  if (pk.privateKey) parts.push(encodeBytesField(3, pk.privateKey));
  return concatProtoFields(...parts);
}

export function decodePreKeyRecord(data: Uint8Array): PreKeyRecordProto {
  const fields = parseProtoFields(data);
  return {
    id: fields.varints.get(1),
    publicKey: fields.bytes.get(2),
    privateKey: fields.bytes.get(3),
  };
}

export function encodeSignedPreKeyRecord(spk: SignedPreKeyRecordProto): Uint8Array {
  const parts: Uint8Array[] = [];
  if (spk.id !== undefined) parts.push(encodeUint32Field(1, spk.id));
  if (spk.publicKey) parts.push(encodeBytesField(2, spk.publicKey));
  if (spk.privateKey) parts.push(encodeBytesField(3, spk.privateKey));
  if (spk.signature) parts.push(encodeBytesField(4, spk.signature));
  if (spk.timestamp !== undefined) parts.push(encodeFixed64Field(5, spk.timestamp));
  return concatProtoFields(...parts);
}

export function decodeSignedPreKeyRecord(data: Uint8Array): SignedPreKeyRecordProto {
  const fields = parseProtoFields(data);
  // timestamp is fixed64 (wire type 1) matching libsignal's storage.proto
  // Also support varint for backward compatibility with previously serialized data
  const timestamp = fields.fixed64s.get(5) ?? fields.varints.get(5);
  return {
    id: fields.varints.get(1),
    publicKey: fields.bytes.get(2),
    privateKey: fields.bytes.get(3),
    signature: fields.bytes.get(4),
    timestamp,
  };
}
