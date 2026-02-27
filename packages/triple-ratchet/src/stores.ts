/**
 * Kyber pre-key storage interfaces and in-memory implementation.
 *
 * Provides persistence abstractions for ML-KEM (Kyber) pre-keys used
 * in the PQXDH key agreement, mirroring the classical pre-key store
 * pattern from the Signal Protocol.
 *
 * KyberPreKeyRecord serialization uses the same protobuf schema as
 * Rust libsignal's `SignedPreKeyRecordStructure`:
 *
 *   message SignedPreKeyRecordStructure {
 *     uint32  id          = 1;
 *     bytes   public_key  = 2;  // with 0x08 KEM type prefix
 *     bytes   private_key = 3;  // with 0x08 KEM type prefix
 *     bytes   signature   = 4;
 *     fixed64 timestamp   = 5;  // milliseconds since epoch
 *   }
 *
 * Reference: libsignal/rust/protocol/src/storage.rs (KyberPreKeyStore)
 * Reference: libsignal/rust/protocol/src/proto/storage.proto
 */

import type { IdentityKey } from "@bcts/double-ratchet";

import { KYBER_KEY_TYPE_BYTE } from "./constants.js";
import type { KyberKeyPair } from "./types.js";

// ---------------------------------------------------------------------------
// Protobuf encoding/decoding helpers (SignedPreKeyRecordStructure)
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
      throw new Error("KyberPreKeyRecord: varint too long");
    }
  }
  throw new Error("KyberPreKeyRecord: unexpected end of varint");
}

function encodeUint32Field(fieldNumber: number, value: number): Uint8Array {
  const tag = encodeVarint((fieldNumber << 3) | 0);
  const val = encodeVarint(value);
  const result = new Uint8Array(tag.length + val.length);
  result.set(tag, 0);
  result.set(val, tag.length);
  return result;
}

function encodeBytesField(fieldNumber: number, value: Uint8Array): Uint8Array {
  const tag = encodeVarint((fieldNumber << 3) | 2);
  const len = encodeVarint(value.length);
  const result = new Uint8Array(tag.length + len.length + value.length);
  result.set(tag, 0);
  result.set(len, tag.length);
  result.set(value, tag.length + len.length);
  return result;
}

function encodeFixed64Field(fieldNumber: number, value: number): Uint8Array {
  const tag = encodeVarint((fieldNumber << 3) | 1);
  const result = new Uint8Array(tag.length + 8);
  result.set(tag, 0);
  const view = new DataView(result.buffer, result.byteOffset + tag.length, 8);
  view.setUint32(0, value >>> 0, true); // low 32 bits, little-endian
  view.setUint32(4, Math.floor(value / 0x100000000) >>> 0, true); // high 32 bits
  return result;
}

