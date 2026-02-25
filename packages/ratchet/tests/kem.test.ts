/**
 * Tests for KEM (Key Encapsulation Mechanism) support -- PQXDH v4.
 *
 * Tests are organized so pure KEM operations (no IdentityKeyPair dependency)
 * run independently. Integration tests that depend on IdentityKeyPair (and
 * transitively on xeddsa) are in a separate describe block.
 */

import { describe, it, expect } from "vitest";
import {
  KemType,
  kemGenerateKeyPair,
  kemEncapsulate,
  kemDecapsulate,
  kemSerializePublicKey,
  DEFAULT_KEM_TYPE,
  KYBER768_PUBLIC_KEY_SIZE,
  KYBER768_SECRET_KEY_SIZE,
  KYBER768_CIPHERTEXT_SIZE,
  KYBER768_SHARED_SECRET_SIZE,
  KYBER1024_PUBLIC_KEY_SIZE,
  KYBER1024_SECRET_KEY_SIZE,
  KYBER1024_CIPHERTEXT_SIZE,
  KYBER1024_SHARED_SECRET_SIZE,
} from "../src/kem/kem-types.js";
import { KyberPreKeyRecord } from "../src/kem/kyber-pre-key.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { PreKeyBundle } from "../src/keys/pre-key-bundle.js";
import { InMemorySignalProtocolStore } from "../src/storage/in-memory-store.js";
import {
  InvalidKeyError,
  InvalidMessageError,
  BadKEMKeyLengthError,
  BadKEMCiphertextLengthError,
} from "../src/error.js";
import { createTestRng } from "./test-utils.js";

const rng = createTestRng();

describe("ML-KEM-1024 key generation", () => {
  it("should generate a key pair with correct sizes", () => {
    const kp = kemGenerateKeyPair();
    // ML-KEM-1024: publicKey = 1568 bytes, secretKey = 3168 bytes
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(1568);
    expect(kp.secretKey.length).toBe(3168);
  });

  it("should generate distinct key pairs", () => {
    const kp1 = kemGenerateKeyPair();
    const kp2 = kemGenerateKeyPair();
    expect(kp1.publicKey).not.toEqual(kp2.publicKey);
    expect(kp1.secretKey).not.toEqual(kp2.secretKey);
  });
});

describe("ML-KEM-1024 encapsulate/decapsulate", () => {
  it("should produce matching shared secrets", () => {
    const kp = kemGenerateKeyPair();
    const { ciphertext, sharedSecret } = kemEncapsulate(kp.publicKey);

    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(sharedSecret).toBeInstanceOf(Uint8Array);
    expect(sharedSecret.length).toBe(32);

    const decapsulated = kemDecapsulate(ciphertext, kp.secretKey);
    expect(decapsulated).toEqual(sharedSecret);
  });

  it("should produce different shared secrets for different encapsulations", () => {
    const kp = kemGenerateKeyPair();
    const result1 = kemEncapsulate(kp.publicKey);
    const result2 = kemEncapsulate(kp.publicKey);

    // Each encapsulation uses fresh randomness
    expect(result1.ciphertext).not.toEqual(result2.ciphertext);
    expect(result1.sharedSecret).not.toEqual(result2.sharedSecret);
  });

  it("should fail with wrong secret key", () => {
    const kp1 = kemGenerateKeyPair();
    const kp2 = kemGenerateKeyPair();
    const { ciphertext, sharedSecret } = kemEncapsulate(kp1.publicKey);

    // Decapsulating with a different secret key should yield a different shared secret
    const wrongSecret = kemDecapsulate(ciphertext, kp2.secretKey);
    expect(wrongSecret).not.toEqual(sharedSecret);
  });
});

describe("KyberPreKeyRecord", () => {
  it("should construct from explicit parameters", () => {
    const kp = kemGenerateKeyPair();
    const sig = new Uint8Array(64);
    const record = new KyberPreKeyRecord(42, kp, sig, 1000);

    expect(record.id).toBe(42);
    expect(record.keyPair).toBe(kp);
    expect(record.signature).toBe(sig);
    expect(record.timestamp).toBe(1000);
  });

  it("should generate a record with valid signature", () => {
    const identityKeyPair = IdentityKeyPair.generate(rng);
    const timestamp = Date.now();
    const record = KyberPreKeyRecord.generate(1, identityKeyPair, timestamp);

    expect(record.id).toBe(1);
    expect(record.timestamp).toBe(timestamp);
    expect(record.keyPair.publicKey.length).toBe(1568);
    expect(record.keyPair.secretKey.length).toBe(3168);
    expect(record.signature).toBeInstanceOf(Uint8Array);
    expect(record.signature.length).toBe(64); // Ed25519 signature

    // Verify the signature over the TYPE-PREFIXED public key (matches libsignal)
    const serializedPublicKey = kemSerializePublicKey(record.keyPair.publicKey, DEFAULT_KEM_TYPE);
    const valid = identityKeyPair.identityKey.verifySignature(
      serializedPublicKey,
      record.signature,
    );
    expect(valid).toBe(true);
  });
});

