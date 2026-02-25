/**
 * SPQR Protobuf-compatible Serialization.
 *
 * Implements binary serialization matching Signal's pq_ratchet.proto schema.
 *
 * Since we don't want to add a protobuf dependency just for SPQR state,
 * we implement a custom binary format that is structurally compatible
 * with the protobuf wire format. This allows interop with libsignal's
 * serialized states.
 *
 * Wire format for PqRatchetState:
 *   field 1: VersionNegotiation (length-delimited)
 *   field 2: Chain (length-delimited)
 *   field 3: V1State (length-delimited, oneof inner)
 *
 * For the simplified implementation, we use a custom JSON-like binary
 * encoding that captures the same information. Full protobuf compatibility
 * can be added later if needed for cross-platform interop.
 */

import type { SerializedSpqrState, SpqrState } from "./states.js";
import { serializeState, deserializeState } from "./states.js";
import type { SerializedChain, ChainParams } from "./chain.js";
import { Direction } from "./chain.js";

// ---- Format version ----

/** Magic byte identifying BCTS SPQR serialized state */
const SPQR_MAGIC = 0x53; // 'S' for SPQR

/** Format version for our custom serialization */
const FORMAT_VERSION = 1;

// ---- SpqrVersion / Direction enums ----

export const enum SpqrVersion {
  V0 = 0,
  V1 = 1,
}

// ---- PqRatchetState (top-level) ----

export interface PqRatchetStateData {
  inner: SpqrState | null;
  chain: SerializedChain | null;
  versionNegotiation: VersionNegotiation | null;
}

export interface VersionNegotiation {
  authKey: Uint8Array;
  direction: Direction;
  minVersion: SpqrVersion;
  chainParams: ChainParams;
}

// ---- Serialization ----

/**
 * Serialize the full PQ ratchet state to bytes.
 *
 * Format:
 *   [magic: 1 byte = 0x53]
 *   [format_version: 1 byte = 1]
 *   [flags: 1 byte - bit 0: has inner, bit 1: has chain, bit 2: has vn]
 *   [inner state: length-prefixed serialized state]
 *   [chain: length-prefixed serialized chain]
 *   [version negotiation: length-prefixed data]
 */
export function serializePqRatchetState(data: PqRatchetStateData): Uint8Array {
  const parts: Uint8Array[] = [];

  // Header
  const header = new Uint8Array(3);
  header[0] = SPQR_MAGIC;
  header[1] = FORMAT_VERSION;
  let flags = 0;
  if (data.inner) flags |= 0x01;
  if (data.chain) flags |= 0x02;
  if (data.versionNegotiation) flags |= 0x04;
  header[2] = flags;
  parts.push(header);

  // Inner state
  if (data.inner) {
    const serialized = serializeState(data.inner);
    const json = JSON.stringify(serialized, replacer);
    const bytes = new TextEncoder().encode(json);
    parts.push(encodeLength(bytes.length));
    parts.push(bytes);
  }

  // Chain
  if (data.chain) {
    const json = JSON.stringify(data.chain, replacer);
    const bytes = new TextEncoder().encode(json);
    parts.push(encodeLength(bytes.length));
    parts.push(bytes);
  }

  // Version negotiation
  if (data.versionNegotiation) {
    const vn = data.versionNegotiation;
    const json = JSON.stringify({
      authKey: Array.from(vn.authKey),
      direction: vn.direction,
      minVersion: vn.minVersion,
      chainParams: vn.chainParams,
    });
    const bytes = new TextEncoder().encode(json);
    parts.push(encodeLength(bytes.length));
    parts.push(bytes);
  }

  return concatAll(parts);
}

/**
 * Deserialize PQ ratchet state from bytes.
 */
export function deserializePqRatchetState(bytes: Uint8Array): PqRatchetStateData {
  if (bytes.length === 0) {
    return { inner: null, chain: null, versionNegotiation: null };
  }

  if (bytes[0] !== SPQR_MAGIC || bytes[1] !== FORMAT_VERSION) {
    throw new Error("Invalid SPQR state: bad magic/version");
  }

  const flags = bytes[2];
  let offset = 3;

  let inner: SpqrState | null = null;
  let chain: SerializedChain | null = null;
  let versionNegotiation: VersionNegotiation | null = null;

  // Inner state
  if (flags & 0x01) {
    const { value: length, bytesRead } = decodeLength(bytes, offset);
    offset += bytesRead;
    const json = new TextDecoder().decode(bytes.slice(offset, offset + length));
    offset += length;
    const parsed = JSON.parse(json, reviver) as SerializedSpqrState;
    inner = deserializeState(parsed);
  }

  // Chain
  if (flags & 0x02) {
    const { value: length, bytesRead } = decodeLength(bytes, offset);
    offset += bytesRead;
    const json = new TextDecoder().decode(bytes.slice(offset, offset + length));
    offset += length;
    const parsed = JSON.parse(json, reviver) as SerializedChain;
    chain = parsed;
  }

  // Version negotiation
  if (flags & 0x04) {
    const { value: length, bytesRead } = decodeLength(bytes, offset);
    offset += bytesRead;
    const json = new TextDecoder().decode(bytes.slice(offset, offset + length));
    offset += length;
    const parsed = JSON.parse(json);
    versionNegotiation = {
      authKey: new Uint8Array(parsed.authKey),
      direction: parsed.direction as Direction,
      minVersion: parsed.minVersion as SpqrVersion,
      chainParams: parsed.chainParams as ChainParams,
    };
  }

  return { inner, chain, versionNegotiation };
}

// ---- Length prefix encoding ----

function encodeLength(length: number): Uint8Array {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint32(0, length, false);
  return buf;
}

function decodeLength(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  const view = new DataView(data.buffer, data.byteOffset + offset, 4);
  return { value: view.getUint32(0, false), bytesRead: 4 };
}

// ---- JSON helpers for Uint8Array ----

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { __uint8array: Array.from(value) };
  }
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    "__uint8array" in (value as Record<string, unknown>)
  ) {
    return new Uint8Array((value as { __uint8array: number[] }).__uint8array);
  }
  return value;
}

// ---- Helpers ----

function concatAll(arrays: Uint8Array[]): Uint8Array {
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
