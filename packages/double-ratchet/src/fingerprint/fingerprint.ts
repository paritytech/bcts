/**
 * Fingerprint / Safety Numbers -- out-of-band identity verification.
 *
 * Reference: libsignal/rust/protocol/src/fingerprint.rs
 */

import { sha512 } from "@noble/hashes/sha2.js";
import type { IdentityKey } from "../keys/identity-key.js";
import { constantTimeEqual } from "../crypto/constant-time.js";
import { FingerprintVersionMismatchError, FingerprintParsingError } from "../error.js";
import { encodeVarint, decodeVarint } from "../protocol/proto.js";

// --- Proto helpers for scannable fingerprint ---

function fieldTag(fieldNumber: number, wireType: number): Uint8Array {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function encodeUint32Field(fieldNumber: number, value: number): Uint8Array {
  const tag = fieldTag(fieldNumber, 0);
  const val = encodeVarint(value);
  const result = new Uint8Array(tag.length + val.length);
  result.set(tag, 0);
  result.set(val, tag.length);
  return result;
}

function encodeBytesField(fieldNumber: number, value: Uint8Array): Uint8Array {
  const tag = fieldTag(fieldNumber, 2);
  const len = encodeVarint(value.length);
  const result = new Uint8Array(tag.length + len.length + value.length);
  result.set(tag, 0);
  result.set(len, tag.length);
  result.set(value, tag.length + len.length);
  return result;
}

function encodeNestedMessage(fieldNumber: number, inner: Uint8Array): Uint8Array {
  return encodeBytesField(fieldNumber, inner);
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

// --- Core fingerprint computation ---

function getFingerprint(
  iterations: number,
  stableId: Uint8Array,
  identityKey: IdentityKey,
): Uint8Array {
  if (iterations <= 1 || iterations > 1000000) {
    throw new Error(`Invalid fingerprint iteration count: ${iterations}`);
  }

  const fingerprintVersion = new Uint8Array([0x00, 0x00]);
  const keyBytes = identityKey.serialize(); // 33 bytes with 0x05 prefix

  // Round 0
  let hash = sha512(concatBytes(fingerprintVersion, keyBytes, stableId, keyBytes));

  // Rounds 1..iterations-1
  for (let i = 1; i < iterations; i++) {
    hash = sha512(concatBytes(hash, keyBytes));
  }

  return hash;
}

// --- Displayable Fingerprint ---

function getEncodedString(fprint: Uint8Array): string {
  if (fprint.length < 30) {
    throw new FingerprintParsingError("DisplayableFingerprint created with short encoding");
  }

  let result = "";
  for (let i = 0; i < 6; i++) {
    const offset = i * 5;
    // Read 5 bytes as big-endian u64 (only 5 bytes used, so max 2^40)
    let value = BigInt(0);
    for (let j = 0; j < 5; j++) {
      value = (value << BigInt(8)) | BigInt(fprint[offset + j]);
    }
    const mod = value % BigInt(100000);
    result += mod.toString().padStart(5, "0");
  }

  return result;
}

export class DisplayableFingerprint {
  private readonly local: string;
  private readonly remote: string;

  constructor(localFprint: Uint8Array, remoteFprint: Uint8Array) {
    this.local = getEncodedString(localFprint);
    this.remote = getEncodedString(remoteFprint);
  }

  /**
   * Returns the 60-digit display string.
   * The two 30-digit parts are ordered lexicographically.
   */
  toString(): string {
    if (this.local < this.remote) {
      return this.local + this.remote;
    }
    return this.remote + this.local;
  }
}

// --- Scannable Fingerprint ---

// Protobuf schema (from Signal):
// message LogicalFingerprint { optional bytes content = 1; }
// message CombinedFingerprints {
//   optional uint32 version = 1;
//   optional LogicalFingerprint local_fingerprint = 2;
//   optional LogicalFingerprint remote_fingerprint = 3;
// }

export class ScannableFingerprint {
  readonly version: number;
  private readonly localFingerprint: Uint8Array;
  private readonly remoteFingerprint: Uint8Array;

  constructor(version: number, localFprint: Uint8Array, remoteFprint: Uint8Array) {
    this.version = version;
    // Only store first 32 bytes of the 64-byte hash
    this.localFingerprint = localFprint.slice(0, 32);
    this.remoteFingerprint = remoteFprint.slice(0, 32);
  }

  /**
   * Serialize to protobuf bytes (CombinedFingerprints).
   */
  serialize(): Uint8Array {
    // LogicalFingerprint { content = 1 }
    const localLogical = encodeBytesField(1, this.localFingerprint);
    const remoteLogical = encodeBytesField(1, this.remoteFingerprint);

    // CombinedFingerprints { version = 1, local = 2, remote = 3 }
    return concatBytes(
      encodeUint32Field(1, this.version),
      encodeNestedMessage(2, localLogical),
      encodeNestedMessage(3, remoteLogical),
    );
  }

  /**
   * Deserialize from protobuf bytes.
   */
  static deserialize(data: Uint8Array): ScannableFingerprint {
    let version: number | undefined;
    let localContent: Uint8Array | undefined;
    let remoteContent: Uint8Array | undefined;
    let offset = 0;

    while (offset < data.length) {
      const [tagValue, nextOffset] = decodeVarint(data, offset);
      offset = nextOffset;
      const fieldNumber = tagValue >>> 3;
      const wireType = tagValue & 0x7;

      if (wireType === 0) {
        const [value, newOffset] = decodeVarint(data, offset);
        offset = newOffset;
        if (fieldNumber === 1) version = value;
      } else if (wireType === 2) {
        const [len, lenOffset] = decodeVarint(data, offset);
        offset = lenOffset;
        const value = data.slice(offset, offset + len);
        offset += len;
        if (fieldNumber === 2) {
          localContent = parseLogicalFingerprint(value);
        } else if (fieldNumber === 3) {
          remoteContent = parseLogicalFingerprint(value);
        }
      } else {
        throw new FingerprintParsingError(`Unsupported wire type: ${wireType}`);
      }
    }

    if (version === undefined) {
      throw new FingerprintParsingError("Missing fingerprint version");
    }
    if (localContent == null) {
      throw new FingerprintParsingError("Missing local fingerprint");
    }
    if (remoteContent == null) {
      throw new FingerprintParsingError("Missing remote fingerprint");
    }

    // Build instance with the 32-byte fingerprints directly
    const fp = Object.create(ScannableFingerprint.prototype) as ScannableFingerprint;
    (fp as { version: number }).version = version;
    (fp as unknown as { localFingerprint: Uint8Array }).localFingerprint = localContent;
    (fp as unknown as { remoteFingerprint: Uint8Array }).remoteFingerprint = remoteContent;
    return fp;
  }

  /**
   * Compare with another serialized CombinedFingerprints.
   * Returns true if fingerprints match (local<->remote swap).
   */
  compare(otherSerialized: Uint8Array): boolean {
    const other = ScannableFingerprint.deserialize(otherSerialized);

    if (other.version !== this.version) {
      throw new FingerprintVersionMismatchError(other.version, this.version);
    }

    // Their local should match our remote, and vice versa
    const same1 = constantTimeEqual(other.localFingerprint, this.remoteFingerprint);
    const same2 = constantTimeEqual(other.remoteFingerprint, this.localFingerprint);

    return same1 && same2;
  }
}

function parseLogicalFingerprint(data: Uint8Array): Uint8Array {
  let offset = 0;
  while (offset < data.length) {
    const [tagValue, nextOffset] = decodeVarint(data, offset);
    offset = nextOffset;
    const fieldNumber = tagValue >>> 3;
    const wireType = tagValue & 0x7;
    if (wireType === 2) {
      const [len, lenOffset] = decodeVarint(data, offset);
      offset = lenOffset;
      const value = data.slice(offset, offset + len);
      offset += len;
      if (fieldNumber === 1) return value;
    } else if (wireType === 0) {
      const [, newOffset] = decodeVarint(data, offset);
      offset = newOffset;
    }
  }
  throw new FingerprintParsingError("Missing content in LogicalFingerprint");
}

// --- Main Fingerprint Class ---

export class Fingerprint {
  readonly display: DisplayableFingerprint;
  readonly scannable: ScannableFingerprint;

  private constructor(display: DisplayableFingerprint, scannable: ScannableFingerprint) {
    this.display = display;
    this.scannable = scannable;
  }

  /**
   * Create a new Fingerprint for verifying two identities.
   *
   * @param version - Fingerprint version (1 or 2)
   * @param iterations - Number of SHA-512 iterations (default 5200)
   * @param localStableId - Local user's stable identifier (e.g., phone number bytes)
   * @param localIdentityKey - Local identity key
   * @param remoteStableId - Remote user's stable identifier
   * @param remoteIdentityKey - Remote identity key
   */
  static create(
    version: number,
    iterations: number,
    localStableId: Uint8Array,
    localIdentityKey: IdentityKey,
    remoteStableId: Uint8Array,
    remoteIdentityKey: IdentityKey,
  ): Fingerprint {
    const localFprint = getFingerprint(iterations, localStableId, localIdentityKey);
    const remoteFprint = getFingerprint(iterations, remoteStableId, remoteIdentityKey);

    return new Fingerprint(
      new DisplayableFingerprint(localFprint, remoteFprint),
      new ScannableFingerprint(version, localFprint, remoteFprint),
    );
  }

  /**
   * Get the 60-digit display string.
   */
  displayString(): string {
    return this.display.toString();
  }
}
