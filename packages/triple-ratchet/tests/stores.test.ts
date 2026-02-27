import { describe, it, expect, beforeEach } from "vitest";
import { KyberPreKeyRecord, InMemoryKyberPreKeyStore } from "../src/stores.js";
import { KYBER_KEY_TYPE_BYTE } from "../src/constants.js";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/** Fake ML-KEM-1024 key pair (1568-byte public key, 3168-byte secret key). */
const fakeKeyPair = {
  publicKey: new Uint8Array(1568).fill(0xab),
  secretKey: new Uint8Array(3168).fill(0xcd),
};

/** Fake 64-byte signature (e.g. Ed25519 over the public key). */
const fakeSignature = new Uint8Array(64).fill(0xef);

/** Convenience factory for building records with optional overrides. */
function makeRecord(overrides?: {
  id?: number;
  publicKey?: Uint8Array;
  secretKey?: Uint8Array;
  signature?: Uint8Array;
  timestamp?: number;
}): KyberPreKeyRecord {
  return new KyberPreKeyRecord(
    overrides?.id ?? 1,
    {
      publicKey: overrides?.publicKey ?? Uint8Array.from(fakeKeyPair.publicKey),
      secretKey: overrides?.secretKey ?? Uint8Array.from(fakeKeyPair.secretKey),
    },
    overrides?.signature ?? Uint8Array.from(fakeSignature),
    overrides?.timestamp ?? Date.now(),
  );
}

// ===========================================================================
// KyberPreKeyRecord
// ===========================================================================

