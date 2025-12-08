import { Envelope, SigningPrivateKey, SignatureMetadata, NOTE } from "../src";

describe("Signature Extension", () => {
  describe("Key generation", () => {
    it("should generate private and public keys", () => {
      const privateKey = SigningPrivateKey.generate();
      const publicKey = privateKey.publicKey();

      expect(privateKey).toBeDefined();
      expect(publicKey).toBeDefined();
      expect(publicKey.hex().length).toBeGreaterThan(0);
    });
  });

  describe("Basic signature", () => {
    it("should sign envelope and add assertion", () => {
      const privateKey = SigningPrivateKey.generate();
      const message = Envelope.new("Hello, world!");

      const signed = message.addSignature(privateKey);

      expect(signed.assertions().length).toBeGreaterThan(0);
      expect(signed.signatures().length).toBeGreaterThan(0);
    });
  });

  describe("Signature verification", () => {
    it("should verify valid signature", () => {
      const privateKey = SigningPrivateKey.generate();
      const publicKey = privateKey.publicKey();
      const message = Envelope.new("Hello, world!");

      const signed = message.addSignature(privateKey);

      expect(signed.hasSignatureFrom(publicKey)).toBe(true);

      const verified = signed.verifySignatureFrom(publicKey);
      expect(verified.subject().asText()).toBe("Hello, world!");
    });

    it("should reject invalid signature", () => {
      const privateKey = SigningPrivateKey.generate();
      const wrongKey = SigningPrivateKey.generate();
      const wrongPublicKey = wrongKey.publicKey();
      const message = Envelope.new("Hello, world!");

      const signed = message.addSignature(privateKey);

      expect(signed.hasSignatureFrom(wrongPublicKey)).toBe(false);
    });
  });

  describe("Multiple signatures", () => {
    it("should support multiple signers", () => {
      const alice = SigningPrivateKey.generate();
      const bob = SigningPrivateKey.generate();
      const charlie = SigningPrivateKey.generate();

      const contract = Envelope.new("Multi-party agreement");
      const multiSigned = contract.addSignatures([alice, bob, charlie]);

      expect(multiSigned.signatures().length).toBe(3);
      expect(multiSigned.hasSignatureFrom(alice.publicKey())).toBe(true);
      expect(multiSigned.hasSignatureFrom(bob.publicKey())).toBe(true);
      expect(multiSigned.hasSignatureFrom(charlie.publicKey())).toBe(true);
    });
  });

  describe("Signature with metadata", () => {
    it("should add signature with metadata", () => {
      const alice = SigningPrivateKey.generate();
      const metadata = new SignatureMetadata()
        .withAssertion(NOTE, "Signed by Alice")
        .withAssertion("timestamp", "2024-01-15T10:30:00Z")
        .withAssertion("purpose", "Contract approval");

      const document = Envelope.new("Important document");
      const signedWithMetadata = document.addSignatureWithMetadata(alice, metadata);

      expect(signedWithMetadata.assertions().length).toBeGreaterThan(0);
      expect(signedWithMetadata.hasSignatureFrom(alice.publicKey())).toBe(true);
    });
  });

  describe("Key serialization", () => {
    it("should serialize and deserialize keys", () => {
      const key1 = SigningPrivateKey.generate();
      const key1Hex = Array.from(key1.data())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const key2 = SigningPrivateKey.fromHex(key1Hex);

      const testMsg = Envelope.new("Test message");
      const sig1 = testMsg.addSignature(key1);
      const sig2 = testMsg.addSignature(key2);

      expect(sig1.hasSignatureFrom(key2.publicKey())).toBe(true);
      expect(sig2.hasSignatureFrom(key1.publicKey())).toBe(true);
    });
  });

  describe("Signature preservation", () => {
    it("should preserve signature through operations", () => {
      const alice = SigningPrivateKey.generate();
      const original = Envelope.new("Alice").addAssertion("age", 30).addSignature(alice);

      expect(original.hasSignatureFrom(alice.publicKey())).toBe(true);

      original.wrap();
      expect(original.hasSignatureFrom(alice.publicKey())).toBe(true);
    });
  });
});
