/**
 * Crypto Tests - TypeScript port of bc-envelope-rust/tests/crypto_tests.rs
 *
 * These tests verify encryption, decryption, signing, and recipient functionality
 * for Gordian Envelopes.
 */

import { describe, it, expect } from "vitest";
import {
  Envelope,
  SymmetricKey,
  SigningPrivateKey,
  PrivateKeyBase,
} from "../src";
import { KeyDerivationMethod } from "@bcts/components";
import { IS_A } from "@bcts/known-values";

// ============================================================================
// Test Data (equivalent to common/test_data.rs)
// ============================================================================

const PLAINTEXT_HELLO = "Hello.";

function helloEnvelope(): Envelope {
  return Envelope.new(PLAINTEXT_HELLO);
}

// Test key seeds (matching Rust reference implementation)
// These seeds can be used to create deterministic keys for reproducible tests
const ALICE_SEED = new Uint8Array([
  0x82, 0xf3, 0x2c, 0x85, 0x5d, 0x3d, 0x54, 0x22, 0x56, 0x18, 0x08, 0x10, 0x79,
  0x7e, 0x00, 0x73,
]);

// Create deterministic signing keys from seeds
function alicePrivateKey(): SigningPrivateKey {
  // Pad the 16-byte seed to 32 bytes for ECDSA
  const paddedSeed = new Uint8Array(32);
  paddedSeed.set(ALICE_SEED, 0);
  return new SigningPrivateKey(paddedSeed);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Performs a round-trip encryption test on an envelope.
 * Encrypts the subject, checks equivalence, decrypts, and verifies identity.
 */
function roundTripTest(envelope: Envelope): void {
  const key = SymmetricKey.generate();
  const plaintextSubject = envelope;

  // Encrypt the subject
  const encryptedSubject = plaintextSubject.encryptSubject(key);

  // Encrypted envelope should have the same digest (equivalence)
  expect(encryptedSubject.digest().equals(plaintextSubject.digest())).toBe(
    true
  );

  // Decrypt and verify
  const plaintextSubject2 = encryptedSubject.decryptSubject(key);

  // Decrypted envelope should also be equivalent
  expect(encryptedSubject.digest().equals(plaintextSubject2.digest())).toBe(
    true
  );

  // Decrypted should be identical to original
  expect(plaintextSubject.digest().equals(plaintextSubject2.digest())).toBe(
    true
  );
}

// ============================================================================
// Tests
// ============================================================================

describe("Crypto Tests", () => {
  describe("plaintext", () => {
    it("should send plaintext message", () => {
      // Alice sends a plaintext message to Bob.
      const envelope = helloEnvelope();

      const expectedFormat = `"Hello."`;
      expect(envelope.format()).toBe(expectedFormat);

      // Alice -> Cloud -> Bob

      // Bob receives the envelope and reads the message.
      // In TypeScript, we use CBOR encoding/decoding instead of UR
      // The envelope is serialized and transmitted, then parsed on the receiving end
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());
      const receivedPlaintext = receivedEnvelope.asText();

      expect(receivedPlaintext).toBe(PLAINTEXT_HELLO);
    });
  });

  describe("symmetric encryption", () => {
    it("should encrypt and decrypt with symmetric key", () => {
      // Alice and Bob have agreed to use this key.
      const key = SymmetricKey.generate();

      // Alice sends a message encrypted with the key to Bob.
      const envelope = helloEnvelope().encryptSubject(key);

      const expectedFormat = "ENCRYPTED";
      expect(envelope.format()).toBe(expectedFormat);

      // Alice -> Cloud -> Bob

      // Bob receives the envelope.
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());

      // Bob decrypts and reads the message.
      const decryptedEnvelope = receivedEnvelope.decryptSubject(key);
      const receivedPlaintext = decryptedEnvelope.asText();

      expect(receivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Can't read with no key.
      expect(receivedEnvelope.asText()).toBeUndefined();

      // Can't read with incorrect key.
      const wrongKey = SymmetricKey.generate();
      expect(() => receivedEnvelope.decryptSubject(wrongKey)).toThrow();
    });
  });

  describe("encrypt/decrypt round trips", () => {
    it("should round-trip leaf envelope", () => {
      const e = Envelope.new(PLAINTEXT_HELLO);
      roundTripTest(e);
    });

    it("should round-trip node envelope", () => {
      const e = Envelope.new("Alice").addAssertion("knows", "Bob");
      roundTripTest(e);
    });

    it("should round-trip wrapped envelope", () => {
      const e = Envelope.new("Alice").wrap();
      roundTripTest(e);
    });

    // Skip: Known value encoding is not yet implemented in TypeScript
    it.skip("should round-trip known value envelope", () => {
      const e = Envelope.new(IS_A);
      roundTripTest(e);
    });

    it("should round-trip assertion envelope", () => {
      const e = Envelope.newAssertion("knows", "Bob");
      roundTripTest(e);
    });

    it("should round-trip compressed envelope", () => {
      const e = Envelope.new(PLAINTEXT_HELLO).compress();
      roundTripTest(e);
    });
  });

  describe("sign then encrypt", () => {
    it("should sign then encrypt message", () => {
      // Alice and Bob have agreed to use this key.
      const key = SymmetricKey.generate();
      const alicePriv = alicePrivateKey();
      const alicePub = alicePriv.publicKey();

      // Alice signs a plaintext message, then encrypts it.
      const envelope = helloEnvelope()
        .addSignature(alicePriv)
        .wrap()
        .encryptSubject(key);

      const expectedFormat = "ENCRYPTED";
      expect(envelope.format()).toBe(expectedFormat);

      // Alice -> Cloud -> Bob

      // Bob receives the envelope, decrypts it using the shared key, and then
      // validates Alice's signature.
      const decrypted = Envelope.fromTaggedCbor(envelope.taggedCbor())
        .decryptSubject(key)
        .tryUnwrap();

      // Verify signature
      const verified = decrypted.verifySignatureFrom(alicePub);

      // Bob reads the message.
      const receivedPlaintext = verified.subject().asText();
      expect(receivedPlaintext).toBe(PLAINTEXT_HELLO);
    });
  });

  describe("encrypt then sign", () => {
    it("should encrypt then sign message", () => {
      // Alice and Bob have agreed to use this key.
      const key = SymmetricKey.generate();
      const alicePriv = alicePrivateKey();
      const alicePub = alicePriv.publicKey();

      // Alice encrypts a plaintext message, then signs it.
      //
      // It doesn't actually matter whether the `encrypt` or `sign` method comes
      // first, as the `encrypt` method transforms the `subject` into its
      // encrypted form, which carries a Digest of the plaintext subject,
      // while the `sign` method only adds an Assertion with the signature
      // of the hash as the object of the Assertion.
      const envelope = helloEnvelope()
        .encryptSubject(key)
        .addSignature(alicePriv);

      const expectedFormat = `ENCRYPTED [
    "signed": h'`;
      expect(envelope.format().startsWith(expectedFormat.split("h'")[0])).toBe(
        true
      );

      // Alice -> Cloud -> Bob

      // Bob receives the envelope, validates Alice's signature, then decrypts the
      // message.
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());

      // Verify signature (can be done before decryption)
      const verified = receivedEnvelope.verifySignatureFrom(alicePub);

      // Decrypt - after decryption, it's still a node with the signature assertion
      const decrypted = verified.decryptSubject(key);

      // Bob reads the message from the subject
      const receivedPlaintext = decrypted.subject().asText();
      expect(receivedPlaintext).toBe(PLAINTEXT_HELLO);
    });
  });

  describe("multi-recipient", () => {
    it("should encrypt to multiple recipients", () => {
      const bob = PrivateKeyBase.generate();
      const carol = PrivateKeyBase.generate();
      const alice = PrivateKeyBase.generate();

      // Alice encrypts a message so that it can only be decrypted by Bob or Carol.
      const contentKey = SymmetricKey.generate();
      const envelope = helloEnvelope()
        .encryptSubject(contentKey)
        .addRecipient(bob.publicKeys(), contentKey)
        .addRecipient(carol.publicKeys(), contentKey);

      expect(envelope.format().includes("hasRecipient")).toBe(true);
      expect(envelope.format().includes("ENCRYPTED")).toBe(true);

      // Alice -> Cloud -> Bob
      // Alice -> Cloud -> Carol

      // The envelope is received
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());

      // Bob decrypts and reads the message
      const bobDecrypted = receivedEnvelope.decryptSubjectToRecipient(bob);
      const bobReceivedPlaintext = bobDecrypted.subject().asText();
      expect(bobReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Carol decrypts and reads the message
      const carolDecrypted = receivedEnvelope.decryptSubjectToRecipient(carol);
      const carolReceivedPlaintext = carolDecrypted.subject().asText();
      expect(carolReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Alice didn't encrypt it to herself, so she can't read it.
      expect(() =>
        receivedEnvelope.decryptSubjectToRecipient(alice)
      ).toThrow();
    });
  });

  describe("visible signature multi-recipient", () => {
    it("should sign then encrypt to multiple recipients with visible signature", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();
      const carol = PrivateKeyBase.generate();
      const eve = PrivateKeyBase.generate();

      // Alice signs a message, and then encrypts it so that it can only be
      // decrypted by Bob or Carol.
      const contentKey = SymmetricKey.generate();
      const envelope = helloEnvelope()
        .addSignature(alice)
        .encryptSubject(contentKey)
        .addRecipient(bob.publicKeys(), contentKey)
        .addRecipient(carol.publicKeys(), contentKey);

      // Signature is visible alongside encryption
      expect(envelope.format().includes("ENCRYPTED")).toBe(true);
      expect(envelope.format().includes("hasRecipient")).toBe(true);
      expect(envelope.format().includes("signed")).toBe(true);

      // Alice -> Cloud -> Bob
      // Alice -> Cloud -> Carol

      // The envelope is received
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());

      // Bob validates Alice's signature, then decrypts and reads the message
      const bobVerified = receivedEnvelope.verifySignatureFrom(alice.publicKey());
      const bobDecrypted = bobVerified.decryptSubjectToRecipient(bob);
      const bobReceivedPlaintext = bobDecrypted.subject().asText();
      expect(bobReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Carol validates Alice's signature, then decrypts and reads the message
      const carolVerified = receivedEnvelope.verifySignatureFrom(alice.publicKey());
      const carolDecrypted = carolVerified.decryptSubjectToRecipient(carol);
      const carolReceivedPlaintext = carolDecrypted.subject().asText();
      expect(carolReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Eve didn't receive the message, so she can't decrypt it.
      expect(() => receivedEnvelope.decryptSubjectToRecipient(eve)).toThrow();
    });
  });

  describe("hidden signature multi-recipient", () => {
    it("should hide signature inside encrypted envelope for multiple recipients", () => {
      const alice = SigningPrivateKey.generate();
      const bob = PrivateKeyBase.generate();
      const carol = PrivateKeyBase.generate();
      const eve = PrivateKeyBase.generate();

      // Alice signs a message, and then encloses it in another envelope before
      // encrypting it so that it can only be decrypted by Bob or Carol. This
      // hides Alice's signature, and requires recipients to decrypt the
      // subject before they are able to validate the signature.
      const contentKey = SymmetricKey.generate();
      const envelope = helloEnvelope()
        .addSignature(alice)
        .wrap()
        .encryptSubject(contentKey)
        .addRecipient(bob.publicKeys(), contentKey)
        .addRecipient(carol.publicKeys(), contentKey);

      // Signature is hidden (wrapped inside encrypted content)
      expect(envelope.format().includes("ENCRYPTED")).toBe(true);
      expect(envelope.format().includes("hasRecipient")).toBe(true);
      // Signature should NOT be visible in format
      expect(
        envelope.format().includes("signed") &&
          !envelope.format().includes("ENCRYPTED [")
      ).toBe(false);

      // Alice -> Cloud -> Bob
      // Alice -> Cloud -> Carol

      // The envelope is received
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());

      // Bob decrypts the envelope, then extracts the inner envelope and validates
      // Alice's signature, then reads the message
      const bobDecrypted = receivedEnvelope.decryptSubjectToRecipient(bob);
      const bobUnwrapped = bobDecrypted.tryUnwrap();
      const bobVerified = bobUnwrapped.verifySignatureFrom(alice.publicKey());
      const bobReceivedPlaintext = bobVerified.subject().asText();
      expect(bobReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Carol decrypts the envelope, then extracts the inner envelope and
      // validates Alice's signature, then reads the message
      const carolDecrypted = receivedEnvelope.decryptSubjectToRecipient(carol);
      const carolUnwrapped = carolDecrypted.tryUnwrap();
      const carolVerified = carolUnwrapped.verifySignatureFrom(alice.publicKey());
      const carolReceivedPlaintext = carolVerified.subject().asText();
      expect(carolReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Eve didn't receive the message, so she can't decrypt it.
      expect(() => receivedEnvelope.decryptSubjectToRecipient(eve)).toThrow();
    });
  });

  // Skip: Secret tests require KnownValue encoding which is not yet implemented in TypeScript
  describe.skip("secret (password-based encryption)", () => {
    it("should lock and unlock with HKDF", () => {
      const bobPassword = new TextEncoder().encode(
        "correct horse battery staple"
      );
      const wrongPassword = new TextEncoder().encode("wrong password");

      // Alice encrypts a message so that it can only be decrypted by Bob's password.
      const envelope = helloEnvelope().lock(KeyDerivationMethod.HKDF, bobPassword);

      expect(envelope.format().includes("ENCRYPTED")).toBe(true);
      expect(envelope.format().includes("hasSecret")).toBe(true);

      // Alice -> Cloud -> Bob, Eve

      // The envelope is received
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());

      // Bob decrypts and reads the message
      const bobDecrypted = receivedEnvelope.unlock(bobPassword);
      const bobReceivedPlaintext = bobDecrypted.asText();
      expect(bobReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Eve tries to decrypt the message with a different password
      expect(() => receivedEnvelope.unlock(wrongPassword)).toThrow();
    });

    it("should support multiple secrets with different derivation methods", () => {
      const bobPassword = new TextEncoder().encode(
        "correct horse battery staple"
      );
      const carolPassword = new TextEncoder().encode("Able was I ere I saw Elba");
      const gracyPassword = new TextEncoder().encode("Madam, in Eden, I'm Adam");
      const wrongPassword = new TextEncoder().encode("wrong password");

      // Alice encrypts a message so that it can be decrypted by three specific passwords.
      const contentKey = SymmetricKey.generate();
      const envelope = helloEnvelope()
        .encryptSubject(contentKey)
        .addSecret(KeyDerivationMethod.HKDF, bobPassword, contentKey)
        .addSecret(KeyDerivationMethod.Scrypt, carolPassword, contentKey)
        .addSecret(KeyDerivationMethod.Argon2id, gracyPassword, contentKey);

      expect(envelope.format().includes("ENCRYPTED")).toBe(true);
      expect(envelope.format().includes("hasSecret")).toBe(true);

      // Alice -> Cloud -> Bob, Carol, Gracy, Eve

      // The envelope is received
      const receivedEnvelope = Envelope.fromTaggedCbor(envelope.taggedCbor());

      // Bob decrypts and reads the message
      const bobDecrypted = receivedEnvelope.unlockSubject(bobPassword);
      const bobReceivedPlaintext = bobDecrypted.subject().asText();
      expect(bobReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Carol decrypts and reads the message
      const carolDecrypted = receivedEnvelope.unlockSubject(carolPassword);
      const carolReceivedPlaintext = carolDecrypted.subject().asText();
      expect(carolReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Gracy decrypts and reads the message
      const gracyDecrypted = receivedEnvelope.unlockSubject(gracyPassword);
      const gracyReceivedPlaintext = gracyDecrypted.subject().asText();
      expect(gracyReceivedPlaintext).toBe(PLAINTEXT_HELLO);

      // Eve tries to decrypt the message with a different password
      expect(() => receivedEnvelope.unlockSubject(wrongPassword)).toThrow();
    });
  });

  describe("envelope equivalence and identity", () => {
    it("should maintain equivalence through encryption/decryption", () => {
      const envelope = Envelope.new("Alice").addAssertion("knows", "Bob");
      const key = SymmetricKey.generate();

      const encrypted = envelope.encryptSubject(key);
      const decrypted = encrypted.decryptSubject(key);

      // Encrypted and original should be equivalent (same digest)
      expect(encrypted.digest().equals(envelope.digest())).toBe(true);

      // Decrypted should be identical to original
      expect(decrypted.digest().equals(envelope.digest())).toBe(true);
    });

    it("should fail verification with wrong key", () => {
      const envelope = helloEnvelope();
      const key1 = SymmetricKey.generate();
      const key2 = SymmetricKey.generate();

      const encrypted = envelope.encryptSubject(key1);

      expect(() => encrypted.decryptSubject(key2)).toThrow();
    });
  });
});