describe("KyberPreKeyStore (InMemorySignalProtocolStore)", () => {
  function createStore() {
    const identityKeyPair = IdentityKeyPair.generate(rng);
    return new InMemorySignalProtocolStore(identityKeyPair, 1);
  }

  it("should store and load a KyberPreKey", async () => {
    const store = createStore();
    const identityKeyPair = IdentityKeyPair.generate(rng);
    const record = KyberPreKeyRecord.generate(1, identityKeyPair, Date.now());

    await store.storeKyberPreKey(1, record);
    const loaded = await store.loadKyberPreKey(1);
    expect(loaded).toBe(record);
  });

  it("should throw on missing KyberPreKey", async () => {
    const store = createStore();
    await expect(store.loadKyberPreKey(999)).rejects.toThrow(InvalidKeyError);
  });

  it("should track base key usage for Kyber pre-keys (last-resort)", async () => {
    const store = createStore();
    const identityKeyPair = IdentityKeyPair.generate(rng);
    const record = KyberPreKeyRecord.generate(1, identityKeyPair, Date.now());

    await store.storeKyberPreKey(1, record);

    // Mark as used with 3 args (kyberPreKeyId, signedPreKeyId, baseKey)
    const baseKey = rng.randomData(32);
    await store.markKyberPreKeyUsed(1, 1, baseKey);

    // Key should still be loadable (last-resort, not deleted)
    const loaded = await store.loadKyberPreKey(1);
    expect(loaded).toBe(record);

    // Same base key should throw (replay detection)
    await expect(store.markKyberPreKeyUsed(1, 1, baseKey)).rejects.toThrow(InvalidMessageError);

    // Different base key should succeed
    const baseKey2 = rng.randomData(32);
    await store.markKyberPreKeyUsed(1, 1, baseKey2);
  });
});

// ---------------------------------------------------------------------------
// Kyber768 tests
// ---------------------------------------------------------------------------

describe("ML-KEM-768 (Kyber768) key generation", () => {
  it("should generate a key pair with correct sizes", () => {
    const kp = kemGenerateKeyPair(KemType.Kyber768);
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(KYBER768_PUBLIC_KEY_SIZE); // 1184
    expect(kp.secretKey.length).toBe(KYBER768_SECRET_KEY_SIZE); // 2400
  });

  it("key sizes should match exported constants", () => {
    expect(KYBER768_PUBLIC_KEY_SIZE).toBe(1184);
    expect(KYBER768_SECRET_KEY_SIZE).toBe(2400);
    expect(KYBER768_CIPHERTEXT_SIZE).toBe(1088);
    expect(KYBER768_SHARED_SECRET_SIZE).toBe(32);
  });
});

describe("ML-KEM-768 (Kyber768) encapsulate/decapsulate", () => {
  it("should produce matching shared secrets (round-trip)", () => {
    const kp = kemGenerateKeyPair(KemType.Kyber768);
    const { ciphertext, sharedSecret } = kemEncapsulate(kp.publicKey, KemType.Kyber768);

    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(ciphertext.length).toBe(KYBER768_CIPHERTEXT_SIZE); // 1088
    expect(sharedSecret).toBeInstanceOf(Uint8Array);
    expect(sharedSecret.length).toBe(KYBER768_SHARED_SECRET_SIZE); // 32

    const decapsulated = kemDecapsulate(ciphertext, kp.secretKey, KemType.Kyber768);
    expect(decapsulated).toEqual(sharedSecret);
  });

  it("should fail with wrong secret key", () => {
    const kp1 = kemGenerateKeyPair(KemType.Kyber768);
    const kp2 = kemGenerateKeyPair(KemType.Kyber768);
    const { ciphertext, sharedSecret } = kemEncapsulate(kp1.publicKey, KemType.Kyber768);

    const wrongSecret = kemDecapsulate(ciphertext, kp2.secretKey, KemType.Kyber768);
    expect(wrongSecret).not.toEqual(sharedSecret);
  });
});

