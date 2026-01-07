import { Envelope, SymmetricKey } from "../src";

describe("Encryption Extension", () => {
  describe("Basic encryption", () => {
    it("should encrypt subject and preserve digest", () => {
      const envelope = Envelope.new("Secret message");
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);

      expect(envelope.digest().equals(encrypted.digest())).toBe(true);
      expect(encrypted.subject().isEncrypted()).toBe(true);
    });
  });

  describe("Decryption", () => {
    it("should decrypt to original content", () => {
      const envelope = Envelope.new("Secret message");
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);
      const decrypted = encrypted.decryptSubject(key);

      expect(decrypted.digest().equals(envelope.digest())).toBe(true);
      expect(decrypted.asText()).toBe("Secret message");
      expect(decrypted.isEncrypted()).toBe(false);
    });
  });

  describe("Full envelope encryption", () => {
    it("should encrypt entire envelope with assertions", () => {
      const envelope = Envelope.new("Alice")
        .addAssertion("email", "alice@example.com")
        .addAssertion("age", 30);
      const key = SymmetricKey.new();

      const encrypted = envelope.encrypt(key);

      expect(encrypted.isEncrypted()).toBe(true);
    });

    it("should decrypt entire envelope", () => {
      const envelope = Envelope.new("Alice")
        .addAssertion("email", "alice@example.com")
        .addAssertion("age", 30);
      const key = SymmetricKey.new();

      const encrypted = envelope.encrypt(key);
      const decrypted = encrypted.decrypt(key);

      expect(decrypted.subject().asText()).toBe("Alice");
      expect(decrypted.assertions().length).toBe(2);
    });
  });

  describe("Error handling", () => {
    it("should fail decryption with wrong key", () => {
      const envelope = Envelope.new("Secret message");
      const key = SymmetricKey.new();
      const wrongKey = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);

      expect(() => encrypted.decryptSubject(wrongKey)).toThrow();
    });

    it("should fail double encryption", () => {
      const envelope = Envelope.new("Secret message");
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);

      expect(() => encrypted.encryptSubject(key)).toThrow();
    });
  });

  describe("Subject-only encryption with assertions", () => {
    it("should encrypt subject while preserving assertions", () => {
      const envelope = Envelope.new("Alice")
        .addAssertion("email", "alice@example.com")
        .addAssertion("age", 30);
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);

      expect(encrypted.subject().isEncrypted()).toBe(true);
      expect(encrypted.assertions().length).toBe(2);

      const decrypted = encrypted.decryptSubject(key);

      expect(decrypted.digest().equals(envelope.digest())).toBe(true);
    });
  });

  describe("Key serialization", () => {
    it("should restore key from bytes", () => {
      const envelope = Envelope.new("Secret message");
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);

      const keyBytes = key.data();
      const restoredKey = SymmetricKey.from(keyBytes);
      const decrypted = encrypted.decryptSubject(restoredKey);

      expect(decrypted.asText()).toBe("Secret message");
    });
  });

  describe("Large content", () => {
    it("should handle large content", () => {
      const largeContent = "Lorem ipsum dolor sit amet. ".repeat(100);
      const envelope = Envelope.new(largeContent);
      const key = SymmetricKey.new();

      const encrypted = envelope.encryptSubject(key);
      const decrypted = encrypted.decryptSubject(key);

      expect(decrypted.asText()).toBe(largeContent);
    });
  });

  describe("Nested envelopes", () => {
    it("should encrypt nested envelopes", () => {
      const nested = Envelope.new("Outer").addAssertion("inner", Envelope.new("Inner secret"));
      const key = SymmetricKey.new();

      const encrypted = nested.encryptSubject(key);
      const decrypted = encrypted.decryptSubject(key);

      expect(decrypted.digest().equals(nested.digest())).toBe(true);
    });
  });
});
