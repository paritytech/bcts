/**
 * Copyright (C) 2023-2026 Blockchain Commons, LLC
 * Copyright (C) 2025-2026 Leonardo Amoroso Custodio
 * Copyright (C) 2026 Parity Technologies
 *
 * Minimal protobuf encoder/decoder for SPQR wire format.
 * Supports varint (wire type 0) and length-delimited (wire type 2).
 */

import type {
  PbAuthenticator,
  PbChain,
  PbChainParams,
  PbChunkedState,
  PbChunk,
  PbEpoch,
  PbEpochDirection,
  PbPolynomialDecoder,
  PbPolynomialEncoder,
  PbPqRatchetState,
  PbV1Msg,
  PbV1MsgInner,
  PbV1State,
  PbVersionNegotiation,
} from './pq-ratchet-types.js';

// ---- Wire types ----

const WIRE_VARINT = 0;
const WIRE_LENGTH_DELIMITED = 2;

// ---- Empty defaults for bytes fields ----

const EMPTY_BYTES = new Uint8Array(0);

// =========================================================================
// ProtoWriter
// =========================================================================

export class ProtoWriter {
  private parts: Uint8Array[] = [];

  writeVarint(fieldNumber: number, value: number | bigint): void {
    if (typeof value === 'bigint') {
      if (value === 0n) return; // default value, omit
      this.writeTag(fieldNumber, WIRE_VARINT);
      this.writeRawVarint64(value);
    } else {
      if (value === 0) return; // default value, omit
      this.writeTag(fieldNumber, WIRE_VARINT);
      this.writeRawVarint(value);
    }
  }

  /** Write a varint field even when the value is zero (for required fields). */
  writeVarintAlways(fieldNumber: number, value: number | bigint): void {
    if (typeof value === 'bigint') {
      this.writeTag(fieldNumber, WIRE_VARINT);
      this.writeRawVarint64(value);
    } else {
      this.writeTag(fieldNumber, WIRE_VARINT);
      this.writeRawVarint(value);
    }
  }

  writeBool(fieldNumber: number, value: boolean): void {
    if (!value) return; // default false, omit
    this.writeTag(fieldNumber, WIRE_VARINT);
    this.writeRawVarint(1);
  }

  writeBytes(fieldNumber: number, data: Uint8Array): void {
    if (data.length === 0) return; // default empty, omit
    this.writeTag(fieldNumber, WIRE_LENGTH_DELIMITED);
    this.writeRawVarint(data.length);
    this.parts.push(new Uint8Array(data));
  }

  writeMessage(fieldNumber: number, writer: ProtoWriter): void {
    const data = writer.finish();
    if (data.length === 0) return;
    this.writeTag(fieldNumber, WIRE_LENGTH_DELIMITED);
    this.writeRawVarint(data.length);
    this.parts.push(data);
  }

  /** For oneof fields, write even if the sub-message is empty. */
  writeMessageAlways(fieldNumber: number, writer: ProtoWriter): void {
    const data = writer.finish();
    this.writeTag(fieldNumber, WIRE_LENGTH_DELIMITED);
    this.writeRawVarint(data.length);
    if (data.length > 0) this.parts.push(data);
  }

  writeEnum(fieldNumber: number, value: number): void {
    this.writeVarint(fieldNumber, value);
  }

  finish(): Uint8Array {
    let total = 0;
    for (const p of this.parts) total += p.length;
    const result = new Uint8Array(total);
    let offset = 0;
    for (const p of this.parts) {
      result.set(p, offset);
      offset += p.length;
    }
    return result;
  }

  private writeTag(fieldNumber: number, wireType: number): void {
    this.writeRawVarint((fieldNumber << 3) | wireType);
  }

  private writeRawVarint(value: number): void {
    const buf: number[] = [];
    let v = value >>> 0; // ensure unsigned
    while (v > 0x7f) {
      buf.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    buf.push(v & 0x7f);
    this.parts.push(new Uint8Array(buf));
  }

  private writeRawVarint64(value: bigint): void {
    const buf: number[] = [];
    let v = value;
    while (v > 0x7fn) {
      buf.push(Number(v & 0x7fn) | 0x80);
      v >>= 7n;
    }
    buf.push(Number(v & 0x7fn));
    this.parts.push(new Uint8Array(buf));
  }
}

// =========================================================================
// ProtoReader
// =========================================================================

export class ProtoReader {
  private data: Uint8Array;
  private pos: number;

  constructor(data: Uint8Array) {
    this.data = data;
    this.pos = 0;
  }

  get remaining(): number {
    return this.data.length - this.pos;
  }