// ---------------------------------------------------------------------------
// Kyber1024 constant validation
// ---------------------------------------------------------------------------

describe("ML-KEM-1024 (Kyber1024) constant validation", () => {
  it("key sizes should match exported constants", () => {
    expect(KYBER1024_PUBLIC_KEY_SIZE).toBe(1568);
    expect(KYBER1024_SECRET_KEY_SIZE).toBe(3168);
    expect(KYBER1024_CIPHERTEXT_SIZE).toBe(1568);
    expect(KYBER1024_SHARED_SECRET_SIZE).toBe(32);
  });

  it("generated keys should match constants", () => {
    const kp = kemGenerateKeyPair(KemType.Kyber1024);
    expect(kp.publicKey.length).toBe(KYBER1024_PUBLIC_KEY_SIZE);
    expect(kp.secretKey.length).toBe(KYBER1024_SECRET_KEY_SIZE);

    const { ciphertext, sharedSecret } = kemEncapsulate(kp.publicKey, KemType.Kyber1024);
    expect(ciphertext.length).toBe(KYBER1024_CIPHERTEXT_SIZE);
    expect(sharedSecret.length).toBe(KYBER1024_SHARED_SECRET_SIZE);
  });
});

// ---------------------------------------------------------------------------
// Key size validation error tests
// ---------------------------------------------------------------------------

describe("KEM key size validation", () => {
  it("should throw BadKEMKeyLengthError for wrong public key size on encapsulate", () => {
    const wrongPk = new Uint8Array(100);
    expect(() => kemEncapsulate(wrongPk, KemType.Kyber1024)).toThrow(BadKEMKeyLengthError);
    expect(() => kemEncapsulate(wrongPk, KemType.Kyber768)).toThrow(BadKEMKeyLengthError);
  });

  it("should throw BadKEMKeyLengthError for wrong secret key size on decapsulate", () => {
    const kp = kemGenerateKeyPair(KemType.Kyber1024);
    const { ciphertext } = kemEncapsulate(kp.publicKey, KemType.Kyber1024);
    const wrongSk = new Uint8Array(100);
    expect(() => kemDecapsulate(ciphertext, wrongSk, KemType.Kyber1024)).toThrow(
      BadKEMKeyLengthError,
    );
  });

  it("should throw BadKEMCiphertextLengthError for wrong ciphertext size on decapsulate", () => {
    const kp = kemGenerateKeyPair(KemType.Kyber1024);
    const wrongCt = new Uint8Array(100);
    expect(() => kemDecapsulate(wrongCt, kp.secretKey, KemType.Kyber1024)).toThrow(
      BadKEMCiphertextLengthError,
    );
  });

  it("should include correct fields in BadKEMKeyLengthError", () => {
    const wrongPk = new Uint8Array(42);
    try {
      kemEncapsulate(wrongPk, KemType.Kyber768);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BadKEMKeyLengthError);
      const err = e as BadKEMKeyLengthError;
      expect(err.keyType).toBe("Kyber768");
      expect(err.length).toBe(42);
    }
  });

  it("should include correct fields in BadKEMCiphertextLengthError", () => {
    const kp = kemGenerateKeyPair(KemType.Kyber768);
    const wrongCt = new Uint8Array(99);
    try {
      kemDecapsulate(wrongCt, kp.secretKey, KemType.Kyber768);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BadKEMCiphertextLengthError);
      const err = e as BadKEMCiphertextLengthError;
      expect(err.keyType).toBe("Kyber768");
      expect(err.length).toBe(99);
    }
  });
});

// ---------------------------------------------------------------------------
// ML-KEM-1024 (FIPS 203, type byte 0x0A) -- distinct from Kyber1024 (0x08)
// ---------------------------------------------------------------------------

