import { Envelope, SigningPrivateKey, PrivateKeyBase } from "../src";

describe("Seal Extension", () => {
  describe("encryptToRecipient()", () => {
    it("should encrypt envelope to recipient", () => {
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Secret for Bob");

      const encrypted = message.encryptToRecipient(bob.publicKeys());

      // Should be a wrapped encrypted envelope
      expect(encrypted.subject().isEncrypted()).toBe(true);
    });

    it("should be decryptable by recipient", () => {
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Secret for Bob");

      const encrypted = message.encryptToRecipient(bob.publicKeys());
      const decrypted = encrypted.decryptToRecipient(bob);

      expect(decrypted.asText()).toBe("Secret for Bob");
    });

    it("should preserve envelope structure", () => {
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Alice").addAssertion("knows", "Bob").addAssertion("age", 30);

      const encrypted = message.encryptToRecipient(bob.publicKeys());
      const decrypted = encrypted.decryptToRecipient(bob);

      expect(decrypted.subject().asText()).toBe("Alice");
      expect(decrypted.assertions().length).toBe(2);
    });
  });

  describe("seal()", () => {
    it("should sign and encrypt envelope", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Signed and encrypted");

      const sealed = message.seal(alice, bob.publicKeys());

      // Should be encrypted
      expect(sealed.subject().isEncrypted()).toBe(true);
    });

    it("should be unsealable with correct keys", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Secret signed message");

      const sealed = message.seal(alice, bob.publicKeys());
      const unsealed = sealed.unseal(alice.publicKey(), bob);

      // The unsealed envelope is the verified signed envelope
      // Its subject is the original message
      expect(unsealed.subject().asText()).toBe("Secret signed message");
    });

    it("should preserve envelope content after seal/unseal", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();
      const message = Envelope.new("Important document")
        .addAssertion("author", "Alice")
        .addAssertion("date", "2026-01-06");

      const sealed = message.seal(alice, bob.publicKeys());
      const unsealed = sealed.unseal(alice.publicKey(), bob);

      // The unsealed envelope has the original content plus signature assertion
      expect(unsealed.subject().asText()).toBe("Important document");
      // 2 original assertions + 1 signature assertion = 3
      expect(unsealed.assertions().length).toBe(3);
    });
  });

  describe("unseal() error cases", () => {
    it("should fail with wrong recipient key", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();
      const charlie = PrivateKeyBase.generate();
      const message = Envelope.new("For Bob only");

      const sealed = message.seal(alice, bob.publicKeys());

      // Charlie should not be able to decrypt
      expect(() => sealed.unseal(alice.publicKey(), charlie)).toThrow();
    });

    it("should fail with wrong sender verification key", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();
      const eve = SigningPrivateKey.generate();
      const message = Envelope.new("From Alice");

      const sealed = message.seal(alice, bob.publicKeys());

      // Verifying with Eve's public key should fail
      expect(() => sealed.unseal(eve.publicKey(), bob)).toThrow();
    });
  });

  describe("Round-trip with complex content", () => {
    it("should handle nested envelopes", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();

      const inner = Envelope.new("Inner secret");
      const outer = Envelope.new(inner.wrap()).addAssertion("type", "nested");

      const sealed = outer.seal(alice, bob.publicKeys());
      const unsealed = sealed.unseal(alice.publicKey(), bob);

      expect(unsealed.subject().format()).toContain("Inner secret");
    });

    it("should handle binary content", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();

      const binaryData = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const message = Envelope.new(binaryData);

      const sealed = message.seal(alice, bob.publicKeys());
      const unsealed = sealed.unseal(alice.publicKey(), bob);

      // The unsealed envelope's subject is the original binary content
      const recovered = unsealed.subject().extractBytes();
      expect(new Uint8Array(recovered)).toEqual(binaryData);
    });
  });

  describe("Multiple parties", () => {
    it("should work with different sender/recipient pairs", () => {
      // Alice sends to Bob
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();

      // Charlie sends to Diana
      const charlie = SigningPrivateKey.generate();
      const diana = PrivateKeyBase.generate();

      const messageFromAlice = Envelope.new("Hello from Alice");
      const sealedFromAlice = messageFromAlice.seal(alice, bob.publicKeys());

      const messageFromCharlie = Envelope.new("Hello from Charlie");
      const sealedFromCharlie = messageFromCharlie.seal(charlie, diana.publicKeys());

      // Bob unseals from Alice
      const unsealedByBob = sealedFromAlice.unseal(alice.publicKey(), bob);
      expect(unsealedByBob.subject().asText()).toBe("Hello from Alice");

      // Diana unseals from Charlie
      const unsealedByDiana = sealedFromCharlie.unseal(charlie.publicKey(), diana);
      expect(unsealedByDiana.subject().asText()).toBe("Hello from Charlie");
    });
  });
});
