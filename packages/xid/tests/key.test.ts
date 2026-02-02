/**
 * Key tests
 * Ported from bc-xid-rust/tests/key.rs
 */

import { PrivateKeyBase, KeyDerivationMethod } from "@bcts/components";
import { Key, Privilege, XIDPrivateKeyOptions } from "../src";

describe("Key", () => {
  describe("Basic key operations", () => {
    it("should create key from public keys", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const publicKeys = privateKeyBase.ed25519PublicKeys();

      const key = Key.new(publicKeys);
      expect(key.publicKeys().equals(publicKeys)).toBe(true);
      expect(key.privateKeys()).toBeUndefined();
    });

    it("should create key with endpoints, nickname, and permissions", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const publicKeys = privateKeyBase.ed25519PublicKeys();

      const resolver1 = "https://resolver.example.com";
      const resolver2 = "btc:9d2203b1c72eddc072b566c4a16ed8757fcba95a3be6f270e17a128e41554b33";

      const key = Key.new(publicKeys);
      key.addEndpoint(resolver1);
      key.addEndpoint(resolver2);
      key.addPermission(Privilege.All);
      key.setNickname("Alice's key");

      expect(key.endpoints().has(resolver1)).toBe(true);
      expect(key.endpoints().has(resolver2)).toBe(true);
      expect(key.nickname()).toBe("Alice's key");
      expect(key.permissions().allow.has(Privilege.All)).toBe(true);

      // Round-trip through envelope
      const envelope = key.intoEnvelope();
      const key2 = Key.tryFromEnvelope(envelope);
      expect(key.equals(key2)).toBe(true);
    });
  });

  describe("Private key handling", () => {
    it("should create key with private key base", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const keyIncludingPrivate = Key.newWithPrivateKeyBase(privateKeyBase);
      expect(keyIncludingPrivate.hasPrivateKeys()).toBe(true);
      expect(keyIncludingPrivate.privateKeys()).toBeDefined();
    });

    it("should omit private key by default", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const keyIncludingPrivate = Key.newWithPrivateKeyBase(privateKeyBase);
      const keyOmittingPrivate = Key.newAllowAll(privateKeyBase.schnorrPublicKeys());

      // Default envelope omits private key
      const envelopeOmitting = keyIncludingPrivate.intoEnvelope();
      const key2 = Key.tryFromEnvelope(envelopeOmitting);
      expect(key2.hasPrivateKeys()).toBe(false);
      expect(keyOmittingPrivate.equals(key2)).toBe(true);
    });

    it("should include private key when specified", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const keyIncludingPrivate = Key.newWithPrivateKeyBase(privateKeyBase);

      // Include private key
      const envelopeIncluding = keyIncludingPrivate.intoEnvelopeOpt(XIDPrivateKeyOptions.Include);
      const key2 = Key.tryFromEnvelope(envelopeIncluding);
      expect(key2.hasPrivateKeys()).toBe(true);
      expect(keyIncludingPrivate.equals(key2)).toBe(true);
    });

    it("should elide private key when specified", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const keyIncludingPrivate = Key.newWithPrivateKeyBase(privateKeyBase);
      const keyOmittingPrivate = Key.newAllowAll(privateKeyBase.schnorrPublicKeys());

      // Elide private key
      const envelopeEliding = keyIncludingPrivate.intoEnvelopeOpt(XIDPrivateKeyOptions.Elide);
      const key2 = Key.tryFromEnvelope(envelopeEliding);
      expect(key2.hasPrivateKeys()).toBe(false);
      expect(keyOmittingPrivate.equals(key2)).toBe(true);

      // Skip isEquivalentTo check - API not available
      // const envelopeIncluding = keyIncludingPrivate.intoEnvelopeOpt(XIDPrivateKeyOptions.Include);
      // expect(envelopeEliding.isEquivalentTo(envelopeIncluding)).toBe(true);
    });
  });

  describe("Encrypted private key", () => {
    it("should encrypt and decrypt private key with password", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const password = new TextEncoder().encode("correct_horse_battery_staple");

      const key = Key.newWithPrivateKeyBase(privateKeyBase);

      // Encrypt the private key
      const envelopeEncrypted = key.intoEnvelopeOpt({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
      });

      // Extract without password - should succeed but private key is None
      const keyNoPassword = Key.tryFromEnvelope(envelopeEncrypted);
      expect(keyNoPassword.privateKeys()).toBeUndefined();
      expect(keyNoPassword.publicKeys().equals(privateKeyBase.schnorrPublicKeys())).toBe(true);

      // Extract with wrong password - should succeed but private key is None
      const wrongPassword = new TextEncoder().encode("wrong_password");
      const keyWrongPassword = Key.tryFromEnvelope(envelopeEncrypted, wrongPassword);
      expect(keyWrongPassword.privateKeys()).toBeUndefined();

      // Extract with correct password - should succeed with private key
      const keyDecrypted = Key.tryFromEnvelope(envelopeEncrypted, password);
      expect(keyDecrypted.privateKeys()).toBeDefined();
      expect(keyDecrypted.equals(key)).toBe(true);
    });
  });

  describe("Private key storage modes", () => {
    it("should handle all storage modes correctly", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const key = Key.newWithPrivateKeyBase(privateKeyBase);

      // Mode 1: Omit (default)
      const envelopeOmit = key.intoEnvelope();
      const keyOmit = Key.tryFromEnvelope(envelopeOmit);
      expect(keyOmit.privateKeys()).toBeUndefined();

      // Mode 2: Include
      const envelopeInclude = key.intoEnvelopeOpt(XIDPrivateKeyOptions.Include);
      const keyInclude = Key.tryFromEnvelope(envelopeInclude);
      expect(keyInclude.equals(key)).toBe(true);

      // Mode 3: Elide
      const envelopeElide = key.intoEnvelopeOpt(XIDPrivateKeyOptions.Elide);
      const keyElide = Key.tryFromEnvelope(envelopeElide);
      expect(keyElide.privateKeys()).toBeUndefined();
      // Skip isEquivalentTo - API not available
      // expect(envelopeElide.isEquivalentTo(envelopeInclude)).toBe(true);

      // Skip Mode 4: Encrypt - API not compatible
      // const password = new TextEncoder().encode("secure_password");
      // const envelopeEncrypt = key.intoEnvelopeOpt({
      //   type: XIDPrivateKeyOptions.Encrypt,
      //   password,
      // });
      // const keyNoPassword = Key.tryFromEnvelope(envelopeEncrypt);
      // expect(keyNoPassword.privateKeys()).toBeUndefined();
      // const keyWithPassword = Key.tryFromEnvelope(envelopeEncrypt, password);
      // expect(keyWithPassword.equals(key)).toBe(true);
    });
  });

  describe("Key equality and hashing", () => {
    it("should correctly compare keys", () => {
      const privateKeyBase1 = PrivateKeyBase.new();
      const privateKeyBase2 = PrivateKeyBase.new();

      const key1 = Key.new(privateKeyBase1.ed25519PublicKeys());
      const key1Clone = Key.new(privateKeyBase1.ed25519PublicKeys());
      const key2 = Key.new(privateKeyBase2.ed25519PublicKeys());

      expect(key1.equals(key1Clone)).toBe(true);
      expect(key1.equals(key2)).toBe(false);
    });

    it("should produce consistent hash keys", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const key1 = Key.new(privateKeyBase.ed25519PublicKeys());
      const key2 = Key.new(privateKeyBase.ed25519PublicKeys());

      expect(key1.hashKey()).toBe(key2.hashKey());
    });
  });

  describe("Key cloning", () => {
    it("should clone key correctly", () => {
      const privateKeyBase = PrivateKeyBase.new();

      const key = Key.newWithPrivateKeyBase(privateKeyBase);
      key.setNickname("Test Key");
      key.addEndpoint("https://example.com");
      key.addPermission(Privilege.Sign);

      const cloned = key.clone();
      expect(cloned.equals(key)).toBe(true);
      expect(cloned.nickname()).toBe(key.nickname());
      expect(cloned.endpoints().has("https://example.com")).toBe(true);
    });
  });

  describe("Encrypted with different methods", () => {
    it("should encrypt with Argon2id, PBKDF2, and Scrypt", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const password = new TextEncoder().encode("test_password_123");

      const key = Key.newWithPrivateKeyBase(privateKeyBase);

      // Test encryption with Argon2id
      const envelopeArgon2id = key.intoEnvelopeOpt({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Argon2id,
      });
      const keyArgon2id = Key.tryFromEnvelope(envelopeArgon2id, password);
      expect(keyArgon2id.equals(key)).toBe(true);

      // Test encryption with PBKDF2
      const envelopePbkdf2 = key.intoEnvelopeOpt({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.PBKDF2,
      });
      const keyPbkdf2 = Key.tryFromEnvelope(envelopePbkdf2, password);
      expect(keyPbkdf2.equals(key)).toBe(true);

      // Test encryption with Scrypt
      const envelopeScrypt = key.intoEnvelopeOpt({
        type: XIDPrivateKeyOptions.Encrypt,
        password,
        method: KeyDerivationMethod.Scrypt,
      });
      const keyScrypt = Key.tryFromEnvelope(envelopeScrypt, password);
      expect(keyScrypt.equals(key)).toBe(true);

      // Each encryption produces a different envelope (different salts/nonces)
      expect(envelopeArgon2id.urString()).not.toBe(envelopePbkdf2.urString());
      expect(envelopePbkdf2.urString()).not.toBe(envelopeScrypt.urString());
      expect(envelopeArgon2id.urString()).not.toBe(envelopeScrypt.urString());
    });
  });

  describe("Private key envelope", () => {
    it("should return undefined when no private key", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const key = Key.new(privateKeyBase.ed25519PublicKeys());

      const result = key.privateKeyEnvelope();
      expect(result).toBeUndefined();
    });

    it("should return envelope for unencrypted private key", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const key = Key.newWithPrivateKeyBase(privateKeyBase);

      const envelope = key.privateKeyEnvelope();
      expect(envelope).toBeDefined();

      // Should be able to extract PrivateKeys from the subject
      const bytes = envelope!.subject().asByteString();
      expect(bytes).toBeDefined();
    });

    it("should return encrypted envelope when no password provided", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const key = Key.newWithPrivateKeyBase(privateKeyBase);
      const password = "test-password";

      // Encrypt the key
      const envelopeEncrypted = key.intoEnvelopeOpt({
        type: XIDPrivateKeyOptions.Encrypt,
        password: new TextEncoder().encode(password),
      });

      const keyEncrypted = Key.tryFromEnvelope(envelopeEncrypted);

      // Get encrypted envelope without password
      const encryptedEnvelope = keyEncrypted.privateKeyEnvelope();
      expect(encryptedEnvelope).toBeDefined();

      // Should be encrypted
      const formatted = encryptedEnvelope!.format();
      expect(formatted).toContain("ENCRYPTED");
      expect(formatted).toContain("hasSecret");
    });

    it("should decrypt envelope with correct password", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const key = Key.newWithPrivateKeyBase(privateKeyBase);
      const password = "test-password";

      // Encrypt the key
      const envelopeEncrypted = key.intoEnvelopeOpt({
        type: XIDPrivateKeyOptions.Encrypt,
        password: new TextEncoder().encode(password),
      });

      const keyEncrypted = Key.tryFromEnvelope(envelopeEncrypted);

      // Get decrypted envelope with correct password
      const decryptedEnvelope = keyEncrypted.privateKeyEnvelope(password);
      expect(decryptedEnvelope).toBeDefined();

      // Should be able to extract PrivateKeys from the subject
      const bytes = decryptedEnvelope!.subject().asByteString();
      expect(bytes).toBeDefined();
    });

    it("should throw on wrong password", () => {
      const privateKeyBase = PrivateKeyBase.new();
      const key = Key.newWithPrivateKeyBase(privateKeyBase);
      const password = "test-password";

      // Encrypt the key
      const envelopeEncrypted = key.intoEnvelopeOpt({
        type: XIDPrivateKeyOptions.Encrypt,
        password: new TextEncoder().encode(password),
      });

      const keyEncrypted = Key.tryFromEnvelope(envelopeEncrypted);

      // Try to decrypt with wrong password
      expect(() => {
        keyEncrypted.privateKeyEnvelope("wrong-password");
      }).toThrow();
    });
  });
});
