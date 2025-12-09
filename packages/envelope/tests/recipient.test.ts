import { Envelope, PrivateKeyBase, SymmetricKey, HAS_RECIPIENT } from "../src";

describe("Recipient (Public-Key Encryption)", () => {
  describe("Key generation", () => {
    it("should generate key pairs", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();

      expect(alice.publicKeys().hex().length).toBeGreaterThan(0);
      expect(bob.publicKeys().hex().length).toBeGreaterThan(0);
    });
  });

  describe("Single-recipient encryption", () => {
    it("should encrypt for single recipient", () => {
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Secret message for Bob");

      const encrypted = message.encryptSubjectToRecipient(bob.publicKeys());

      expect(encrypted.subject().case().type).toBe("encrypted");
      expect(encrypted.assertions().length).toBeGreaterThan(0);
    });

    it("should decrypt for intended recipient", () => {
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Secret message for Bob");

      const encrypted = message.encryptSubjectToRecipient(bob.publicKeys());
      const decrypted = encrypted.decryptSubjectToRecipient(bob);

      expect(decrypted.subject().asText()).toBe("Secret message for Bob");
    });
  });

  describe("Wrong recipient", () => {
    it("should fail decryption for wrong recipient", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Secret message for Bob");

      const encrypted = message.encryptSubjectToRecipient(bob.publicKeys());

      expect(() => encrypted.decryptSubjectToRecipient(alice)).toThrow();
    });
  });

  describe("Multi-recipient encryption", () => {
    it("should encrypt for multiple recipients", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();
      const charlie = PrivateKeyBase.generate();

      const message = Envelope.new("Secret for Alice, Bob, and Charlie");
      const encrypted = message.encryptSubjectToRecipients([
        alice.publicKeys(),
        bob.publicKeys(),
        charlie.publicKeys(),
      ]);

      expect(encrypted.recipients().length).toBe(3);
      expect(encrypted.subject().case().type).toBe("encrypted");
    });

    it("should allow all recipients to decrypt", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();
      const charlie = PrivateKeyBase.generate();

      const message = Envelope.new("Secret for all");
      const encrypted = message.encryptSubjectToRecipients([
        alice.publicKeys(),
        bob.publicKeys(),
        charlie.publicKeys(),
      ]);

      const aliceDecrypted = encrypted.decryptSubjectToRecipient(alice);
      const bobDecrypted = encrypted.decryptSubjectToRecipient(bob);
      const charlieDecrypted = encrypted.decryptSubjectToRecipient(charlie);

      expect(aliceDecrypted.subject().asText()).toBe("Secret for all");
      expect(bobDecrypted.subject().asText()).toBe("Secret for all");
      expect(charlieDecrypted.subject().asText()).toBe("Secret for all");
    });
  });

  describe("Adding recipients incrementally", () => {
    it("should add recipients one at a time", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();
      const dave = PrivateKeyBase.generate();

      const message = Envelope.new("Secret message");
      const contentKey = SymmetricKey.generate();

      const baseEncrypted = message.encryptSubject(contentKey);
      const withAlice = baseEncrypted.addRecipient(alice.publicKeys(), contentKey);
      const withBob = withAlice.addRecipient(bob.publicKeys(), contentKey);
      const withDave = withBob.addRecipient(dave.publicKeys(), contentKey);

      expect(withDave.recipients().length).toBe(3);

      const aliceDecrypted = withDave.decryptSubjectToRecipient(alice);
      const daveDecrypted = withDave.decryptSubjectToRecipient(dave);

      expect(aliceDecrypted.subject().asText()).toBe("Secret message");
      expect(daveDecrypted.subject().asText()).toBe("Secret message");
    });
  });

  describe("Entire envelope encryption", () => {
    it("should encrypt entire envelope to recipients", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();

      const document = Envelope.new("Contract terms and conditions");

      const encrypted = document.encryptToRecipients([alice.publicKeys(), bob.publicKeys()]);

      expect(encrypted.recipients().length).toBe(2);

      const aliceDoc = encrypted.decryptToRecipient(alice);
      const bobDoc = encrypted.decryptToRecipient(bob);

      expect(aliceDoc.subject().asText()).toBe("Contract terms and conditions");
      expect(bobDoc.subject().asText()).toBe("Contract terms and conditions");
    });
  });

  describe("Key serialization", () => {
    it("should serialize and restore keys", () => {
      const alice = PrivateKeyBase.generate();

      const privateHex = alice.hex();
      const publicHex = alice.publicKeys().hex();

      const restored = PrivateKeyBase.fromHex(privateHex, publicHex);

      const message = Envelope.new("Test serialization");
      const encrypted = message.encryptSubjectToRecipient(restored.publicKeys());
      const decrypted = encrypted.decryptSubjectToRecipient(restored);

      expect(decrypted.subject().asText()).toBe("Test serialization");
    });
  });

  describe("HAS_RECIPIENT constant", () => {
    it("should have expected value", () => {
      expect(HAS_RECIPIENT).toBe("hasRecipient");
    });
  });

  describe("Large payload encryption", () => {
    it("should handle large payloads", () => {
      const alice = PrivateKeyBase.generate();
      const bob = PrivateKeyBase.generate();

      const largeData = "X".repeat(10000);
      const largeEnvelope = Envelope.new(largeData);

      const encrypted = largeEnvelope.encryptSubjectToRecipients([
        alice.publicKeys(),
        bob.publicKeys(),
      ]);

      const decrypted = encrypted.decryptSubjectToRecipient(alice);
      const decryptedText = decrypted.subject().asText();

      expect(decryptedText).toBeDefined();
      expect(decryptedText?.length).toBe(largeData.length);
    });
  });
});
