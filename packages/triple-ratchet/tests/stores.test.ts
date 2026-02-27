import { describe, it, expect, beforeEach } from "vitest";
import { KyberPreKeyRecord, InMemoryKyberPreKeyStore } from "../src/stores.js";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/** Fake ML-KEM-768 key pair (1184-byte public key, 2400-byte secret key). */
const fakeKeyPair = {
  publicKey: new Uint8Array(1184).fill(0xab),
  secretKey: new Uint8Array(2400).fill(0xcd),
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

    it("should roundtrip with fractional timestamp", () => {
      const ts = 1_700_000_000_000.5;
      const record = makeRecord({ timestamp: ts });
      const restored = KyberPreKeyRecord.deserialize(record.serialize());
      expect(restored.timestamp).toBe(ts);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Varying key sizes (ML-KEM-768 dimensions)
  // -----------------------------------------------------------------------
  describe("varying key sizes", () => {
    it("should handle ML-KEM-768 public key (1184 bytes) and secret key (2400 bytes)", () => {
      const record = makeRecord();
      const bytes = record.serialize();
      const restored = KyberPreKeyRecord.deserialize(bytes);

      expect(restored.keyPair.publicKey.length).toBe(1184);
      expect(restored.keyPair.secretKey.length).toBe(2400);
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

    it("should handle ML-KEM-1024 public key (1568 bytes) and secret key (3168 bytes)", () => {
      const pk = new Uint8Array(1568).fill(0x33);
      const sk = new Uint8Array(3168).fill(0x44);
      const record = makeRecord({ publicKey: pk, secretKey: sk });

      const restored = KyberPreKeyRecord.deserialize(record.serialize());

      expect(restored.keyPair.publicKey.length).toBe(1568);
      expect(restored.keyPair.secretKey.length).toBe(3168);
      expect(restored.keyPair.publicKey).toEqual(pk);
      expect(restored.keyPair.secretKey).toEqual(sk);
    });
  });

  // -----------------------------------------------------------------------
  // 4. deserialize rejects truncated data
  // -----------------------------------------------------------------------
  describe("deserialize with truncated data", () => {
    it("should reject a buffer shorter than the header (< 16 bytes)", () => {
      const short = new Uint8Array(10);
      expect(() => KyberPreKeyRecord.deserialize(short)).toThrow(
        "buffer too short for header",
      );
    });

    it("should reject an empty buffer", () => {
      expect(() => KyberPreKeyRecord.deserialize(new Uint8Array(0))).toThrow(
        "buffer too short for header",
      );
    });

    it("should reject a buffer truncated at signature data", () => {
      const record = makeRecord();
      const full = record.serialize();
      // Keep header (4+8) + sigLen (4) but chop the actual signature bytes
      const truncated = full.slice(0, 4 + 8 + 4 + 2);
      expect(() => KyberPreKeyRecord.deserialize(truncated)).toThrow(
        "truncated at signature data",
      );
    });

    it("should reject a buffer truncated at publicKey length", () => {
      const record = makeRecord();
      const full = record.serialize();
      const sigLen = fakeSignature.length;
      // Header (12) + sigLen field (4) + signature data, but no pkLen field
      const cutoff = 4 + 8 + 4 + sigLen;
      const truncated = full.slice(0, cutoff);
      expect(() => KyberPreKeyRecord.deserialize(truncated)).toThrow(
        "truncated at publicKey length",
      );
    });

    it("should reject a buffer truncated at publicKey data", () => {
      const record = makeRecord();
      const full = record.serialize();
      const sigLen = fakeSignature.length;
      // Header (12) + sigLen (4) + sig + pkLen (4) + partial pk
      const cutoff = 4 + 8 + 4 + sigLen + 4 + 10;
      const truncated = full.slice(0, cutoff);
      expect(() => KyberPreKeyRecord.deserialize(truncated)).toThrow(
        "truncated at publicKey data",
      );
    });

    it("should reject a buffer truncated at secretKey length", () => {
      const record = makeRecord();
      const full = record.serialize();
      const sigLen = fakeSignature.length;
      const pkLen = fakeKeyPair.publicKey.length;
      // Header + sig section + pk section, but no skLen field
      const cutoff = 4 + 8 + 4 + sigLen + 4 + pkLen;
      const truncated = full.slice(0, cutoff);
      expect(() => KyberPreKeyRecord.deserialize(truncated)).toThrow(
        "truncated at secretKey length",
      );
    });

    it("should reject a buffer truncated at secretKey data", () => {
      const record = makeRecord();
      const full = record.serialize();
      const sigLen = fakeSignature.length;
      const pkLen = fakeKeyPair.publicKey.length;
      // Header + sig section + pk section + skLen (4) + partial sk
      const cutoff = 4 + 8 + 4 + sigLen + 4 + pkLen + 4 + 100;
      const truncated = full.slice(0, cutoff);
      expect(() => KyberPreKeyRecord.deserialize(truncated)).toThrow(
        "truncated at secretKey data",
      );
    });
  });

  // -----------------------------------------------------------------------
  // 5. Empty signature
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
  // 6. Store and load a key
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
  // 7. Load non-existent key rejects
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
  // 8. markKyberPreKeyUsed removes the key
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
  // 9. Store multiple keys and load each one
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
  // 10. Overwrite existing key with same ID
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