describe("ML-KEM-1024 (KemType.MLKEM1024 = 0x0A) round-trip", () => {
  it("should have the correct type byte value (0x0A)", () => {
    expect(KemType.MLKEM1024).toBe(0x0a);
  });

  it("should generate key pair with correct sizes", () => {
    const kp = kemGenerateKeyPair(KemType.MLKEM1024);
    expect(kp.publicKey.length).toBe(KYBER1024_PUBLIC_KEY_SIZE);
    expect(kp.secretKey.length).toBe(KYBER1024_SECRET_KEY_SIZE);
  });

  it("should encapsulate/decapsulate with matching shared secrets", () => {
    const kp = kemGenerateKeyPair(KemType.MLKEM1024);
    const { ciphertext, sharedSecret } = kemEncapsulate(kp.publicKey, KemType.MLKEM1024);

    expect(sharedSecret.length).toBe(KYBER1024_SHARED_SECRET_SIZE);
    expect(ciphertext.length).toBe(KYBER1024_CIPHERTEXT_SIZE);

    const decapsulated = kemDecapsulate(ciphertext, kp.secretKey, KemType.MLKEM1024);
    expect(decapsulated).toEqual(sharedSecret);
  });

  it("should serialize public key with 0x0A type prefix", () => {
    const kp = kemGenerateKeyPair(KemType.MLKEM1024);
    const serialized = kemSerializePublicKey(kp.publicKey, KemType.MLKEM1024);

    expect(serialized.length).toBe(1 + KYBER1024_PUBLIC_KEY_SIZE);
    expect(serialized[0]).toBe(0x0a);
    expect(serialized.slice(1)).toEqual(kp.publicKey);
  });

  it("should use a different type byte than Kyber1024", () => {
    expect(KemType.Kyber1024).toBe(0x08);
    expect(KemType.MLKEM1024).toBe(0x0a);
    expect(KemType.MLKEM1024).not.toBe(KemType.Kyber1024);
  });

  it("should fail decapsulation with wrong secret key", () => {
    const kp1 = kemGenerateKeyPair(KemType.MLKEM1024);
    const kp2 = kemGenerateKeyPair(KemType.MLKEM1024);
    const { ciphertext, sharedSecret } = kemEncapsulate(kp1.publicKey, KemType.MLKEM1024);

    const wrongSecret = kemDecapsulate(ciphertext, kp2.secretKey, KemType.MLKEM1024);
    expect(wrongSecret).not.toEqual(sharedSecret);
  });

  it("should reject wrong-size public key for encapsulation", () => {
    const badPk = new Uint8Array(100);
    expect(() => kemEncapsulate(badPk, KemType.MLKEM1024)).toThrow(BadKEMKeyLengthError);
  });

  it("should reject wrong-size secret key for decapsulation", () => {
    const kp = kemGenerateKeyPair(KemType.MLKEM1024);
    const { ciphertext } = kemEncapsulate(kp.publicKey, KemType.MLKEM1024);
    const badSk = new Uint8Array(100);
    expect(() => kemDecapsulate(ciphertext, badSk, KemType.MLKEM1024)).toThrow(
      BadKEMKeyLengthError,
    );
  });

  it("should reject wrong-size ciphertext for decapsulation", () => {
    const kp = kemGenerateKeyPair(KemType.MLKEM1024);
    const badCt = new Uint8Array(100);
    expect(() => kemDecapsulate(badCt, kp.secretKey, KemType.MLKEM1024)).toThrow(
      BadKEMCiphertextLengthError,
    );
  });
});

describe("PreKeyBundle with Kyber fields", () => {
  it("should accept optional Kyber fields", () => {
    const identityKeyPair = IdentityKeyPair.generate(rng);
    const kyberKp = kemGenerateKeyPair();
    const serializedKyberKey = kemSerializePublicKey(kyberKp.publicKey, DEFAULT_KEM_TYPE);
    const kyberSig = identityKeyPair.sign(serializedKyberKey);

    const bundle = new PreKeyBundle({
      registrationId: 1,
      deviceId: 1,
      signedPreKeyId: 1,
      signedPreKey: new Uint8Array(32),
      signedPreKeySignature: new Uint8Array(64),
      identityKey: identityKeyPair.identityKey,
      kyberPreKeyId: 1,
      kyberPreKey: kyberKp.publicKey,
      kyberPreKeySignature: kyberSig,
    });

    expect(bundle.kyberPreKeyId).toBe(1);
    expect(bundle.kyberPreKey).toBe(kyberKp.publicKey);
    expect(bundle.kyberPreKeySignature).toBe(kyberSig);
  });

  it("should work without Kyber fields (backward compatible)", () => {
    const identityKeyPair = IdentityKeyPair.generate(rng);

    const bundle = new PreKeyBundle({
      registrationId: 1,
      deviceId: 1,
      signedPreKeyId: 1,
      signedPreKey: new Uint8Array(32),
      signedPreKeySignature: new Uint8Array(64),
      identityKey: identityKeyPair.identityKey,
    });

    expect(bundle.kyberPreKeyId).toBeUndefined();
    expect(bundle.kyberPreKey).toBeUndefined();
    expect(bundle.kyberPreKeySignature).toBeUndefined();
  });
});
