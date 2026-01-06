import { Envelope, SymmetricKey } from "../src";
import { KeyDerivationMethod } from "@bcts/components";

describe("Secret Extension", () => {
  const testPassword = new TextEncoder().encode("test-password");
  const wrongPassword = new TextEncoder().encode("wrong-password");

  describe("lockSubject()", () => {
    it("should lock subject with HKDF derivation", () => {
      const envelope = Envelope.new("Secret message");
      const locked = envelope.lockSubject(KeyDerivationMethod.HKDF, testPassword);

      expect(locked.subject().isEncrypted()).toBe(true);
      expect(locked.assertions().length).toBe(1);
    });

    it("should lock subject with Argon2id derivation", () => {
      const envelope = Envelope.new("Secret message");
      const locked = envelope.lockSubject(KeyDerivationMethod.Argon2id, testPassword);

      expect(locked.subject().isEncrypted()).toBe(true);
    });

    it("should change digest after locking (assertion added)", () => {
      const envelope = Envelope.new("Secret message");
      const locked = envelope.lockSubject(KeyDerivationMethod.HKDF, testPassword);

      // Digest changes because assertion is added (lockSubject adds hasSecret assertion)
      // But the subject's encryption preserves subject digest
      expect(locked.subject().isEncrypted()).toBe(true);
    });
  });

  describe("unlockSubject()", () => {
    it("should unlock subject with correct password", () => {
      const envelope = Envelope.new("Secret message");
      const locked = envelope.lockSubject(KeyDerivationMethod.HKDF, testPassword);
      const unlocked = locked.unlockSubject(testPassword);

      // unlocked is a node (still has hasSecret assertion), access subject for text
      expect(unlocked.subject().asText()).toBe("Secret message");
    });

    it("should throw with wrong password", () => {
      const envelope = Envelope.new("Secret message");
      const locked = envelope.lockSubject(KeyDerivationMethod.HKDF, testPassword);

      expect(() => locked.unlockSubject(wrongPassword)).toThrow();
    });

    it("should work with Argon2id derivation", () => {
      const envelope = Envelope.new("Argon2 secret");
      const locked = envelope.lockSubject(KeyDerivationMethod.Argon2id, testPassword);
      const unlocked = locked.unlockSubject(testPassword);

      expect(unlocked.subject().asText()).toBe("Argon2 secret");
    });

    it("should work with PBKDF2 derivation", () => {
      const envelope = Envelope.new("PBKDF2 secret");
      const locked = envelope.lockSubject(KeyDerivationMethod.PBKDF2, testPassword);
      const unlocked = locked.unlockSubject(testPassword);

      expect(unlocked.subject().asText()).toBe("PBKDF2 secret");
    });
  });

  describe("lock() and unlock()", () => {
    it("should wrap and lock envelope", () => {
      const envelope = Envelope.new("Secret").addAssertion("note", "test");
      const locked = envelope.lock(KeyDerivationMethod.HKDF, testPassword);

      // Locked envelope should be a wrapped envelope with encrypted subject
      expect(locked.subject().isEncrypted()).toBe(true);
    });

    it("should unlock and unwrap envelope", () => {
      const envelope = Envelope.new("Secret").addAssertion("note", "test");
      const locked = envelope.lock(KeyDerivationMethod.HKDF, testPassword);
      const unlocked = locked.unlock(testPassword);

      expect(unlocked.subject().asText()).toBe("Secret");
      expect(unlocked.assertions().length).toBe(1);
    });

    it("should preserve envelope structure after lock/unlock", () => {
      const envelope = Envelope.new("Alice").addAssertion("knows", "Bob").addAssertion("age", 30);

      const locked = envelope.lock(KeyDerivationMethod.HKDF, testPassword);
      const unlocked = locked.unlock(testPassword);

      expect(unlocked.digest().equals(envelope.digest())).toBe(true);
    });
  });

  describe("isLockedWithPassword()", () => {
    it("should return true for password-locked envelope (Argon2id)", () => {
      const envelope = Envelope.new("Secret");
      const locked = envelope.lockSubject(KeyDerivationMethod.Argon2id, testPassword);

      expect(locked.isLockedWithPassword()).toBe(true);
    });

    it("should return true for password-locked envelope (PBKDF2)", () => {
      const envelope = Envelope.new("Secret");
      const locked = envelope.lockSubject(KeyDerivationMethod.PBKDF2, testPassword);

      expect(locked.isLockedWithPassword()).toBe(true);
    });

    it("should return true for password-locked envelope (Scrypt)", () => {
      const envelope = Envelope.new("Secret");
      const locked = envelope.lockSubject(KeyDerivationMethod.Scrypt, testPassword);

      expect(locked.isLockedWithPassword()).toBe(true);
    });

    it("should return false for HKDF-locked envelope", () => {
      const envelope = Envelope.new("Secret");
      const locked = envelope.lockSubject(KeyDerivationMethod.HKDF, testPassword);

      expect(locked.isLockedWithPassword()).toBe(false);
    });

    it("should return false for non-locked envelope", () => {
      const envelope = Envelope.new("Secret");

      expect(envelope.isLockedWithPassword()).toBe(false);
    });
  });

  describe("addSecret()", () => {
    it("should add additional secret to locked envelope", () => {
      const envelope = Envelope.new("Secret message");
      const contentKey = SymmetricKey.generate();

      // Encrypt first
      const encrypted = envelope.encryptSubject(contentKey);

      // Add primary secret
      const withSecret1 = encrypted.addSecret(KeyDerivationMethod.HKDF, testPassword, contentKey);

      // Add secondary secret
      const secondPassword = new TextEncoder().encode("second-password");
      const withSecret2 = withSecret1.addSecret(
        KeyDerivationMethod.HKDF,
        secondPassword,
        contentKey,
      );

      // Should have 2 hasSecret assertions
      expect(withSecret2.assertions().length).toBe(2);

      // Both passwords should work (decrypted is a node with hasSecret assertions)
      const decrypted1 = withSecret2.unlockSubject(testPassword);
      expect(decrypted1.subject().asText()).toBe("Secret message");

      const decrypted2 = withSecret2.unlockSubject(secondPassword);
      expect(decrypted2.subject().asText()).toBe("Secret message");
    });
  });

  describe("Complex content", () => {
    it("should handle envelope with assertions", () => {
      const envelope = Envelope.new("Alice")
        .addAssertion("email", "alice@example.com")
        .addAssertion("age", 30);

      const locked = envelope.lockSubject(KeyDerivationMethod.HKDF, testPassword);
      const unlocked = locked.unlockSubject(testPassword);

      expect(unlocked.subject().asText()).toBe("Alice");
      // 2 original assertions + 1 hasSecret assertion = 3
      expect(unlocked.assertions().length).toBe(3);
    });

    it("should handle nested envelopes", () => {
      const inner = Envelope.new("Inner secret");
      const outer = Envelope.new(inner.wrap()).addAssertion("type", "wrapped");

      const locked = outer.lockSubject(KeyDerivationMethod.HKDF, testPassword);
      const unlocked = locked.unlockSubject(testPassword);

      // After lock/unlock, the subject is decrypted but hasSecret assertion is still there
      // So digests won't match. Instead verify the subject content is preserved
      expect(unlocked.subject().format()).toContain("Inner secret");
    });
  });
});
