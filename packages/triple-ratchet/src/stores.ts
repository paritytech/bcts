/**
 * Kyber pre-key storage interfaces and in-memory implementation.
 *
 * Provides persistence abstractions for ML-KEM (Kyber) pre-keys used
 * in the PQXDH key agreement, mirroring the classical pre-key store
 * pattern from the Signal Protocol.
 *
 * Reference: libsignal/rust/protocol/src/storage.rs (KyberPreKeyStore)
 */

import type { IdentityKey } from "@bcts/double-ratchet";

import type { KyberKeyPair } from "./types.js";

// ---------------------------------------------------------------------------
// KyberPreKeyRecord
// ---------------------------------------------------------------------------

/**
 * A stored ML-KEM pre-key with metadata.
 *
 * Each record holds the full key pair (needed for decapsulation),
 * a signature over the public key (created by the identity key),
 * and a timestamp for rotation policy enforcement.
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
   * Serialize the record to a compact binary format.
   *
   * Layout (big-endian):
   *   [id: 4 bytes]
   *   [timestamp: 8 bytes]
   *   [sigLen: 4 bytes] [signature: sigLen bytes]
   *   [pkLen: 4 bytes]  [publicKey: pkLen bytes]
   *   [skLen: 4 bytes]  [secretKey: skLen bytes]
   */
  serialize(): Uint8Array {
    const sigLen = this.signature.length;
    const pkLen = this.keyPair.publicKey.length;
    const skLen = this.keyPair.secretKey.length;

    // 4 (id) + 8 (timestamp) + 4+sig + 4+pk + 4+sk
    const totalLen = 4 + 8 + 4 + sigLen + 4 + pkLen + 4 + skLen;
    const buf = new Uint8Array(totalLen);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    let offset = 0;

    // id (uint32)
    view.setUint32(offset, this.id);
    offset += 4;

    // timestamp (float64 -- preserves full JS number precision)
    view.setFloat64(offset, this.timestamp);
    offset += 8;

    // signature
    view.setUint32(offset, sigLen);
    offset += 4;
    buf.set(this.signature, offset);
    offset += sigLen;

    // publicKey
    view.setUint32(offset, pkLen);
    offset += 4;
    buf.set(this.keyPair.publicKey, offset);
    offset += pkLen;

    // secretKey
    view.setUint32(offset, skLen);
    offset += 4;
    buf.set(this.keyPair.secretKey, offset);

    return buf;
  }

  /**
   * Deserialize a record previously produced by {@link serialize}.
   *
   * @throws {Error} if the buffer is too short or truncated.
   */
  static deserialize(data: Uint8Array): KyberPreKeyRecord {
    if (data.length < 4 + 8 + 4) {
      throw new Error("KyberPreKeyRecord: buffer too short for header");
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const id = view.getUint32(offset);
    offset += 4;

    const timestamp = view.getFloat64(offset);
    offset += 8;

    // signature
    if (offset + 4 > data.length) {
      throw new Error("KyberPreKeyRecord: buffer truncated at signature length");
    }
    const sigLen = view.getUint32(offset);
    offset += 4;
    if (offset + sigLen > data.length) {
      throw new Error("KyberPreKeyRecord: buffer truncated at signature data");
    }
    const signature = data.slice(offset, offset + sigLen);
    offset += sigLen;

    // publicKey
    if (offset + 4 > data.length) {
      throw new Error("KyberPreKeyRecord: buffer truncated at publicKey length");
    }
    const pkLen = view.getUint32(offset);
    offset += 4;
    if (offset + pkLen > data.length) {
      throw new Error("KyberPreKeyRecord: buffer truncated at publicKey data");
    }
    const publicKey = data.slice(offset, offset + pkLen);
    offset += pkLen;

    // secretKey
    if (offset + 4 > data.length) {
      throw new Error("KyberPreKeyRecord: buffer truncated at secretKey length");
    }
    const skLen = view.getUint32(offset);
    offset += 4;
    if (offset + skLen > data.length) {
      throw new Error("KyberPreKeyRecord: buffer truncated at secretKey data");
    }
    const secretKey = data.slice(offset, offset + skLen);

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
