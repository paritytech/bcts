/**
 * Tests for the X25519 key agreement module (Phase 4)
 *
 * Tests for:
 * - X25519PrivateKey creation, key derivation, CBOR, UR serialization
 * - X25519PublicKey creation, CBOR, UR serialization
 * - ECDH key agreement
 */

import { X25519PrivateKey, X25519PublicKey, SymmetricKey, hexToBytes, bytesToHex } from "../src";
import { SecureRandomNumberGenerator } from "@bcts/rand";

// Test vectors
const TEST_PRIVATE_KEY_HEX = "7d68fb6fce4c86fc4527d27c7c50fbee5f9e5dc5c4e6c1d8e5f4e3d2c1b0a090";
const TEST_KEY_MATERIAL = new TextEncoder().encode("test key material for derivation");

describe("X25519PrivateKey", () => {
  describe("creation", () => {
    it("should create a new random key", () => {
      const key = X25519PrivateKey.new();
      expect(key).toBeInstanceOf(X25519PrivateKey);
      expect(key.data().length).toBe(32);
    });

    it("should create unique random keys", () => {
      const key1 = X25519PrivateKey.random();
      const key2 = X25519PrivateKey.random();
      expect(key1.equals(key2)).toBe(false);
    });

    it("should create from raw data", () => {
      const data = hexToBytes(TEST_PRIVATE_KEY_HEX);
      const key = X25519PrivateKey.fromData(data);
      expect(key.hex()).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should create using fromDataRef", () => {
      const data = hexToBytes(TEST_PRIVATE_KEY_HEX);
      const key = X25519PrivateKey.fromDataRef(data);
      expect(key.hex()).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should throw on wrong size with fromDataRef", () => {
      const data = new Uint8Array(16);
      expect(() => X25519PrivateKey.fromDataRef(data)).toThrow();
    });

    it("should create using from (legacy alias)", () => {
      const data = hexToBytes(TEST_PRIVATE_KEY_HEX);
      const key = X25519PrivateKey.from(data);
      expect(key.hex()).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should create from hex string", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      expect(key.hex()).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should create using provided RNG", () => {
      const rng = new SecureRandomNumberGenerator();
      const key = X25519PrivateKey.newUsing(rng);
      expect(key).toBeInstanceOf(X25519PrivateKey);
      expect(key.data().length).toBe(32);
    });
  });

  describe("keypair", () => {
    it("should create keypair", () => {
      const [privateKey, publicKey] = X25519PrivateKey.keypair();

      expect(privateKey).toBeInstanceOf(X25519PrivateKey);
      expect(publicKey).toBeInstanceOf(X25519PublicKey);
      expect(privateKey.publicKey().equals(publicKey)).toBe(true);
    });

    it("should create keypair using provided RNG", () => {
      const rng = new SecureRandomNumberGenerator();
      const [privateKey, publicKey] = X25519PrivateKey.keypairUsing(rng);

      expect(privateKey).toBeInstanceOf(X25519PrivateKey);
      expect(publicKey).toBeInstanceOf(X25519PublicKey);
      expect(privateKey.publicKey().equals(publicKey)).toBe(true);
    });
  });

  describe("deriveFromKeyMaterial", () => {
    it("should derive key from key material", () => {
      const key = X25519PrivateKey.deriveFromKeyMaterial(TEST_KEY_MATERIAL);
      expect(key).toBeInstanceOf(X25519PrivateKey);
      expect(key.data().length).toBe(32);
    });

    it("should produce deterministic keys from same material", () => {
      const key1 = X25519PrivateKey.deriveFromKeyMaterial(TEST_KEY_MATERIAL);
      const key2 = X25519PrivateKey.deriveFromKeyMaterial(TEST_KEY_MATERIAL);
      expect(key1.equals(key2)).toBe(true);
    });

    it("should produce different keys from different material", () => {
      const material1 = new TextEncoder().encode("material 1");
      const material2 = new TextEncoder().encode("material 2");
      const key1 = X25519PrivateKey.deriveFromKeyMaterial(material1);
      const key2 = X25519PrivateKey.deriveFromKeyMaterial(material2);
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      expect(key.data()).toBeInstanceOf(Uint8Array);
      expect(key.data().length).toBe(32);
    });

    it("should return hex representation", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      expect(key.hex()).toBe(TEST_PRIVATE_KEY_HEX);
      expect(key.toHex()).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should return base64 representation", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      expect(key.toBase64()).toBeTruthy();
    });

    it("should return string representation", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      expect(key.toString()).toContain("X25519PrivateKey");
    });
  });

  describe("publicKey", () => {
    it("should derive public key", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      expect(publicKey).toBeInstanceOf(X25519PublicKey);
      expect(publicKey.data().length).toBe(32);
    });

    it("should cache derived public key", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey1 = privateKey.publicKey();
      const publicKey2 = privateKey.publicKey();
      expect(publicKey1).toBe(publicKey2); // Same instance
    });
  });

  describe("key agreement", () => {
    it("should compute shared key with sharedKeyWith", () => {
      const [alicePrivate, alicePublic] = X25519PrivateKey.keypair();
      const [bobPrivate, bobPublic] = X25519PrivateKey.keypair();

      const aliceShared = alicePrivate.sharedKeyWith(bobPublic);
      const bobShared = bobPrivate.sharedKeyWith(alicePublic);

      expect(aliceShared).toBeInstanceOf(SymmetricKey);
      expect(bobShared).toBeInstanceOf(SymmetricKey);
      expect(aliceShared.equals(bobShared)).toBe(true);
    });

    it("should compute shared secret with sharedSecret (legacy)", () => {
      const [alicePrivate, alicePublic] = X25519PrivateKey.keypair();
      const [bobPrivate, bobPublic] = X25519PrivateKey.keypair();

      const aliceShared = alicePrivate.sharedSecret(bobPublic);
      const bobShared = bobPrivate.sharedSecret(alicePublic);

      expect(aliceShared).toBeInstanceOf(Uint8Array);
      expect(bobShared).toBeInstanceOf(Uint8Array);
      expect(bytesToHex(aliceShared)).toBe(bytesToHex(bobShared));
    });

    it("should produce different shared secrets with different keys", () => {
      const [alice1] = X25519PrivateKey.keypair();
      const [alice2] = X25519PrivateKey.keypair();
      const [_bob, bobPublic] = X25519PrivateKey.keypair();

      const shared1 = alice1.sharedKeyWith(bobPublic);
      const shared2 = alice2.sharedKeyWith(bobPublic);

      expect(shared1.equals(shared2)).toBe(false);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      expect(key.equals(key)).toBe(true);
    });

    it("should be equal to another key with same data", () => {
      const key1 = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const key2 = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      expect(key1.equals(key2)).toBe(true);
    });

    it("should not be equal to a key with different data", () => {
      const key1 = X25519PrivateKey.random();
      const key2 = X25519PrivateKey.random();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const key = X25519PrivateKey.random();
      const tags = key.cborTags();
      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40010);
    });

    it("should serialize to untagged CBOR", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const cbor = key.untaggedCbor();
      expect(cbor).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const cbor = key.taggedCbor();
      expect(cbor).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const data = key.taggedCborData();
      expect(data).toBeInstanceOf(Uint8Array);
    });

    it("should roundtrip through tagged CBOR", () => {
      const original = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const data = original.taggedCborData();
      const restored = X25519PrivateKey.fromTaggedCborData(data);
      expect(restored.equals(original)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const original = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const data = original.untaggedCbor().toData();
      const restored = X25519PrivateKey.fromUntaggedCborData(data);
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const ur = key.ur();
      expect(ur.urTypeStr()).toBe("agreement-private-key");
    });

    it("should serialize to UR string", () => {
      const key = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const urString = key.urString();
      expect(urString).toContain("ur:agreement-private-key");
    });

    it("should roundtrip through UR string", () => {
      const original = X25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const urString = original.urString();
      const restored = X25519PrivateKey.fromURString(urString);
      expect(restored.equals(original)).toBe(true);
    });

    it("should throw on invalid UR type", () => {
      const key = X25519PrivateKey.random();
      const urString = key.urString().replace("agreement-private-key", "invalid-type");
      expect(() => X25519PrivateKey.fromURString(urString)).toThrow();
    });
  });
});

