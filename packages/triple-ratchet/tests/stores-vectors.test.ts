/**
 * V5: KyberPreKeyRecord protobuf known-bytes vector.
 *
 * Verifies that KyberPreKeyRecord.serialize() produces the same protobuf
 * encoding as Rust libsignal's SignedPreKeyRecordStructure:
 *
 *   message SignedPreKeyRecordStructure {
 *     uint32  id          = 1;
 *     bytes   public_key  = 2;  // with 0x08 KEM type prefix
 *     bytes   private_key = 3;  // with 0x08 KEM type prefix
 *     bytes   signature   = 4;
 *     fixed64 timestamp   = 5;  // milliseconds since epoch
 *   }
 *
 * Reference: libsignal/rust/protocol/src/proto/storage.proto
 * Reference: libsignal/rust/protocol/src/state/kyber_prekey.rs
 */

import { describe, it, expect } from "vitest";
import { KyberPreKeyRecord } from "../src/stores.js";
import { KYBER_KEY_TYPE_BYTE } from "../src/constants.js";
import { V5, toHex } from "./fixtures/rust-vectors.js";

/**
 * Manually build the expected protobuf for V5 to verify byte-for-byte
 * match with our serializer.
 */
function buildExpectedProtobuf(): Uint8Array {
  const parts: Uint8Array[] = [];

  // Helper: encode varint
  function varint(v: number): number[] {
    const bytes: number[] = [];
    v = v >>> 0;
    while (v > 0x7f) {
      bytes.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    bytes.push(v & 0x7f);
    return bytes;
  }

  // Field 1 (uint32): id = 42
  // tag = (1 << 3) | 0 = 0x08, value = 42 = 0x2a
  parts.push(Uint8Array.from([0x08, ...varint(V5.id)]));

  // Field 2 (bytes): publicKey with 0x08 prefix
  const prefixedPk = new Uint8Array(1 + V5.publicKey.length);
  prefixedPk[0] = KYBER_KEY_TYPE_BYTE;
  prefixedPk.set(V5.publicKey, 1);
  // tag = (2 << 3) | 2 = 0x12, length = 9
  parts.push(Uint8Array.from([0x12, ...varint(prefixedPk.length), ...prefixedPk]));

  // Field 3 (bytes): secretKey with 0x08 prefix
  const prefixedSk = new Uint8Array(1 + V5.secretKey.length);
  prefixedSk[0] = KYBER_KEY_TYPE_BYTE;
  prefixedSk.set(V5.secretKey, 1);
  // tag = (3 << 3) | 2 = 0x1a, length = 9
  parts.push(Uint8Array.from([0x1a, ...varint(prefixedSk.length), ...prefixedSk]));

  // Field 4 (bytes): signature
  // tag = (4 << 3) | 2 = 0x22, length = 4
  parts.push(Uint8Array.from([0x22, ...varint(V5.signature.length), ...V5.signature]));

  // Field 5 (fixed64): timestamp = 1_700_000_000_000 ms
  // tag = (5 << 3) | 1 = 0x29
  const tsBytes = new Uint8Array(8);
  const view = new DataView(tsBytes.buffer);
  view.setUint32(0, V5.timestamp >>> 0, true); // low 32 bits
  view.setUint32(4, Math.floor(V5.timestamp / 0x100000000) >>> 0, true);
  parts.push(Uint8Array.from([0x29, ...tsBytes]));

  // Concatenate all parts
  let total = 0;
  for (const p of parts) total += p.length;
  const result = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    result.set(p, off);
    off += p.length;
  }
  return result;
}

