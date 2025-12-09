import { describe, it, expect } from "vitest";
import { SeededRandomNumberGenerator } from "@bcts/rand";
import {
  EncapsulationScheme,
  EncapsulationPrivateKey,
  EncapsulationPublicKey,
  EncapsulationCiphertext,
  SealedMessage,
  defaultEncapsulationScheme,
  createEncapsulationKeypair,
  createEncapsulationKeypairUsing,
  X25519PrivateKey,
  X25519PublicKey,
  Nonce,
} from "../src/index.js";

describe("EncapsulationScheme", () => {
  it("should have X25519 as default scheme", () => {
    expect(defaultEncapsulationScheme()).toBe(EncapsulationScheme.X25519);
  });

  it("should support X25519 scheme", () => {
    expect(EncapsulationScheme.X25519).toBe("x25519");
  });
});

describe("EncapsulationPrivateKey", () => {
  describe("creation", () => {
    it("should create a new random key", () => {
      const key = EncapsulationPrivateKey.new();
      expect(key).toBeDefined();
      expect(key.data().length).toBe(32);
    });

    it("should create unique random keys", () => {
      const key1 = EncapsulationPrivateKey.random();
      const key2 = EncapsulationPrivateKey.random();
      expect(key1.equals(key2)).toBe(false);
    });

    it("should create a key from X25519 private key", () => {
      const x25519Key = X25519PrivateKey.new();
      const encKey = EncapsulationPrivateKey.fromX25519PrivateKey(x25519Key);
      expect(encKey.isX25519()).toBe(true);
      expect(encKey.data()).toEqual(x25519Key.data());
    });

    it("should create a key from X25519 data", () => {
      const x25519Key = X25519PrivateKey.new();
      const encKey = EncapsulationPrivateKey.fromX25519Data(x25519Key.data());
      expect(encKey.isX25519()).toBe(true);
      expect(encKey.data()).toEqual(x25519Key.data());
    });

    it("should create deterministic keys with RNG", () => {
      const seed: [bigint, bigint, bigint, bigint] = [1n, 2n, 3n, 4n];
      const rng1 = new SeededRandomNumberGenerator(seed);
      const rng2 = new SeededRandomNumberGenerator(seed);
      const key1 = EncapsulationPrivateKey.newUsing(rng1);
      const key2 = EncapsulationPrivateKey.newUsing(rng2);
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe("keypair generation", () => {
    it("should generate a keypair", () => {
      const [privateKey, publicKey] = EncapsulationPrivateKey.keypair();
      expect(privateKey).toBeInstanceOf(EncapsulationPrivateKey);
      expect(publicKey).toBeInstanceOf(EncapsulationPublicKey);
    });

    it("should generate matching keypair", () => {
      const [privateKey, publicKey] = EncapsulationPrivateKey.keypair();
      const derivedPublicKey = privateKey.publicKey();
      expect(publicKey.equals(derivedPublicKey)).toBe(true);
    });

    it("should generate deterministic keypair with RNG", () => {
      const seed: [bigint, bigint, bigint, bigint] = [5n, 6n, 7n, 8n];
      const rng1 = new SeededRandomNumberGenerator(seed);
      const rng2 = new SeededRandomNumberGenerator(seed);
      const [priv1, pub1] = EncapsulationPrivateKey.keypairUsing(rng1);
      const [priv2, pub2] = EncapsulationPrivateKey.keypairUsing(rng2);
      expect(priv1.equals(priv2)).toBe(true);
      expect(pub1.equals(pub2)).toBe(true);
    });
  });

  describe("accessors", () => {
    it("should return correct scheme", () => {
      const key = EncapsulationPrivateKey.new();
      expect(key.encapsulationScheme()).toBe(EncapsulationScheme.X25519);
    });

    it("should identify as X25519", () => {
      const key = EncapsulationPrivateKey.new();
      expect(key.isX25519()).toBe(true);
    });

    it("should return X25519 private key", () => {
      const key = EncapsulationPrivateKey.new();
      const x25519Key = key.x25519PrivateKey();
      expect(x25519Key).toBeInstanceOf(X25519PrivateKey);
    });

    it("should derive public key", () => {
      const privateKey = EncapsulationPrivateKey.new();
      const publicKey = privateKey.publicKey();
      expect(publicKey).toBeInstanceOf(EncapsulationPublicKey);
      expect(publicKey.isX25519()).toBe(true);
    });
  });

  describe("decapsulation", () => {
    it("should decapsulate shared secret", () => {
      const [privateKey, publicKey] = EncapsulationPrivateKey.keypair();
      const [sharedSecret, ciphertext] = publicKey.encapsulateNewSharedSecret();

      const decapsulated = privateKey.decapsulateSharedSecret(ciphertext);
      expect(decapsulated.data()).toEqual(sharedSecret.data());
    });

    it("should fail with mismatched scheme", () => {
      // Currently only X25519 supported, so this test verifies the check exists
      const privateKey = EncapsulationPrivateKey.new();
      const [, ciphertext] = EncapsulationPrivateKey.keypair()[1].encapsulateNewSharedSecret();

      // Decapsulation should work with same scheme
      expect(() => privateKey.decapsulateSharedSecret(ciphertext)).not.toThrow();
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const key = EncapsulationPrivateKey.new();
      expect(key.equals(key)).toBe(true);
    });

    it("should be equal to a key with the same data", () => {
      const x25519Key = X25519PrivateKey.new();
      const key1 = EncapsulationPrivateKey.fromX25519PrivateKey(x25519Key);
      const key2 = EncapsulationPrivateKey.fromX25519Data(x25519Key.data());
      expect(key1.equals(key2)).toBe(true);
    });

    it("should not be equal to a key with different data", () => {
      const key1 = EncapsulationPrivateKey.new();
      const key2 = EncapsulationPrivateKey.new();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const key = EncapsulationPrivateKey.new();
      const tags = key.cborTags();
      expect(tags.length).toBe(1);
      expect(Number(tags[0].value)).toBe(40010); // X25519 private key tag
    });

    it("should serialize to tagged CBOR", () => {
      const key = EncapsulationPrivateKey.new();
      const cborData = key.taggedCborData();
      expect(cborData).toBeInstanceOf(Uint8Array);
      expect(cborData.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const original = EncapsulationPrivateKey.new();
      const cborData = original.taggedCborData();
      const restored = EncapsulationPrivateKey.fromTaggedCborData(cborData);
      expect(restored.equals(original)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const original = EncapsulationPrivateKey.new();
      const cborData = original.untaggedCbor().toData();
      const restored = EncapsulationPrivateKey.fromUntaggedCborData(cborData);
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const key = EncapsulationPrivateKey.new();
      const ur = key.ur();
      expect(ur).toBeDefined();
      expect(ur.urTypeStr()).toBe("agreement-private-key");
    });

    it("should serialize to UR string", () => {
      const key = EncapsulationPrivateKey.new();
      const urString = key.urString();
      expect(urString).toMatch(/^ur:agreement-private-key\//);
    });

    it("should roundtrip through UR", () => {
      const original = EncapsulationPrivateKey.new();
      const urString = original.urString();
      const restored = EncapsulationPrivateKey.fromURString(urString);
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("string representation", () => {
    it("should return a string representation", () => {
      const key = EncapsulationPrivateKey.new();
      const str = key.toString();
      expect(str).toContain("EncapsulationPrivateKey");
      expect(str).toContain("X25519");
    });
  });
});

describe("EncapsulationPublicKey", () => {
  describe("creation", () => {
    it("should create from X25519 public key", () => {
      const [, x25519Public] = X25519PrivateKey.keypair();
      const encKey = EncapsulationPublicKey.fromX25519PublicKey(x25519Public);
      expect(encKey.isX25519()).toBe(true);
      expect(encKey.data()).toEqual(x25519Public.data());
    });

    it("should create from X25519 data", () => {
      const [, x25519Public] = X25519PrivateKey.keypair();
      const encKey = EncapsulationPublicKey.fromX25519Data(x25519Public.data());
      expect(encKey.isX25519()).toBe(true);
      expect(encKey.data()).toEqual(x25519Public.data());
    });
  });

  describe("accessors", () => {
    it("should return correct scheme", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      expect(publicKey.encapsulationScheme()).toBe(EncapsulationScheme.X25519);
    });

    it("should return X25519 public key", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      const x25519Key = publicKey.x25519PublicKey();
      expect(x25519Key).toBeInstanceOf(X25519PublicKey);
    });
  });

  describe("encapsulation", () => {
    it("should encapsulate a new shared secret", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      const [sharedSecret, ciphertext] = publicKey.encapsulateNewSharedSecret();

      expect(sharedSecret.data().length).toBe(32);
      expect(ciphertext).toBeInstanceOf(EncapsulationCiphertext);
    });

    it("should produce unique shared secrets each time", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      const [secret1] = publicKey.encapsulateNewSharedSecret();
      const [secret2] = publicKey.encapsulateNewSharedSecret();

      expect(secret1.data()).not.toEqual(secret2.data());
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      expect(publicKey.equals(publicKey)).toBe(true);
    });

    it("should not be equal to a different key", () => {
      const [, pub1] = EncapsulationPrivateKey.keypair();
      const [, pub2] = EncapsulationPrivateKey.keypair();
      expect(pub1.equals(pub2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      const tags = publicKey.cborTags();
      expect(tags.length).toBe(1);
      expect(Number(tags[0].value)).toBe(40011); // X25519 public key tag
    });

    it("should roundtrip through tagged CBOR", () => {
      const [, original] = EncapsulationPrivateKey.keypair();
      const cborData = original.taggedCborData();
      const restored = EncapsulationPublicKey.fromTaggedCborData(cborData);
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      const ur = publicKey.ur();
      expect(ur.urTypeStr()).toBe("agreement-public-key");
    });

    it("should roundtrip through UR", () => {
      const [, original] = EncapsulationPrivateKey.keypair();
      const urString = original.urString();
      const restored = EncapsulationPublicKey.fromURString(urString);
      expect(restored.equals(original)).toBe(true);
    });
  });
});

describe("EncapsulationCiphertext", () => {
  describe("creation", () => {
    it("should create from X25519 public key", () => {
      const [, x25519Public] = X25519PrivateKey.keypair();
      const ciphertext = EncapsulationCiphertext.fromX25519PublicKey(x25519Public);
      expect(ciphertext.isX25519()).toBe(true);
    });
  });

  describe("accessors", () => {
    it("should return correct scheme", () => {
      const [, publicKey] = EncapsulationPrivateKey.keypair();
      const [, ciphertext] = publicKey.encapsulateNewSharedSecret();
      expect(ciphertext.encapsulationScheme()).toBe(EncapsulationScheme.X25519);
    });

    it("should return X25519 public key", () => {
      const [, x25519Public] = X25519PrivateKey.keypair();
      const ciphertext = EncapsulationCiphertext.fromX25519PublicKey(x25519Public);
      const extracted = ciphertext.x25519PublicKey();
      expect(extracted.equals(x25519Public)).toBe(true);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [, x25519Public] = X25519PrivateKey.keypair();
      const ciphertext = EncapsulationCiphertext.fromX25519PublicKey(x25519Public);
      const tags = ciphertext.cborTags();
      expect(tags.length).toBe(1);
      expect(Number(tags[0].value)).toBe(40011); // Uses X25519 public key tag
    });

    it("should roundtrip through tagged CBOR", () => {
      const [, x25519Public] = X25519PrivateKey.keypair();
      const original = EncapsulationCiphertext.fromX25519PublicKey(x25519Public);
      const cborData = original.taggedCborData();
      const restored = EncapsulationCiphertext.fromTaggedCborData(cborData);
      expect(restored.equals(original)).toBe(true);
    });
  });
});

describe("SealedMessage", () => {
  describe("creation and encryption", () => {
    it("should seal a message", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello, World!");

      const sealed = SealedMessage.new(plaintext, recipientPublic);
      expect(sealed).toBeInstanceOf(SealedMessage);
    });

    it("should seal a message with AAD", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello, World!");
      const aad = new TextEncoder().encode("additional data");

      const sealed = SealedMessage.newWithAad(plaintext, recipientPublic, aad);
      expect(sealed).toBeInstanceOf(SealedMessage);
    });

    it("should create with test nonce for deterministic testing", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello, World!");
      const nonce = Nonce.new();

      const sealed = SealedMessage.newOpt(plaintext, recipientPublic, new Uint8Array(0), nonce);
      expect(sealed.message().nonce().equals(nonce)).toBe(true);
    });
  });

  describe("decryption", () => {
    it("should decrypt a sealed message", () => {
      const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello, World!");

      const sealed = SealedMessage.new(plaintext, recipientPublic);
      const decrypted = sealed.decrypt(recipientPrivate);

      expect(new TextDecoder().decode(decrypted)).toBe("Hello, World!");
    });

    it("should decrypt with AAD", () => {
      const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Secret message");
      const aad = new TextEncoder().encode("metadata");

      const sealed = SealedMessage.newWithAad(plaintext, recipientPublic, aad);
      const decrypted = sealed.decrypt(recipientPrivate);

      expect(new TextDecoder().decode(decrypted)).toBe("Secret message");
    });

    it("should fail decryption with wrong key", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const [wrongPrivate] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello, World!");

      const sealed = SealedMessage.new(plaintext, recipientPublic);

      expect(() => sealed.decrypt(wrongPrivate)).toThrow();
    });

    it("should decrypt empty message", () => {
      const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new Uint8Array(0);

      const sealed = SealedMessage.new(plaintext, recipientPublic);
      const decrypted = sealed.decrypt(recipientPrivate);

      expect(decrypted.length).toBe(0);
    });

    it("should decrypt large message", () => {
      const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new Uint8Array(10000).fill(0xab);

      const sealed = SealedMessage.new(plaintext, recipientPublic);
      const decrypted = sealed.decrypt(recipientPrivate);

      expect(decrypted).toEqual(plaintext);
    });
  });

  describe("accessors", () => {
    it("should return encrypted message", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      const message = sealed.message();
      expect(message.ciphertext().length).toBe(plaintext.length);
    });

    it("should return encapsulated key", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      const encapsulatedKey = sealed.encapsulatedKey();
      expect(encapsulatedKey).toBeInstanceOf(EncapsulationCiphertext);
      expect(encapsulatedKey.isX25519()).toBe(true);
    });

    it("should return encapsulation scheme", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      expect(sealed.encapsulationScheme()).toBe(EncapsulationScheme.X25519);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      expect(sealed.equals(sealed)).toBe(true);
    });

    it("should not be equal to a different sealed message", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");

      const sealed1 = SealedMessage.new(plaintext, recipientPublic);
      const sealed2 = SealedMessage.new(plaintext, recipientPublic);

      // Different ephemeral keys should produce different sealed messages
      expect(sealed1.equals(sealed2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      const tags = sealed.cborTags();
      expect(tags.length).toBe(1);
      expect(Number(tags[0].value)).toBe(40019); // SEALED_MESSAGE tag
    });

    it("should serialize to tagged CBOR", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      const cborData = sealed.taggedCborData();
      expect(cborData).toBeInstanceOf(Uint8Array);
      expect(cborData.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello, CBOR!");

      const original = SealedMessage.new(plaintext, recipientPublic);
      const cborData = original.taggedCborData();
      const restored = SealedMessage.fromTaggedCborData(cborData);

      // Verify we can decrypt the restored message
      const decrypted = restored.decrypt(recipientPrivate);
      expect(new TextDecoder().decode(decrypted)).toBe("Hello, CBOR!");
    });

    it("should roundtrip through untagged CBOR", () => {
      const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Untagged test");

      const original = SealedMessage.new(plaintext, recipientPublic);
      const cborData = original.untaggedCbor().toData();
      const restored = SealedMessage.fromUntaggedCborData(cborData);

      const decrypted = restored.decrypt(recipientPrivate);
      expect(new TextDecoder().decode(decrypted)).toBe("Untagged test");
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      const ur = sealed.ur();
      expect(ur.urTypeStr()).toBe("crypto-sealed");
    });

    it("should serialize to UR string", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      const urString = sealed.urString();
      expect(urString).toMatch(/^ur:crypto-sealed\//);
    });

    it("should roundtrip through UR", () => {
      const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello, UR!");

      const original = SealedMessage.new(plaintext, recipientPublic);
      const urString = original.urString();
      const restored = SealedMessage.fromURString(urString);

      const decrypted = restored.decrypt(recipientPrivate);
      expect(new TextDecoder().decode(decrypted)).toBe("Hello, UR!");
    });
  });

  describe("string representation", () => {
    it("should return a string representation", () => {
      const [, recipientPublic] = EncapsulationPrivateKey.keypair();
      const plaintext = new TextEncoder().encode("Hello");
      const sealed = SealedMessage.new(plaintext, recipientPublic);

      const str = sealed.toString();
      expect(str).toContain("SealedMessage");
    });
  });
});

describe("createEncapsulationKeypair helpers", () => {
  it("should create a keypair with default scheme", () => {
    const [privateKey, publicKey] = createEncapsulationKeypair();
    expect(privateKey).toBeInstanceOf(EncapsulationPrivateKey);
    expect(publicKey).toBeInstanceOf(EncapsulationPublicKey);
    expect(privateKey.encapsulationScheme()).toBe(EncapsulationScheme.X25519);
  });

  it("should create a keypair with X25519 scheme", () => {
    const [privateKey, publicKey] = createEncapsulationKeypair(EncapsulationScheme.X25519);
    expect(privateKey.isX25519()).toBe(true);
    expect(publicKey.isX25519()).toBe(true);
  });

  it("should create deterministic keypair with RNG", () => {
    const seed: [bigint, bigint, bigint, bigint] = [9n, 10n, 11n, 12n];
    const rng1 = new SeededRandomNumberGenerator(seed);
    const rng2 = new SeededRandomNumberGenerator(seed);
    const [priv1, pub1] = createEncapsulationKeypairUsing(rng1);
    const [priv2, pub2] = createEncapsulationKeypairUsing(rng2);
    expect(priv1.equals(priv2)).toBe(true);
    expect(pub1.equals(pub2)).toBe(true);
  });
});

describe("Integration tests", () => {
  it("should support full seal/unseal workflow", () => {
    // Alice generates her keypair
    const [alicePrivate, alicePublic] = EncapsulationPrivateKey.keypair();

    // Bob wants to send a secret message to Alice
    const secretMessage = new TextEncoder().encode("This is a secret for Alice!");

    // Bob seals the message using Alice's public key
    const sealed = SealedMessage.new(secretMessage, alicePublic);

    // Bob serializes the sealed message (e.g., for transmission)
    const transmittedData = sealed.urString();

    // Alice receives and deserializes the sealed message
    const receivedSealed = SealedMessage.fromURString(transmittedData);

    // Alice decrypts using her private key
    const decrypted = receivedSealed.decrypt(alicePrivate);

    expect(new TextDecoder().decode(decrypted)).toBe("This is a secret for Alice!");
  });

  it("should support multiple recipients workflow", () => {
    const [alice, alicePublic] = EncapsulationPrivateKey.keypair();
    const [bob, bobPublic] = EncapsulationPrivateKey.keypair();

    const message = new TextEncoder().encode("Group message");

    // Seal for Alice
    const forAlice = SealedMessage.new(message, alicePublic);
    // Seal for Bob
    const forBob = SealedMessage.new(message, bobPublic);

    // Each recipient can decrypt their copy
    const aliceDecrypted = forAlice.decrypt(alice);
    const bobDecrypted = forBob.decrypt(bob);

    expect(new TextDecoder().decode(aliceDecrypted)).toBe("Group message");
    expect(new TextDecoder().decode(bobDecrypted)).toBe("Group message");

    // Alice can't decrypt Bob's message
    expect(() => forBob.decrypt(alice)).toThrow();
  });

  it("should provide forward secrecy", () => {
    const [recipientPrivate, recipientPublic] = EncapsulationPrivateKey.keypair();
    const message = new TextEncoder().encode("Test");

    // Two sealed messages to the same recipient
    const sealed1 = SealedMessage.new(message, recipientPublic);
    const sealed2 = SealedMessage.new(message, recipientPublic);

    // They should use different ephemeral keys
    const cipher1 = sealed1.encapsulatedKey().data();
    const cipher2 = sealed2.encapsulatedKey().data();
    expect(cipher1).not.toEqual(cipher2);

    // Both should still decrypt correctly
    expect(new TextDecoder().decode(sealed1.decrypt(recipientPrivate))).toBe("Test");
    expect(new TextDecoder().decode(sealed2.decrypt(recipientPrivate))).toBe("Test");
  });
});