  get done(): boolean {
    return this.pos >= this.data.length;
  }

  readField(): { fieldNumber: number; wireType: number } | null {
    if (this.pos >= this.data.length) return null;
    const tag = this.readRawVarint();
    return { fieldNumber: tag >>> 3, wireType: tag & 0x7 };
  }

  readVarint(): number {
    return this.readRawVarint();
  }

  readVarint64(): bigint {
    return this.readRawVarint64();
  }

  readBool(): boolean {
    return this.readRawVarint() !== 0;
  }

  readBytes(): Uint8Array {
    const len = this.readRawVarint();
    const data = this.data.slice(this.pos, this.pos + len);
    this.pos += len;
    return data;
  }

  readMessage(): ProtoReader {
    const data = this.readBytes();
    return new ProtoReader(data);
  }

  readEnum(): number {
    return this.readRawVarint();
  }

  skip(wireType: number): void {
    switch (wireType) {
      case 0: // varint
        this.readRawVarint();
        break;
      case 1: // 64-bit
        this.pos += 8;
        break;
      case 2: { // length-delimited
        const len = this.readRawVarint();
        this.pos += len;
        break;
      }
      case 5: // 32-bit
        this.pos += 4;
        break;
      default:
        throw new Error(`Unknown wire type: ${wireType}`);
    }
  }

  private readRawVarint(): number {
    let result = 0;
    let shift = 0;
    while (shift < 35) {
      const b = this.data[this.pos++]!;
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
    }
    throw new Error('Varint too long');
  }

  private readRawVarint64(): bigint {
    let result = 0n;
    let shift = 0n;
    while (shift < 70n) {
      const b = this.data[this.pos++]!;
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result;
      shift += 7n;
    }
    throw new Error('Varint64 too long');
  }
}

// =========================================================================
// ChainParams
// =========================================================================

export function encodeChainParams(msg: PbChainParams): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarint(1, msg.maxJump);
  w.writeVarint(2, msg.maxOooKeys);
  return w.finish();
}

export function decodeChainParams(data: Uint8Array): PbChainParams {
  const r = new ProtoReader(data);
  let maxJump = 0;
  let maxOooKeys = 0;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: maxJump = r.readVarint(); break;
      case 2: maxOooKeys = r.readVarint(); break;
      default: r.skip(field.wireType);
    }
  }
  return { maxJump, maxOooKeys };
}

// =========================================================================
// VersionNegotiation
// =========================================================================

export function encodeVersionNegotiation(msg: PbVersionNegotiation): Uint8Array {
  const w = new ProtoWriter();
  w.writeBytes(1, msg.authKey);
  w.writeEnum(2, msg.direction);
  w.writeEnum(3, msg.minVersion);
  if (msg.chainParams) {
    const sub = new ProtoWriter();
    sub.writeVarint(1, msg.chainParams.maxJump);
    sub.writeVarint(2, msg.chainParams.maxOooKeys);
    w.writeMessage(4, sub);
  }
  return w.finish();
}

export function decodeVersionNegotiation(data: Uint8Array): PbVersionNegotiation {
  const r = new ProtoReader(data);
  let authKey: Uint8Array = EMPTY_BYTES;
  let direction = 0;
  let minVersion = 0;
  let chainParams: PbChainParams | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: authKey = r.readBytes(); break;
      case 2: direction = r.readEnum(); break;
      case 3: minVersion = r.readEnum(); break;
      case 4: chainParams = decodeChainParams(r.readBytes()); break;
      default: r.skip(field.wireType);
    }
  }
  return { authKey, direction, minVersion, chainParams };
}

// =========================================================================
// EpochDirection
// =========================================================================

function encodeEpochDirection(w: ProtoWriter, msg: PbEpochDirection): void {
  w.writeVarint(1, msg.ctr);
  w.writeBytes(2, msg.next);
  w.writeBytes(3, msg.prev);
}

function decodeEpochDirection(r: ProtoReader): PbEpochDirection {
  let ctr = 0;
  let next: Uint8Array = EMPTY_BYTES;
  let prev: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: ctr = r.readVarint(); break;
      case 2: next = r.readBytes(); break;
      case 3: prev = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { ctr, next, prev };
}

// =========================================================================
// Epoch
// =========================================================================

function encodeEpoch(msg: PbEpoch): Uint8Array {
  const w = new ProtoWriter();
  if (msg.send) {
    const sub = new ProtoWriter();
    encodeEpochDirection(sub, msg.send);
    w.writeMessage(1, sub);
  }
  if (msg.recv) {
    const sub = new ProtoWriter();
    encodeEpochDirection(sub, msg.recv);
    w.writeMessage(2, sub);
  }
  return w.finish();
}