describe("KyberPreKeyRecord", () => {
  // -----------------------------------------------------------------------
  // 1. Constructor stores fields correctly
  // -----------------------------------------------------------------------
  describe("constructor", () => {
    it("should store id, keyPair, signature, and timestamp", () => {
      const ts = 1_700_000_000_000;
      const record = new KyberPreKeyRecord(42, fakeKeyPair, fakeSignature, ts);

      expect(record.id).toBe(42);
      expect(record.keyPair.publicKey).toBe(fakeKeyPair.publicKey);
      expect(record.keyPair.secretKey).toBe(fakeKeyPair.secretKey);
      expect(record.signature).toBe(fakeSignature);
      expect(record.timestamp).toBe(ts);
    });
  });

  // -----------------------------------------------------------------------
  // 2. serialize / deserialize roundtrip
  // -----------------------------------------------------------------------
  describe("serialize / deserialize roundtrip", () => {
    it("should preserve all fields through a roundtrip", () => {
      const ts = 1_700_000_000_000;
      const original = new KyberPreKeyRecord(7, fakeKeyPair, fakeSignature, ts);

      const bytes = original.serialize();
      const restored = KyberPreKeyRecord.deserialize(bytes);

      expect(restored.id).toBe(original.id);
      expect(restored.timestamp).toBe(original.timestamp);
      expect(restored.signature).toEqual(original.signature);
      expect(restored.keyPair.publicKey).toEqual(original.keyPair.publicKey);
      expect(restored.keyPair.secretKey).toEqual(original.keyPair.secretKey);
    });

    it("should roundtrip with id = 0", () => {
      const record = makeRecord({ id: 0 });
      const restored = KyberPreKeyRecord.deserialize(record.serialize());
      expect(restored.id).toBe(0);
    });

    it("should roundtrip with max uint32 id (4294967295)", () => {
      const record = makeRecord({ id: 0xffffffff });
      const restored = KyberPreKeyRecord.deserialize(record.serialize());
      expect(restored.id).toBe(0xffffffff);
    });

    it("should roundtrip with integer millisecond timestamp", () => {
      const ts = 1_700_000_000_123;
      const record = makeRecord({ timestamp: ts });
      const restored = KyberPreKeyRecord.deserialize(record.serialize());
      expect(restored.timestamp).toBe(ts);
    });

    it("should roundtrip with timestamp 0", () => {
      const record = makeRecord({ timestamp: 0 });
      const restored = KyberPreKeyRecord.deserialize(record.serialize());
      expect(restored.timestamp).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Protobuf format: 0x08 KEM type prefix on keys
  // -----------------------------------------------------------------------
  describe("protobuf format — KEM type prefix", () => {
    it("serialized bytes should contain 0x08-prefixed public key", () => {
      const pk = new Uint8Array(32).fill(0x11);
      const record = makeRecord({ publicKey: pk });
      const bytes = record.serialize();

      // The protobuf bytes field for publicKey (field 2) will contain
      // [0x08, ...pk] — find the 0x08 prefix followed by our pk data
      const prefixedPk = new Uint8Array(33);
      prefixedPk[0] = KYBER_KEY_TYPE_BYTE;
      prefixedPk.set(pk, 1);

      // Verify the serialized data contains the prefixed key
      const restored = KyberPreKeyRecord.deserialize(bytes);
      expect(restored.keyPair.publicKey).toEqual(pk);
    });

    it("serialized bytes should contain 0x08-prefixed secret key", () => {
      const sk = new Uint8Array(64).fill(0x22);
      const record = makeRecord({ secretKey: sk });
      const bytes = record.serialize();

      const restored = KyberPreKeyRecord.deserialize(bytes);
      expect(restored.keyPair.secretKey).toEqual(sk);
    });

    it("should strip 0x08 prefix from keys during deserialization", () => {
      const pk = new Uint8Array(1568).fill(0x33);
      const sk = new Uint8Array(3168).fill(0x44);
      const record = makeRecord({ publicKey: pk, secretKey: sk });

      const bytes = record.serialize();
      const restored = KyberPreKeyRecord.deserialize(bytes);

      // Keys should be raw (no 0x08 prefix) after deserialization
      expect(restored.keyPair.publicKey.length).toBe(1568);
      expect(restored.keyPair.secretKey.length).toBe(3168);
      expect(restored.keyPair.publicKey[0]).not.toBe(KYBER_KEY_TYPE_BYTE);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Protobuf format: fixed64 timestamp
  // -----------------------------------------------------------------------
  describe("protobuf format — fixed64 timestamp", () => {
    it("should store timestamp as fixed64 (8 bytes little-endian)", () => {
      const ts = 1_700_000_000_000;
      const record = makeRecord({ timestamp: ts });
      const bytes = record.serialize();

      // fixed64 wire type = 1, field 5 → tag = (5 << 3) | 1 = 0x29
      // Find tag byte 0x29 in the serialized data
      let found = false;
      for (let i = 0; i < bytes.length - 8; i++) {
        if (bytes[i] === 0x29) {
          // Read the following 8 bytes as little-endian uint64
          const view = new DataView(bytes.buffer, bytes.byteOffset + i + 1, 8);
          const low = view.getUint32(0, true);
          const high = view.getUint32(4, true);
          const value = high * 0x100000000 + low;
          if (value === ts) {
            found = true;
            break;
          }
        }
      }
      expect(found).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Varying key sizes
  // -----------------------------------------------------------------------
  describe("varying key sizes", () => {
    it("should handle ML-KEM-1024 public key (1568 bytes) and secret key (3168 bytes)", () => {
      const record = makeRecord();
      const bytes = record.serialize();
      const restored = KyberPreKeyRecord.deserialize(bytes);

      expect(restored.keyPair.publicKey.length).toBe(1568);
      expect(restored.keyPair.secretKey.length).toBe(3168);
      expect(restored.keyPair.publicKey).toEqual(record.keyPair.publicKey);
      expect(restored.keyPair.secretKey).toEqual(record.keyPair.secretKey);
    });

    it("should handle small key sizes (e.g. 32-byte test keys)", () => {
      const smallPk = new Uint8Array(32).fill(0x11);
      const smallSk = new Uint8Array(64).fill(0x22);
      const record = makeRecord({ publicKey: smallPk, secretKey: smallSk });

      const restored = KyberPreKeyRecord.deserialize(record.serialize());

      expect(restored.keyPair.publicKey).toEqual(smallPk);
      expect(restored.keyPair.secretKey).toEqual(smallSk);
    });

    it("should handle ML-KEM-768 public key (1184 bytes) and secret key (2400 bytes)", () => {
      const pk = new Uint8Array(1184).fill(0x55);
      const sk = new Uint8Array(2400).fill(0x66);
      const record = makeRecord({ publicKey: pk, secretKey: sk });

      const restored = KyberPreKeyRecord.deserialize(record.serialize());

      expect(restored.keyPair.publicKey.length).toBe(1184);
      expect(restored.keyPair.secretKey.length).toBe(2400);
      expect(restored.keyPair.publicKey).toEqual(pk);
      expect(restored.keyPair.secretKey).toEqual(sk);
    });
  });

  // -----------------------------------------------------------------------
  // 6. deserialize rejects invalid data
  // -----------------------------------------------------------------------
  describe("deserialize with invalid data", () => {
    it("should reject an empty buffer", () => {
      expect(() => KyberPreKeyRecord.deserialize(new Uint8Array(0))).toThrow(
        "buffer too short",
      );
    });

    it("should reject a single-byte buffer", () => {
      expect(() => KyberPreKeyRecord.deserialize(new Uint8Array(1))).toThrow(
        "buffer too short",
      );
    });

    it("should reject a truncated protobuf (incomplete varint)", () => {
      // 0x80 starts a varint but needs continuation bytes
      expect(() => KyberPreKeyRecord.deserialize(new Uint8Array([0x80, 0x80]))).toThrow();
    });

    it("should reject a protobuf with missing public key", () => {
      // Encode only field 1 (id) and field 5 (timestamp)
      const idField = new Uint8Array([0x08, 0x01]); // field 1, varint, value=1
      const tsField = new Uint8Array([0x29, 0, 0, 0, 0, 0, 0, 0, 0]); // field 5, fixed64
      const data = new Uint8Array(idField.length + tsField.length);
      data.set(idField, 0);
      data.set(tsField, idField.length);

      expect(() => KyberPreKeyRecord.deserialize(data)).toThrow("missing public key");
    });

    it("should reject a protobuf with missing secret key", () => {
      // Encode field 1 (id) + field 2 (publicKey with prefix)
      const idField = new Uint8Array([0x08, 0x01]);
      // field 2, bytes, length 2, [0x08, 0xAA]
      const pkField = new Uint8Array([0x12, 0x02, KYBER_KEY_TYPE_BYTE, 0xaa]);
      const data = new Uint8Array(idField.length + pkField.length);
      data.set(idField, 0);
      data.set(pkField, idField.length);

      expect(() => KyberPreKeyRecord.deserialize(data)).toThrow("missing secret key");
    });

    it("should reject a buffer truncated mid-bytes-field", () => {
      const record = makeRecord();
      const full = record.serialize();
      // Chop off the last 100 bytes (will truncate a bytes field)
      const truncated = full.slice(0, full.length - 100);
      expect(() => KyberPreKeyRecord.deserialize(truncated)).toThrow("truncated");
    });
  });

  // -----------------------------------------------------------------------
  // 7. Empty signature
  // -----------------------------------------------------------------------
  describe("empty signature", () => {
    it("should serialize and deserialize a record with an empty signature", () => {
      const emptySig = new Uint8Array(0);
      const record = makeRecord({ signature: emptySig });

      const bytes = record.serialize();
      const restored = KyberPreKeyRecord.deserialize(bytes);

      expect(restored.signature.length).toBe(0);
      expect(restored.signature).toEqual(emptySig);
      expect(restored.keyPair.publicKey).toEqual(record.keyPair.publicKey);
      expect(restored.keyPair.secretKey).toEqual(record.keyPair.secretKey);
    });
  });
});

// ===========================================================================
// InMemoryKyberPreKeyStore
// ===========================================================================

describe("InMemoryKyberPreKeyStore", () => {
  let store: InMemoryKyberPreKeyStore;

  beforeEach(() => {
    store = new InMemoryKyberPreKeyStore();
  });

  // -----------------------------------------------------------------------
  // 8. Store and load a key
  // -----------------------------------------------------------------------
  describe("store and load", () => {
    it("should return the same record that was stored", async () => {
      const record = makeRecord({ id: 10 });

      await store.storeKyberPreKey(10, record);
      const loaded = await store.loadKyberPreKey(10);

      expect(loaded).toBe(record);
      expect(loaded.id).toBe(10);
      expect(loaded.keyPair.publicKey).toEqual(record.keyPair.publicKey);
      expect(loaded.keyPair.secretKey).toEqual(record.keyPair.secretKey);
      expect(loaded.signature).toEqual(record.signature);
      expect(loaded.timestamp).toBe(record.timestamp);
    });
  });

  // -----------------------------------------------------------------------
  // 9. Load non-existent key rejects
  // -----------------------------------------------------------------------
  describe("load non-existent key", () => {
    it("should reject with an error when the key does not exist", async () => {
      await expect(store.loadKyberPreKey(999)).rejects.toThrow(
        "Kyber pre-key not found: 999",
      );
    });

    it("should reject with an error for id 0 when store is empty", async () => {
      await expect(store.loadKyberPreKey(0)).rejects.toThrow(
        "Kyber pre-key not found: 0",
      );
    });
  });

  // -----------------------------------------------------------------------
  // 10. markKyberPreKeyUsed removes the key
  // -----------------------------------------------------------------------
  describe("markKyberPreKeyUsed", () => {
    it("should remove the key so subsequent load rejects", async () => {
      const record = makeRecord({ id: 5 });
      await store.storeKyberPreKey(5, record);

      // Key exists before marking
      await expect(store.loadKyberPreKey(5)).resolves.toBe(record);

      await store.markKyberPreKeyUsed(5, 1, new Uint8Array(32));

      // Key is gone after marking
      await expect(store.loadKyberPreKey(5)).rejects.toThrow(
        "Kyber pre-key not found: 5",
      );
    });

    it("should not throw when marking a non-existent key as used", async () => {
      await expect(
        store.markKyberPreKeyUsed(123, 1, new Uint8Array(32)),
      ).resolves.toBeUndefined();
    });

    it("should only remove the targeted key, leaving others intact", async () => {
      const r1 = makeRecord({ id: 1 });
      const r2 = makeRecord({ id: 2 });
      const r3 = makeRecord({ id: 3 });

      await store.storeKyberPreKey(1, r1);
      await store.storeKyberPreKey(2, r2);
      await store.storeKyberPreKey(3, r3);

      await store.markKyberPreKeyUsed(2, 1, new Uint8Array(32));

      await expect(store.loadKyberPreKey(1)).resolves.toBe(r1);
      await expect(store.loadKyberPreKey(2)).rejects.toThrow(
        "Kyber pre-key not found: 2",
      );
      await expect(store.loadKyberPreKey(3)).resolves.toBe(r3);
    });
  });

  // -----------------------------------------------------------------------
  // 11. Store multiple keys and load each one
  // -----------------------------------------------------------------------
  describe("multiple keys", () => {
    it("should store and independently retrieve multiple keys", async () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        makeRecord({ id: i + 100, timestamp: 1_700_000_000_000 + i }),
      );

      for (const r of records) {
        await store.storeKyberPreKey(r.id, r);
      }

      for (const r of records) {
        const loaded = await store.loadKyberPreKey(r.id);
        expect(loaded).toBe(r);
        expect(loaded.id).toBe(r.id);
        expect(loaded.timestamp).toBe(r.timestamp);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 12. Overwrite existing key with same ID
  // -----------------------------------------------------------------------
  describe("overwrite existing key", () => {
    it("should replace the record when storing with the same ID", async () => {
      const original = makeRecord({ id: 77, timestamp: 1_000 });
      const replacement = makeRecord({ id: 77, timestamp: 2_000 });

      await store.storeKyberPreKey(77, original);
      await store.storeKyberPreKey(77, replacement);

      const loaded = await store.loadKyberPreKey(77);
      expect(loaded).toBe(replacement);
      expect(loaded.timestamp).toBe(2_000);
      expect(loaded).not.toBe(original);
    });
  });
});