function concatProtoBuffers(...parts: Uint8Array[]): Uint8Array {
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
// KyberPreKeyRecord
// ---------------------------------------------------------------------------

/**
 * A stored ML-KEM pre-key with metadata.
 *
 * Each record holds the full key pair (needed for decapsulation),
 * a signature over the public key (created by the identity key),
 * and a timestamp for rotation policy enforcement.
 *
 * Keys are stored **raw** (without 0x08 prefix) in memory.
 * Serialization adds the prefix to match Rust libsignal's format;
 * deserialization strips it.
 */
export class KyberPreKeyRecord {
  readonly id: number;
  readonly keyPair: KyberKeyPair;
  readonly signature: Uint8Array;
  readonly timestamp: number;

  constructor(
    id: number,
    keyPair: KyberKeyPair,
    signature: Uint8Array,
    timestamp: number,
  ) {
    this.id = id;
    this.keyPair = keyPair;
    this.signature = signature;
    this.timestamp = timestamp;
  }

  /**
   * Serialize the record to protobuf format matching Rust libsignal's
   * `SignedPreKeyRecordStructure`.
   *
   * Protobuf fields:
   *   field 1 (uint32):  id
   *   field 2 (bytes):   publicKey  — with 0x08 KEM type prefix
   *   field 3 (bytes):   secretKey  — with 0x08 KEM type prefix
   *   field 4 (bytes):   signature
   *   field 5 (fixed64): timestamp  — milliseconds since epoch
   */
  serialize(): Uint8Array {
    // Prefix keys with 0x08 type byte (matches Rust kem::PublicKey/SecretKey::serialize)
    const prefixedPk = new Uint8Array(1 + this.keyPair.publicKey.length);
    prefixedPk[0] = KYBER_KEY_TYPE_BYTE;
    prefixedPk.set(this.keyPair.publicKey, 1);

    const prefixedSk = new Uint8Array(1 + this.keyPair.secretKey.length);
    prefixedSk[0] = KYBER_KEY_TYPE_BYTE;
    prefixedSk.set(this.keyPair.secretKey, 1);

    const parts: Uint8Array[] = [];
    parts.push(encodeUint32Field(1, this.id));
    parts.push(encodeBytesField(2, prefixedPk));
    parts.push(encodeBytesField(3, prefixedSk));
    if (this.signature.length > 0) {
      parts.push(encodeBytesField(4, this.signature));
    }
    parts.push(encodeFixed64Field(5, this.timestamp));

    return concatProtoBuffers(...parts);
  }

  /**
   * Deserialize a record from protobuf format matching Rust libsignal's
   * `SignedPreKeyRecordStructure`.
   *
   * Strips the 0x08 KEM type prefix from public and secret keys.
   *
   * @throws {Error} if the buffer is truncated or missing required fields.
   */
  static deserialize(data: Uint8Array): KyberPreKeyRecord {
    if (data.length < 2) {
      throw new Error("KyberPreKeyRecord: buffer too short");
    }

    let id = 0;
    let publicKey: Uint8Array | undefined;
    let secretKey: Uint8Array | undefined;
    let signature = new Uint8Array(0);
    let timestamp = 0;

    let offset = 0;
    while (offset < data.length) {
      const [tagValue, nextOffset] = decodeVarint(data, offset);
      offset = nextOffset;
      const fieldNumber = tagValue >>> 3;
      const wireType = tagValue & 0x7;

      if (wireType === 0) {
        // Varint
        const [value, newOffset] = decodeVarint(data, offset);
        offset = newOffset;
        if (fieldNumber === 1) id = value;
      } else if (wireType === 1) {
        // 64-bit (fixed64)
        if (offset + 8 > data.length) {
          throw new Error("KyberPreKeyRecord: buffer truncated at fixed64");
        }
        const view = new DataView(data.buffer, data.byteOffset + offset, 8);
        const low = view.getUint32(0, true);
        const high = view.getUint32(4, true);
        const value = high * 0x100000000 + low;
        offset += 8;
        if (fieldNumber === 5) timestamp = value;
      } else if (wireType === 2) {
        // Length-delimited (bytes)
        const [len, lenOffset] = decodeVarint(data, offset);
        offset = lenOffset;
        if (offset + len > data.length) {
          throw new Error("KyberPreKeyRecord: buffer truncated at bytes field");
        }
        const value = data.slice(offset, offset + len);
        offset += len;
        if (fieldNumber === 2) publicKey = value;
        else if (fieldNumber === 3) secretKey = value;
        else if (fieldNumber === 4) signature = value;
      } else {
        throw new Error(`KyberPreKeyRecord: unsupported wire type: ${wireType}`);
      }
    }

    if (publicKey == null) {
      throw new Error("KyberPreKeyRecord: missing public key");
    }
    if (secretKey == null) {
      throw new Error("KyberPreKeyRecord: missing secret key");
    }

    // Strip 0x08 KEM type prefix from keys (matches Rust deserialization)
    if (publicKey.length > 0 && publicKey[0] === KYBER_KEY_TYPE_BYTE) {
      publicKey = publicKey.slice(1);
    }
    if (secretKey.length > 0 && secretKey[0] === KYBER_KEY_TYPE_BYTE) {
      secretKey = secretKey.slice(1);
    }

    return new KyberPreKeyRecord(
      id,
      { publicKey, secretKey },
      signature,
      timestamp,
    );
  }
}

// ---------------------------------------------------------------------------
// KyberPreKeyStore
// ---------------------------------------------------------------------------

/**
 * Persistent storage for ML-KEM pre-keys.
 *
 * Implementations must be safe for concurrent access when used by
 * the session manager (multiple sessions may load the same key).
 */
export interface KyberPreKeyStore {
  /** Load a Kyber pre-key by its numeric identifier. */
  loadKyberPreKey(id: number): Promise<KyberPreKeyRecord>;

  /** Persist a Kyber pre-key record under the given identifier. */
  storeKyberPreKey(id: number, record: KyberPreKeyRecord): Promise<void>;

  /**
   * Mark a Kyber pre-key as used.
   *
   * One-time Kyber pre-keys should be deleted after use; last-resort
   * keys may be retained. The implementation decides the policy.
   *
   * @param id - Kyber pre-key ID
   * @param signedEcPreKeyId - Signed EC pre-key ID from the same session
   * @param baseKey - Alice's ephemeral base key from the session
   */
  markKyberPreKeyUsed(id: number, signedEcPreKeyId: number, baseKey: Uint8Array): Promise<void>;
}

// ---------------------------------------------------------------------------
// PQXDHPreKeyBundle
// ---------------------------------------------------------------------------

/**
 * Published pre-key bundle for the PQXDH key agreement.
 *
 * Extends the classical X3DH bundle with an ML-KEM (Kyber) pre-key
 * and its identity-key signature.
 *
 * **KEM key format convention:**
 * `kyberPreKey` may be provided in either raw form (1568 bytes) or
 * with the Rust libsignal 0x08 type prefix (1569 bytes). The protocol
 * layer handles prefix normalization transparently via `stripKemPrefix()`
 * and `addKemPrefix()` — callers do not need to worry about the format.
 */
export interface PQXDHPreKeyBundle {
  readonly registrationId: number;
  readonly deviceId: number;
  readonly preKeyId: number | undefined;
  readonly preKey: Uint8Array | undefined;
  readonly signedPreKeyId: number;
  readonly signedPreKey: Uint8Array;
  readonly signedPreKeySignature: Uint8Array;
  readonly identityKey: IdentityKey;
  readonly kyberPreKeyId: number;
  /** ML-KEM-1024 public key — accepts raw (1568 bytes) or 0x08-prefixed (1569 bytes). */
  readonly kyberPreKey: Uint8Array;
  readonly kyberPreKeySignature: Uint8Array;
}

// ---------------------------------------------------------------------------
// InMemoryKyberPreKeyStore
// ---------------------------------------------------------------------------

/**
 * Volatile in-memory implementation of {@link KyberPreKeyStore}.
 *
 * Suitable for tests and short-lived processes. Production use should
 * back this with a durable store (SQLite, IndexedDB, etc.).
 */
export class InMemoryKyberPreKeyStore implements KyberPreKeyStore {
  private readonly keys = new Map<number, KyberPreKeyRecord>();

  loadKyberPreKey(id: number): Promise<KyberPreKeyRecord> {
    const record = this.keys.get(id);
    if (record === undefined) {
      return Promise.reject(new Error(`Kyber pre-key not found: ${id}`));
    }
    return Promise.resolve(record);
  }

  storeKyberPreKey(
    id: number,
    record: KyberPreKeyRecord,
  ): Promise<void> {
    this.keys.set(id, record);
    return Promise.resolve();
  }

  markKyberPreKeyUsed(
    id: number,
    _signedEcPreKeyId: number,
    _baseKey: Uint8Array,
  ): Promise<void> {
    // In production this would mark for deletion; in-memory just deletes.
    this.keys.delete(id);
    return Promise.resolve();
  }
}