function decodeEpoch(data: Uint8Array): PbEpoch {
  const r = new ProtoReader(data);
  let send: PbEpochDirection | undefined;
  let recv: PbEpochDirection | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: send = decodeEpochDirection(r.readMessage()); break;
      case 2: recv = decodeEpochDirection(r.readMessage()); break;
      default: r.skip(field.wireType);
    }
  }
  return { send, recv };
}

// =========================================================================
// Chain
// =========================================================================

export function encodeChain(msg: PbChain): Uint8Array {
  const w = new ProtoWriter();
  w.writeEnum(1, msg.direction);
  w.writeVarint(2, msg.currentEpoch);
  for (const link of msg.links) {
    w.writeBytes(3, encodeEpoch(link));
  }
  w.writeBytes(4, msg.nextRoot);
  w.writeVarint(5, msg.sendEpoch);
  if (msg.params) {
    const sub = new ProtoWriter();
    sub.writeVarint(1, msg.params.maxJump);
    sub.writeVarint(2, msg.params.maxOooKeys);
    w.writeMessage(6, sub);
  }
  return w.finish();
}

export function decodeChain(data: Uint8Array): PbChain {
  const r = new ProtoReader(data);
  let direction = 0;
  let currentEpoch = 0n;
  const links: PbEpoch[] = [];
  let nextRoot: Uint8Array = EMPTY_BYTES;
  let sendEpoch = 0n;
  let params: PbChainParams | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: direction = r.readEnum(); break;
      case 2: currentEpoch = r.readVarint64(); break;
      case 3: links.push(decodeEpoch(r.readBytes())); break;
      case 4: nextRoot = r.readBytes(); break;
      case 5: sendEpoch = r.readVarint64(); break;
      case 6: params = decodeChainParams(r.readBytes()); break;
      default: r.skip(field.wireType);
    }
  }
  return { direction, currentEpoch, links, nextRoot, sendEpoch, params };
}

// =========================================================================
// Authenticator
// =========================================================================

export function encodeAuthenticator(msg: PbAuthenticator): Uint8Array {
  const w = new ProtoWriter();
  w.writeBytes(1, msg.rootKey);
  w.writeBytes(2, msg.macKey);
  return w.finish();
}

export function decodeAuthenticator(data: Uint8Array): PbAuthenticator {
  const r = new ProtoReader(data);
  let rootKey: Uint8Array = EMPTY_BYTES;
  let macKey: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: rootKey = r.readBytes(); break;
      case 2: macKey = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { rootKey, macKey };
}

// =========================================================================
// PolynomialEncoder
// =========================================================================

export function encodePolynomialEncoder(msg: PbPolynomialEncoder): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarint(1, msg.idx);
  for (const pt of msg.pts) {
    w.writeBytes(2, pt);
  }
  for (const poly of msg.polys) {
    w.writeBytes(3, poly);
  }
  return w.finish();
}

export function decodePolynomialEncoder(data: Uint8Array): PbPolynomialEncoder {
  const r = new ProtoReader(data);
  let idx = 0;
  const pts: Uint8Array[] = [];
  const polys: Uint8Array[] = [];
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: idx = r.readVarint(); break;
      case 2: pts.push(r.readBytes()); break;
      case 3: polys.push(r.readBytes()); break;
      default: r.skip(field.wireType);
    }
  }
  return { idx, pts, polys };
}

// =========================================================================
// PolynomialDecoder
// =========================================================================

export function encodePolynomialDecoder(msg: PbPolynomialDecoder): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarint(1, msg.ptsNeeded);
  w.writeVarint(2, msg.polys);
  for (const pt of msg.pts) {
    w.writeBytes(3, pt);
  }
  w.writeBool(4, msg.isComplete);
  return w.finish();
}

export function decodePolynomialDecoder(data: Uint8Array): PbPolynomialDecoder {
  const r = new ProtoReader(data);
  let ptsNeeded = 0;
  let polys = 0;
  const pts: Uint8Array[] = [];
  let isComplete = false;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: ptsNeeded = r.readVarint(); break;
      case 2: polys = r.readVarint(); break;
      case 3: pts.push(r.readBytes()); break;
      case 4: isComplete = r.readBool(); break;
      default: r.skip(field.wireType);
    }
  }
  return { ptsNeeded, polys, pts, isComplete };
}

// =========================================================================
// Chunk
// =========================================================================

export function encodeChunk(msg: PbChunk): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarint(1, msg.index);
  w.writeBytes(2, msg.data);
  return w.finish();
}