describe("X25519PublicKey", () => {
  describe("creation", () => {
    it("should create from raw data", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const data = publicKey.data();

      const restored = X25519PublicKey.fromData(data);
      expect(restored.equals(publicKey)).toBe(true);
    });

    it("should create using fromDataRef", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const data = publicKey.data();

      const restored = X25519PublicKey.fromDataRef(data);
      expect(restored.equals(publicKey)).toBe(true);
    });

    it("should throw on wrong size with fromDataRef", () => {
      const data = new Uint8Array(16);
      expect(() => X25519PublicKey.fromDataRef(data)).toThrow();
    });

    it("should create using from (legacy alias)", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const data = publicKey.data();

      const restored = X25519PublicKey.from(data);
      expect(restored.equals(publicKey)).toBe(true);
    });

    it("should create from hex string", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const hex = publicKey.hex();

      const restored = X25519PublicKey.fromHex(hex);
      expect(restored.equals(publicKey)).toBe(true);
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      expect(publicKey.data()).toBeInstanceOf(Uint8Array);
      expect(publicKey.data().length).toBe(32);
    });

    it("should return hex representation", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      expect(publicKey.hex().length).toBe(64);
      expect(publicKey.toHex()).toBe(publicKey.hex());
    });

    it("should return base64 representation", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      expect(publicKey.toBase64()).toBeTruthy();
    });

    it("should return string representation", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      expect(publicKey.toString()).toContain("X25519PublicKey");
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      expect(publicKey.equals(publicKey)).toBe(true);
    });

    it("should be equal to another key with same data", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey1 = privateKey.publicKey();
      const publicKey2 = X25519PublicKey.fromData(publicKey1.data());
      expect(publicKey1.equals(publicKey2)).toBe(true);
    });

    it("should not be equal to a key with different data", () => {
      const key1 = X25519PrivateKey.random().publicKey();
      const key2 = X25519PrivateKey.random().publicKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const tags = publicKey.cborTags();
      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40011);
    });

    it("should serialize to untagged CBOR", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const cbor = publicKey.untaggedCbor();
      expect(cbor).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const cbor = publicKey.taggedCbor();
      expect(cbor).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const data = publicKey.taggedCborData();
      expect(data).toBeInstanceOf(Uint8Array);
    });

    it("should roundtrip through tagged CBOR", () => {
      const privateKey = X25519PrivateKey.random();
      const original = privateKey.publicKey();
      const data = original.taggedCborData();
      const restored = X25519PublicKey.fromTaggedCborData(data);
      expect(restored.equals(original)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const privateKey = X25519PrivateKey.random();
      const original = privateKey.publicKey();
      const data = original.untaggedCbor().toData();
      const restored = X25519PublicKey.fromUntaggedCborData(data);
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const ur = publicKey.ur();
      expect(ur.urTypeStr()).toBe("agreement-public-key");
    });

    it("should serialize to UR string", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const urString = publicKey.urString();
      expect(urString).toContain("ur:agreement-public-key");
    });

    it("should roundtrip through UR string", () => {
      const privateKey = X25519PrivateKey.random();
      const original = privateKey.publicKey();
      const urString = original.urString();
      const restored = X25519PublicKey.fromURString(urString);
      expect(restored.equals(original)).toBe(true);
    });

    it("should throw on invalid UR type", () => {
      const privateKey = X25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const urString = publicKey.urString().replace("agreement-public-key", "invalid-type");
      expect(() => X25519PublicKey.fromURString(urString)).toThrow();
    });
  });
});