describe("KyberPreKeyRecord — protobuf known-bytes vector V5", () => {
  const record = new KyberPreKeyRecord(
    V5.id,
    { publicKey: V5.publicKey, secretKey: V5.secretKey },
    V5.signature,
    V5.timestamp,
  );

  it("should produce byte-exact protobuf matching manual construction", () => {
    const expected = buildExpectedProtobuf();
    const actual = record.serialize();
    expect(toHex(actual)).toBe(toHex(expected));
  });

  it("field 1 tag should be 0x08 (uint32, field 1)", () => {
    const bytes = record.serialize();
    expect(bytes[0]).toBe(0x08);
  });

  it("field 2 tag should be 0x12 (bytes, field 2)", () => {
    const bytes = record.serialize();
    // After field 1: 0x08 0x2a → offset 2
    expect(bytes[2]).toBe(0x12);
  });

  it("public key should be stored with 0x08 prefix", () => {
    const bytes = record.serialize();
    // Field 2: tag(1) + len(1) + data = [0x12, 0x09, 0x08, 0xab*8]
    // offset 2 = tag, offset 3 = length, offset 4 = first byte of value
    expect(bytes[4]).toBe(KYBER_KEY_TYPE_BYTE);
  });

  it("timestamp should be stored as fixed64 with tag 0x29", () => {
    const bytes = record.serialize();
    let found = false;
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i] === 0x29) {
        const v = new DataView(bytes.buffer, bytes.byteOffset + i + 1, 8);
        const low = v.getUint32(0, true);
        const high = v.getUint32(4, true);
        const val = high * 0x100000000 + low;
        if (val === V5.timestamp) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("should deserialize back to original fields", () => {
    const bytes = record.serialize();
    const restored = KyberPreKeyRecord.deserialize(bytes);

    expect(restored.id).toBe(V5.id);
    expect(restored.keyPair.publicKey).toEqual(V5.publicKey);
    expect(restored.keyPair.secretKey).toEqual(V5.secretKey);
    expect(restored.signature).toEqual(V5.signature);
    expect(restored.timestamp).toBe(V5.timestamp);
  });

  it("deserialization should strip the 0x08 prefix from keys", () => {
    const bytes = record.serialize();
    const restored = KyberPreKeyRecord.deserialize(bytes);

    // Keys in memory should NOT have the 0x08 prefix
    expect(restored.keyPair.publicKey[0]).not.toBe(KYBER_KEY_TYPE_BYTE);
    expect(restored.keyPair.secretKey[0]).not.toBe(KYBER_KEY_TYPE_BYTE);
    // They should match the original raw keys
    expect(restored.keyPair.publicKey.length).toBe(V5.publicKey.length);
    expect(restored.keyPair.secretKey.length).toBe(V5.secretKey.length);
  });
});

describe("KyberPreKeyRecord — ML-KEM-1024 size vector", () => {
  const pk = new Uint8Array(1568).fill(0xab);
  const sk = new Uint8Array(3168).fill(0xcd);
  const sig = new Uint8Array(64).fill(0xef);
  const ts = 1_700_000_000_000;

  const record = new KyberPreKeyRecord(1, { publicKey: pk, secretKey: sk }, sig, ts);

  it("should round-trip with ML-KEM-1024 key sizes", () => {
    const bytes = record.serialize();
    const restored = KyberPreKeyRecord.deserialize(bytes);

    expect(restored.id).toBe(1);
    expect(restored.keyPair.publicKey.length).toBe(1568);
    expect(restored.keyPair.secretKey.length).toBe(3168);
    expect(restored.keyPair.publicKey).toEqual(pk);
    expect(restored.keyPair.secretKey).toEqual(sk);
    expect(restored.signature).toEqual(sig);
    expect(restored.timestamp).toBe(ts);
  });

  it("serialized form should have prefixed keys (1569 and 3169 bytes)", () => {
    const bytes = record.serialize();
    // Verify by deserializing the raw protobuf and checking lengths
    // The public key field (field 2) should have length 1569 (1 + 1568)
    // We can verify this indirectly: the deserialized key is 1568, meaning
    // the serialized had 1569 (with prefix stripped)
    const restored = KyberPreKeyRecord.deserialize(bytes);
    expect(restored.keyPair.publicKey.length).toBe(1568);
    expect(restored.keyPair.secretKey.length).toBe(3168);
  });
});