export function decodeChunk(data: Uint8Array): PbChunk {
  const r = new ProtoReader(data);
  let index = 0;
  let chunkData: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: index = r.readVarint(); break;
      case 2: chunkData = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { index, data: chunkData };
}

// =========================================================================
// V1Msg
// =========================================================================

export function encodeV1Msg(msg: PbV1Msg): Uint8Array {
  const w = new ProtoWriter();
  w.writeVarint(1, msg.epoch);
  w.writeVarint(2, msg.index);
  if (msg.innerMsg) {
    const inner = msg.innerMsg;
    switch (inner.type) {
      case 'hdr': {
        const sub = new ProtoWriter();
        sub.writeVarint(1, inner.chunk.index);
        sub.writeBytes(2, inner.chunk.data);
        w.writeMessage(3, sub);
        break;
      }
      case 'ek': {
        const sub = new ProtoWriter();
        sub.writeVarint(1, inner.chunk.index);
        sub.writeBytes(2, inner.chunk.data);
        w.writeMessage(4, sub);
        break;
      }
      case 'ekCt1Ack': {
        const sub = new ProtoWriter();
        sub.writeVarint(1, inner.chunk.index);
        sub.writeBytes(2, inner.chunk.data);
        w.writeMessage(5, sub);
        break;
      }
      case 'ct1Ack': {
        // Bool field at field 6
        w.writeBool(6, inner.value);
        break;
      }
      case 'ct1': {
        const sub = new ProtoWriter();
        sub.writeVarint(1, inner.chunk.index);
        sub.writeBytes(2, inner.chunk.data);
        w.writeMessage(7, sub);
        break;
      }
      case 'ct2': {
        const sub = new ProtoWriter();
        sub.writeVarint(1, inner.chunk.index);
        sub.writeBytes(2, inner.chunk.data);
        w.writeMessage(8, sub);
        break;
      }
    }
  }
  return w.finish();
}

export function decodeV1Msg(data: Uint8Array): PbV1Msg {
  const r = new ProtoReader(data);
  let epoch = 0n;
  let index = 0;
  let innerMsg: PbV1MsgInner | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: epoch = r.readVarint64(); break;
      case 2: index = r.readVarint(); break;
      case 3: innerMsg = { type: 'hdr', chunk: decodeChunk(r.readBytes()) }; break;
      case 4: innerMsg = { type: 'ek', chunk: decodeChunk(r.readBytes()) }; break;
      case 5: innerMsg = { type: 'ekCt1Ack', chunk: decodeChunk(r.readBytes()) }; break;
      case 6: innerMsg = { type: 'ct1Ack', value: r.readBool() }; break;
      case 7: innerMsg = { type: 'ct1', chunk: decodeChunk(r.readBytes()) }; break;
      case 8: innerMsg = { type: 'ct2', chunk: decodeChunk(r.readBytes()) }; break;
      default: r.skip(field.wireType);
    }
  }
  return { epoch, index, innerMsg };
}

// =========================================================================
// Unchunked state encode/decode helpers
// =========================================================================

function encodeAuthOptional(w: ProtoWriter, fieldNumber: number, auth?: PbAuthenticator): void {
  if (auth) {
    const sub = new ProtoWriter();
    sub.writeBytes(1, auth.rootKey);
    sub.writeBytes(2, auth.macKey);
    w.writeMessage(fieldNumber, sub);
  }
}

function decodeAuthOptional(r: ProtoReader): PbAuthenticator {
  return decodeAuthenticator(r.readBytes());
}

/**
 * Detect whether an unchunked sub-message uses the Rust field layout
 * (epoch at field 1, auth at field 2, data fields shifted +1) or the
 * TS layout (auth at field 1, data fields as-is).
 *
 * Returns the field number offset: 0 for TS layout, 1 for Rust layout.
 * Detection is based on field 1's wire type:
 *   - varint (wire type 0) => Rust layout (field 1 = epoch)
 *   - length-delimited (wire type 2) => TS layout (field 1 = auth)
 */
function detectUcLayout(data: Uint8Array): number {
  if (data.length === 0) return 0;
  // Read the first tag to check wire type
  const firstByte = data[0]!;
  const wireType = firstByte & 0x7;
  // Varint wire type 0 at field 1 => Rust layout (epoch)
  // Length-delimited wire type 2 at field 1 => TS layout (auth)
  return wireType === WIRE_VARINT ? 1 : 0;
}

// -- keysUnsampled (unchunked) --

function encodeUcKeysUnsampled(msg: { auth?: PbAuthenticator | undefined }): Uint8Array {
  const w = new ProtoWriter();
  encodeAuthOptional(w, 1, msg.auth);
  return w.finish();
}