describe("X25519 key agreement integration", () => {
  it("should allow Alice and Bob to establish shared secret", () => {
    // Alice generates her keypair
    const [alicePrivate, alicePublic] = X25519PrivateKey.keypair();

    // Bob generates his keypair
    const [bobPrivate, bobPublic] = X25519PrivateKey.keypair();

    // Alice computes shared secret using Bob's public key
    const aliceShared = alicePrivate.sharedKeyWith(bobPublic);

    // Bob computes shared secret using Alice's public key
    const bobShared = bobPrivate.sharedKeyWith(alicePublic);

    // Both should arrive at the same shared secret
    expect(aliceShared.equals(bobShared)).toBe(true);

    // The shared key can be used for symmetric encryption
    expect(aliceShared.data().length).toBe(32);
  });

  it("should work with serialized keys", () => {
    // Alice generates keypair and serializes public key
    const [alicePrivate, alicePublic] = X25519PrivateKey.keypair();
    const alicePublicUR = alicePublic.urString();

    // Bob generates keypair and serializes public key
    const [bobPrivate, bobPublic] = X25519PrivateKey.keypair();
    const bobPublicUR = bobPublic.urString();

    // Alice deserializes Bob's public key and computes shared secret
    const bobPublicRestored = X25519PublicKey.fromURString(bobPublicUR);
    const aliceShared = alicePrivate.sharedKeyWith(bobPublicRestored);

    // Bob deserializes Alice's public key and computes shared secret
    const alicePublicRestored = X25519PublicKey.fromURString(alicePublicUR);
    const bobShared = bobPrivate.sharedKeyWith(alicePublicRestored);

    // Both should arrive at the same shared secret
    expect(aliceShared.equals(bobShared)).toBe(true);
  });

  it("should produce deterministic results with derived keys", () => {
    const keyMaterial = new TextEncoder().encode("shared secret derivation material");

    // Both parties derive the same private key from shared material
    const alice = X25519PrivateKey.deriveFromKeyMaterial(keyMaterial);
    const bob = X25519PrivateKey.deriveFromKeyMaterial(keyMaterial);

    // Both keys should be identical
    expect(alice.equals(bob)).toBe(true);
    expect(alice.publicKey().equals(bob.publicKey())).toBe(true);
  });
});