function decodeUcKeysUnsampled(data: Uint8Array): { auth?: PbAuthenticator | undefined } {
  const r = new ProtoReader(data);
  const offset = detectUcLayout(data);
  let auth: PbAuthenticator | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    const fn = field.fieldNumber - offset;
    switch (fn) {
      case 1: auth = decodeAuthOptional(r); break;
      default: r.skip(field.wireType);
    }
  }
  return { auth };
}

// -- keysSampled (unchunked) --

function encodeUcKeysSampled(msg: {
  auth?: PbAuthenticator | undefined;
  ek: Uint8Array;
  dk: Uint8Array;
  hdr: Uint8Array;
  hdrMac: Uint8Array;
}): Uint8Array {
  const w = new ProtoWriter();
  encodeAuthOptional(w, 1, msg.auth);
  w.writeBytes(2, msg.ek);
  w.writeBytes(3, msg.dk);
  w.writeBytes(4, msg.hdr);
  w.writeBytes(5, msg.hdrMac);
  return w.finish();
}

function decodeUcKeysSampled(data: Uint8Array): {
  auth?: PbAuthenticator | undefined;
  ek: Uint8Array;
  dk: Uint8Array;
  hdr: Uint8Array;
  hdrMac: Uint8Array;
} {
  const r = new ProtoReader(data);
  const offset = detectUcLayout(data);
  let auth: PbAuthenticator | undefined;
  let ek: Uint8Array = EMPTY_BYTES;
  let dk: Uint8Array = EMPTY_BYTES;
  let hdr: Uint8Array = EMPTY_BYTES;
  let hdrMac: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    const fn = field.fieldNumber - offset;
    switch (fn) {
      case 1: auth = decodeAuthOptional(r); break;
      case 2: ek = r.readBytes(); break;
      case 3: dk = r.readBytes(); break;
      case 4: hdr = r.readBytes(); break;
      case 5: hdrMac = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { auth, ek, dk, hdr, hdrMac };
}

// -- headerSent (unchunked) --
// NOTE: Rust uses Unchunked.EkSent for Chunked.HeaderSent:
//   Rust: epoch=1, auth=2, dk=3
//   TS:   auth=1, ek=2, dk=3
// The TS type carries ek+dk but Rust's EkSent only has dk.
// The offset detection handles the epoch field difference.

function encodeUcHeaderSent(msg: {
  auth?: PbAuthenticator | undefined;
  ek: Uint8Array;
  dk: Uint8Array;
}): Uint8Array {
  const w = new ProtoWriter();
  encodeAuthOptional(w, 1, msg.auth);
  w.writeBytes(2, msg.ek);
  w.writeBytes(3, msg.dk);
  return w.finish();
}

function decodeUcHeaderSent(data: Uint8Array): {
  auth?: PbAuthenticator | undefined;
  ek: Uint8Array;
  dk: Uint8Array;
} {
  const r = new ProtoReader(data);
  const offset = detectUcLayout(data);
  let auth: PbAuthenticator | undefined;
  let ek: Uint8Array = EMPTY_BYTES;
  let dk: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    const fn = field.fieldNumber - offset;
    switch (fn) {
      case 1: auth = decodeAuthOptional(r); break;
      case 2: ek = r.readBytes(); break;
      case 3: dk = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { auth, ek, dk };
}

// -- ct1Received / ekSentCt1Received (unchunked, same shape) --

function encodeUcDkCt1(msg: {
  auth?: PbAuthenticator | undefined;
  dk: Uint8Array;
  ct1: Uint8Array;
}): Uint8Array {
  const w = new ProtoWriter();
  encodeAuthOptional(w, 1, msg.auth);
  w.writeBytes(2, msg.dk);
  w.writeBytes(3, msg.ct1);
  return w.finish();
}

function decodeUcDkCt1(data: Uint8Array): {
  auth?: PbAuthenticator | undefined;
  dk: Uint8Array;
  ct1: Uint8Array;
} {
  const r = new ProtoReader(data);
  const offset = detectUcLayout(data);
  let auth: PbAuthenticator | undefined;
  let dk: Uint8Array = EMPTY_BYTES;
  let ct1: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    const fn = field.fieldNumber - offset;
    switch (fn) {
      case 1: auth = decodeAuthOptional(r); break;
      case 2: dk = r.readBytes(); break;
      case 3: ct1 = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { auth, dk, ct1 };
}

// -- noHeaderReceived / ct2Sampled (unchunked, auth-only) --
// Reuses encodeUcKeysUnsampled / decodeUcKeysUnsampled

// -- headerReceived (unchunked) --
// NOTE: Rust Unchunked.HeaderReceived has only {epoch, auth, hdr},
// while TS carries {auth, hdr, es, ct1, ss}. The offset detection
// handles the epoch field difference; extra fields (es, ct1, ss)
// will be at shifted positions for Rust data.

function encodeUcHeaderReceived(msg: {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ct1: Uint8Array;
  ss: Uint8Array;
}): Uint8Array {
  const w = new ProtoWriter();
  encodeAuthOptional(w, 1, msg.auth);
  w.writeBytes(2, msg.hdr);
  w.writeBytes(3, msg.es);
  w.writeBytes(4, msg.ct1);
  w.writeBytes(5, msg.ss);
  return w.finish();
}

function decodeUcHeaderReceived(data: Uint8Array): {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ct1: Uint8Array;
  ss: Uint8Array;
} {
  const r = new ProtoReader(data);
  const offset = detectUcLayout(data);
  let auth: PbAuthenticator | undefined;
  let hdr: Uint8Array = EMPTY_BYTES;
  let es: Uint8Array = EMPTY_BYTES;
  let ct1: Uint8Array = EMPTY_BYTES;
  let ss: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    const fn = field.fieldNumber - offset;
    switch (fn) {
      case 1: auth = decodeAuthOptional(r); break;
      case 2: hdr = r.readBytes(); break;
      case 3: es = r.readBytes(); break;
      case 4: ct1 = r.readBytes(); break;
      case 5: ss = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { auth, hdr, es, ct1, ss };
}

// -- ct1Sampled / ct1Acknowledged (unchunked, auth+hdr+es+ct1) --

function encodeUcAuthHdrEsCt1(msg: {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ct1: Uint8Array;
}): Uint8Array {
  const w = new ProtoWriter();
  encodeAuthOptional(w, 1, msg.auth);
  w.writeBytes(2, msg.hdr);
  w.writeBytes(3, msg.es);
  w.writeBytes(4, msg.ct1);
  return w.finish();
}

function decodeUcAuthHdrEsCt1(data: Uint8Array): {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ct1: Uint8Array;
} {
  const r = new ProtoReader(data);
  const offset = detectUcLayout(data);
  let auth: PbAuthenticator | undefined;
  let hdr: Uint8Array = EMPTY_BYTES;
  let es: Uint8Array = EMPTY_BYTES;
  let ct1: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    const fn = field.fieldNumber - offset;
    switch (fn) {
      case 1: auth = decodeAuthOptional(r); break;
      case 2: hdr = r.readBytes(); break;
      case 3: es = r.readBytes(); break;
      case 4: ct1 = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { auth, hdr, es, ct1 };
}

// -- ekReceivedCt1Sampled (unchunked, auth+hdr+es+ek+ct1) --

function encodeUcEkReceivedCt1Sampled(msg: {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ek: Uint8Array;
  ct1: Uint8Array;
}): Uint8Array {
  const w = new ProtoWriter();
  encodeAuthOptional(w, 1, msg.auth);
  w.writeBytes(2, msg.hdr);
  w.writeBytes(3, msg.es);
  w.writeBytes(4, msg.ek);
  w.writeBytes(5, msg.ct1);
  return w.finish();
}

function decodeUcEkReceivedCt1Sampled(data: Uint8Array): {
  auth?: PbAuthenticator | undefined;
  hdr: Uint8Array;
  es: Uint8Array;
  ek: Uint8Array;
  ct1: Uint8Array;
} {
  const r = new ProtoReader(data);
  const offset = detectUcLayout(data);
  let auth: PbAuthenticator | undefined;
  let hdr: Uint8Array = EMPTY_BYTES;
  let es: Uint8Array = EMPTY_BYTES;
  let ek: Uint8Array = EMPTY_BYTES;
  let ct1: Uint8Array = EMPTY_BYTES;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    const fn = field.fieldNumber - offset;
    switch (fn) {
      case 1: auth = decodeAuthOptional(r); break;
      case 2: hdr = r.readBytes(); break;
      case 3: es = r.readBytes(); break;
      case 4: ek = r.readBytes(); break;
      case 5: ct1 = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { auth, hdr, es, ek, ct1 };
}

// =========================================================================
// Chunked state (wraps unchunked + encoder/decoder)
// =========================================================================

/**
 * Encode a PbChunkedState into a sub-message for V1State.
 * The field number in V1State determines which variant this is:
 *   1=keysUnsampled, 2=keysSampled, ..., 11=ct2Sampled
 *
 * Each chunked state has:
 *   field 1 = unchunked data
 *   field 2 = encoder (if present)
 *   field 3 = decoder (if present)
 */
function encodeChunkedStateInner(state: PbChunkedState): { fieldNumber: number; data: Uint8Array } {
  const w = new ProtoWriter();

  switch (state.type) {
    case 'keysUnsampled': {
      w.writeBytes(1, encodeUcKeysUnsampled(state.uc));
      return { fieldNumber: 1, data: w.finish() };
    }
    case 'keysSampled': {
      w.writeBytes(1, encodeUcKeysSampled(state.uc));
      w.writeBytes(2, encodePolynomialEncoder(state.sendingHdr));
      return { fieldNumber: 2, data: w.finish() };
    }
    case 'headerSent': {
      w.writeBytes(1, encodeUcHeaderSent(state.uc));
      w.writeBytes(2, encodePolynomialEncoder(state.sendingEk));
      w.writeBytes(3, encodePolynomialDecoder(state.receivingCt1));
      return { fieldNumber: 3, data: w.finish() };
    }
    case 'ct1Received': {
      w.writeBytes(1, encodeUcDkCt1(state.uc));
      w.writeBytes(2, encodePolynomialEncoder(state.sendingEk));
      return { fieldNumber: 4, data: w.finish() };
    }
    case 'ekSentCt1Received': {
      w.writeBytes(1, encodeUcDkCt1(state.uc));
      w.writeBytes(3, encodePolynomialDecoder(state.receivingCt2));
      return { fieldNumber: 5, data: w.finish() };
    }
    case 'noHeaderReceived': {
      w.writeBytes(1, encodeUcKeysUnsampled(state.uc));
      w.writeBytes(2, encodePolynomialDecoder(state.receivingHdr));
      return { fieldNumber: 6, data: w.finish() };
    }
    case 'headerReceived': {
      w.writeBytes(1, encodeUcHeaderReceived(state.uc));
      w.writeBytes(2, encodePolynomialDecoder(state.receivingEk));
      return { fieldNumber: 7, data: w.finish() };
    }
    case 'ct1Sampled': {
      w.writeBytes(1, encodeUcAuthHdrEsCt1(state.uc));
      w.writeBytes(2, encodePolynomialEncoder(state.sendingCt1));
      w.writeBytes(3, encodePolynomialDecoder(state.receivingEk));
      return { fieldNumber: 8, data: w.finish() };
    }
    case 'ekReceivedCt1Sampled': {
      w.writeBytes(1, encodeUcEkReceivedCt1Sampled(state.uc));
      w.writeBytes(2, encodePolynomialEncoder(state.sendingCt1));
      return { fieldNumber: 9, data: w.finish() };
    }
    case 'ct1Acknowledged': {
      w.writeBytes(1, encodeUcAuthHdrEsCt1(state.uc));
      w.writeBytes(2, encodePolynomialDecoder(state.receivingEk));
      return { fieldNumber: 10, data: w.finish() };
    }
    case 'ct2Sampled': {
      w.writeBytes(1, encodeUcKeysUnsampled(state.uc));
      w.writeBytes(2, encodePolynomialEncoder(state.sendingCt2));
      return { fieldNumber: 11, data: w.finish() };
    }
  }
}

type ChunkedDecodeResult = {
  uc: Uint8Array;
  encoder?: Uint8Array | undefined;
  decoder?: Uint8Array | undefined;
};

function decodeChunkedRaw(data: Uint8Array): ChunkedDecodeResult {
  const r = new ProtoReader(data);
  let uc: Uint8Array = EMPTY_BYTES;
  let encoder: Uint8Array | undefined;
  let decoder: Uint8Array | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: uc = r.readBytes(); break;
      case 2: encoder = r.readBytes(); break;
      case 3: decoder = r.readBytes(); break;
      default: r.skip(field.wireType);
    }
  }
  return { uc, encoder, decoder };
}

function decodeChunkedState(fieldNumber: number, data: Uint8Array): PbChunkedState {
  const raw = decodeChunkedRaw(data);

  switch (fieldNumber) {
    case 1:
      return { type: 'keysUnsampled', uc: decodeUcKeysUnsampled(raw.uc) };
    case 2:
      return {
        type: 'keysSampled',
        uc: decodeUcKeysSampled(raw.uc),
        sendingHdr: decodePolynomialEncoder(raw.encoder!),
      };
    case 3:
      return {
        type: 'headerSent',
        uc: decodeUcHeaderSent(raw.uc),
        sendingEk: decodePolynomialEncoder(raw.encoder!),
        receivingCt1: decodePolynomialDecoder(raw.decoder!),
      };
    case 4:
      return {
        type: 'ct1Received',
        uc: decodeUcDkCt1(raw.uc),
        sendingEk: decodePolynomialEncoder(raw.encoder!),
      };
    case 5:
      return {
        type: 'ekSentCt1Received',
        uc: decodeUcDkCt1(raw.uc),
        receivingCt2: decodePolynomialDecoder(raw.decoder!),
      };
    case 6:
      return {
        type: 'noHeaderReceived',
        uc: decodeUcKeysUnsampled(raw.uc),
        receivingHdr: decodePolynomialDecoder(raw.encoder!),
      };
    case 7:
      return {
        type: 'headerReceived',
        uc: decodeUcHeaderReceived(raw.uc),
        receivingEk: decodePolynomialDecoder(raw.encoder!),
      };
    case 8:
      return {
        type: 'ct1Sampled',
        uc: decodeUcAuthHdrEsCt1(raw.uc),
        sendingCt1: decodePolynomialEncoder(raw.encoder!),
        receivingEk: decodePolynomialDecoder(raw.decoder!),
      };
    case 9:
      return {
        type: 'ekReceivedCt1Sampled',
        uc: decodeUcEkReceivedCt1Sampled(raw.uc),
        sendingCt1: decodePolynomialEncoder(raw.encoder!),
      };
    case 10:
      return {
        type: 'ct1Acknowledged',
        uc: decodeUcAuthHdrEsCt1(raw.uc),
        receivingEk: decodePolynomialDecoder(raw.encoder!),
      };
    case 11:
      return {
        type: 'ct2Sampled',
        uc: decodeUcKeysUnsampled(raw.uc),
        sendingCt2: decodePolynomialEncoder(raw.encoder!),
      };
    default:
      throw new Error(`Unknown chunked state field number: ${fieldNumber}`);
  }
}

// =========================================================================
// V1State
// =========================================================================

function encodeV1State(msg: PbV1State): Uint8Array {
  if (!msg.innerState) return EMPTY_BYTES;
  const { fieldNumber, data } = encodeChunkedStateInner(msg.innerState);
  const w = new ProtoWriter();
  // Write as length-delimited sub-message at the correct oneof field number
  w.writeBytes(fieldNumber, data);
  // Field 12: epoch (used for deserialization round-trip)
  if (msg.epoch !== undefined) {
    w.writeVarint(12, msg.epoch);
  }
  return w.finish();
}

function decodeV1State(data: Uint8Array): PbV1State {
  const r = new ProtoReader(data);
  let innerState: PbChunkedState | undefined;
  let epoch: bigint | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    if (field.fieldNumber >= 1 && field.fieldNumber <= 11) {
      innerState = decodeChunkedState(field.fieldNumber, r.readBytes());
    } else if (field.fieldNumber === 12) {
      epoch = r.readVarint64();
    } else {
      r.skip(field.wireType);
    }
  }
  return { innerState, epoch };
}

// =========================================================================
// PqRatchetState (top-level)
// =========================================================================

export function encodePqRatchetState(msg: PbPqRatchetState): Uint8Array {
  const w = new ProtoWriter();
  if (msg.versionNegotiation) {
    w.writeBytes(1, encodeVersionNegotiation(msg.versionNegotiation));
  }
  if (msg.chain) {
    w.writeBytes(2, encodeChain(msg.chain));
  }
  if (msg.v1) {
    w.writeBytes(3, encodeV1State(msg.v1));
  }
  return w.finish();
}

export function decodePqRatchetState(data: Uint8Array): PbPqRatchetState {
  const r = new ProtoReader(data);
  let versionNegotiation: PbVersionNegotiation | undefined;
  let chain: PbChain | undefined;
  let v1: PbV1State | undefined;
  while (!r.done) {
    const field = r.readField();
    if (!field) break;
    switch (field.fieldNumber) {
      case 1: versionNegotiation = decodeVersionNegotiation(r.readBytes()); break;
      case 2: chain = decodeChain(r.readBytes()); break;
      case 3: v1 = decodeV1State(r.readBytes()); break;
      default: r.skip(field.wireType);
    }
  }
  return { versionNegotiation, chain, v1 };
}

// =========================================================================
// Re-exports
// =========================================================================

export type {
  PbAuthenticator,
  PbChain,
  PbChainParams,
  PbChunk,
  PbChunkedState,
  PbEpoch,
  PbEpochDirection,
  PbPolynomialDecoder,
  PbPolynomialEncoder,
  PbPqRatchetState,
  PbV1Msg,
  PbV1MsgInner,
  PbV1State,
  PbVersionNegotiation,
} from './pq-ratchet-types.js';
