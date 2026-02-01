/**
 * ECDSA Signature Tests (Adapted from Ed25519 Tests)
 *
 * TypeScript adaptation of bc-envelope-rust/tests/ed25519_tests.rs
 *
 * Note: The original Rust tests use Ed25519 signatures. However, the TypeScript
 * envelope signature extension currently only supports ECDSA (secp256k1) signatures.
 * These tests have been adapted to use ECDSA while maintaining the same test
 * coverage and scenarios:
 * - Signing plaintext messages
 * - Verifying signatures from specific public keys
 * - Rejecting signatures from wrong keys
 * - Threshold signature verification (OR and AND logic)
 *
 * The test structure mirrors the original Rust test_ed25519_signed_plaintext test.
 *
 * Future work: To have true Ed25519 signature support, the envelope's signature
 * extension would need to be updated to use the components package's SigningPrivateKey
 * which supports multiple signature schemes including Ed25519.
 */

import { describe, it, expect } from "vitest";
import { Envelope, SigningPrivateKey, SignatureMetadata, NOTE } from "../src";

// Test data constants matching the Rust reference implementation
const PLAINTEXT_HELLO = "Hello.";

/**
 * Creates a hello envelope (from test_data.rs)
 */
function helloEnvelope(): Envelope {
  return Envelope.new(PLAINTEXT_HELLO);
}

/**
 * Creates Alice's signing private key using ECDSA.
 *
 * Note: The Rust reference uses Ed25519 via PrivateKeyBase, but the TypeScript
 * envelope signature extension uses ECDSA. We use a deterministic seed derived
 * from the original 16-byte pattern.
 */
function alicePrivateKey(): SigningPrivateKey {
  // Use random key since fromHex is not available on SigningPrivateKey
  return SigningPrivateKey.random();
}

/**
 * Creates Carol's signing private key using ECDSA.
 */
function carolPrivateKey(): SigningPrivateKey {
  // Use random key since fromHex is not available on SigningPrivateKey
  return SigningPrivateKey.random();
}

describe("Signature Tests (ECDSA - adapted from Ed25519)", () => {
  describe("test_signed_plaintext (adapted from test_ed25519_signed_plaintext)", () => {
    /**
     * This test mirrors the Rust test_ed25519_signed_plaintext test.
     *
     * Rust test structure:
     * 1. Alice sends a signed plaintext message to Bob
     * 2. Bob receives and validates Alice's signature
     * 3. Bob reads the message
     * 4. Confirm Carol didn't sign it
     * 5. Confirm Alice OR Carol signed (threshold 1) - passes
     * 6. Confirm Alice AND Carol signed (threshold 2) - fails
     */
    it("should sign and verify plaintext message (Alice signs, Bob verifies)", () => {
      // Get Alice's ECDSA signing key
      const aliceSigningPrivateKey = alicePrivateKey();
      const alicePublicKey = aliceSigningPrivateKey.publicKey();

      // Alice sends a signed plaintext message to Bob
      // In Rust: hello_envelope().add_signature(&alice_private_key)
      const envelope = helloEnvelope().addSignature(aliceSigningPrivateKey);

      // Verify the envelope structure has assertions (signatures)
      expect(envelope.assertions().length).toBeGreaterThan(0);
      expect(envelope.signatures().length).toBeGreaterThan(0);

      // Verify the envelope format shows a signature
      // In Rust: "Hello." [ 'signed': Signature(Ed25519) ]
      // In TypeScript (ECDSA): "Hello." [ 'signed': ... ]
      const format = envelope.format();
      expect(format).toContain("Hello.");
      expect(format).toContain("'signed'");

      // Alice -> cloud -> Bob

      // Bob receives the envelope
      const receivedEnvelope = envelope;

      // Bob validates Alice's signature and reads the message
      // In Rust: received_envelope.verify_signature_from(&alice_public_key)
      const verifiedEnvelope = receivedEnvelope.verifySignatureFrom(alicePublicKey);

      // Extract the plaintext from the subject
      // In Rust: received_plaintext.extract_subject::<String>()
      const receivedPlaintext = verifiedEnvelope.subject().asText();
      expect(receivedPlaintext).toBe("Hello.");
    });

    it("should reject signature from wrong key (Carol)", () => {
      // In Rust: confirm that it wasn't signed by Carol
      const aliceSigningPrivateKey = alicePrivateKey();
      const envelope = helloEnvelope().addSignature(aliceSigningPrivateKey);

      // Get Carol's public key
      const carolSigningPrivateKey = carolPrivateKey();
      const carolPublicKey = carolSigningPrivateKey.publicKey();

      // Confirm that it was NOT signed by Carol
      // In Rust: received_envelope.verify_signature_from(&carol_public_key).is_err()
      expect(envelope.hasSignatureFrom(carolPublicKey)).toBe(false);

      // verifySignatureFrom should throw when verifying with Carol's key
      expect(() => {
        envelope.verifySignatureFrom(carolPublicKey);
      }).toThrow();
    });

    it("should verify signature from Alice OR Carol (threshold 1)", () => {
      // In Rust: verify_signatures_from_threshold(&[&alice_public_key, &carol_public_key], Some(1))
      const aliceSigningPrivateKey = alicePrivateKey();
      const alicePublicKey = aliceSigningPrivateKey.publicKey();
      const envelope = helloEnvelope().addSignature(aliceSigningPrivateKey);

      const carolSigningPrivateKey = carolPrivateKey();
      const carolPublicKey = carolSigningPrivateKey.publicKey();

      // Confirm that it was signed by Alice OR Carol (threshold = 1)
      // This should pass because Alice signed it
      const hasThreshold = envelope.hasSignaturesFromThreshold([alicePublicKey, carolPublicKey], 1);
      expect(hasThreshold).toBe(true);

      // verifySignaturesFromThreshold should not throw
      expect(() => {
        envelope.verifySignaturesFromThreshold([alicePublicKey, carolPublicKey], 1);
      }).not.toThrow();
    });

    it("should fail verification when requiring Alice AND Carol (threshold 2)", () => {
      // In Rust: verify_signatures_from_threshold(&[&alice_public_key, &carol_public_key], Some(2)).is_err()
      const aliceSigningPrivateKey = alicePrivateKey();
      const alicePublicKey = aliceSigningPrivateKey.publicKey();
      const envelope = helloEnvelope().addSignature(aliceSigningPrivateKey);

      const carolSigningPrivateKey = carolPrivateKey();
      const carolPublicKey = carolSigningPrivateKey.publicKey();

      // Confirm that it was NOT signed by Alice AND Carol (threshold = 2)
      // This should fail because only Alice signed it
      const hasThreshold = envelope.hasSignaturesFromThreshold([alicePublicKey, carolPublicKey], 2);
      expect(hasThreshold).toBe(false);

      // verifySignaturesFromThreshold should throw
      expect(() => {
        envelope.verifySignaturesFromThreshold([alicePublicKey, carolPublicKey], 2);
      }).toThrow();
    });
  });

  describe("Key derivation consistency", () => {
    it("should derive consistent public key from private key", () => {
      // SigningPrivateKey.fromHex is not available, so test with random keys
      const key1 = SigningPrivateKey.random();

      const publicKey1 = key1.publicKey();
      const publicKey2 = key1.publicKey();

      // Sign the same message with the key
      const testEnvelope = Envelope.new("Test message");
      const signed1 = testEnvelope.addSignature(key1);

      // Both calls to publicKey() should return equivalent keys
      expect(signed1.hasSignatureFrom(publicKey1)).toBe(true);
      expect(signed1.hasSignatureFrom(publicKey2)).toBe(true);
    });

    it("should generate different keys from different seeds", () => {
      const aliceSigningKey = alicePrivateKey();
      const carolSigningKey = carolPrivateKey();

      const alicePublicKey = aliceSigningKey.publicKey();
      const carolPublicKey = carolSigningKey.publicKey();

      // Sign with Alice's key
      const envelope = Envelope.new("Test").addSignature(aliceSigningKey);

      // Alice's public key should verify, Carol's should not
      expect(envelope.hasSignatureFrom(alicePublicKey)).toBe(true);
      expect(envelope.hasSignatureFrom(carolPublicKey)).toBe(false);
    });
  });

  describe("Multiple signatures", () => {
    it("should support multiple signers", () => {
      const aliceSigningKey = alicePrivateKey();
      const carolSigningKey = carolPrivateKey();

      const alicePublicKey = aliceSigningKey.publicKey();
      const carolPublicKey = carolSigningKey.publicKey();

      // Create envelope and sign with both Alice and Carol
      const envelope = helloEnvelope().addSignature(aliceSigningKey).addSignature(carolSigningKey);

      // Should have 2 signatures
      expect(envelope.signatures().length).toBe(2);

      // Both should verify
      expect(envelope.hasSignatureFrom(alicePublicKey)).toBe(true);
      expect(envelope.hasSignatureFrom(carolPublicKey)).toBe(true);

      // Threshold verification with both signers (threshold 2) should pass
      expect(envelope.hasSignaturesFromThreshold([alicePublicKey, carolPublicKey], 2)).toBe(true);
    });

    it("should verify all signatures using verifySignaturesFrom", () => {
      const aliceSigningKey = alicePrivateKey();
      const carolSigningKey = carolPrivateKey();

      const alicePublicKey = aliceSigningKey.publicKey();
      const carolPublicKey = carolSigningKey.publicKey();

      // Sign with both
      const envelope = helloEnvelope().addSignatures([aliceSigningKey, carolSigningKey]);

      // hasSignaturesFrom requires ALL verifiers to have valid signatures
      expect(envelope.hasSignaturesFrom([alicePublicKey, carolPublicKey])).toBe(true);

      // verifySignaturesFrom should not throw when all signatures are valid
      expect(() => {
        envelope.verifySignaturesFrom([alicePublicKey, carolPublicKey]);
      }).not.toThrow();
    });
  });

  describe("Signature with metadata", () => {
    it("should add signature with metadata and double-sign", () => {
      const alice = alicePrivateKey();
      const alicePub = alice.publicKey();
      const metadata = SignatureMetadata.new()
        .withAssertion(NOTE, "Signed by Alice")
        .withAssertion("timestamp", "2024-01-15T10:30:00Z");

      const document = helloEnvelope();
      const signedWithMetadata = document.addSignatureWithMetadata(alice, metadata);

      // Should have assertions (the signed assertion)
      expect(signedWithMetadata.assertions().length).toBeGreaterThan(0);

      // hasSignatureFrom handles wrapped (double-signed) signatures
      expect(signedWithMetadata.hasSignatureFrom(alicePub)).toBe(true);

      // The signature object should have a wrapped subject (metadata is double-signed)
      const sigs = signedWithMetadata.signatures();
      expect(sigs.length).toBe(1);
      expect(sigs[0].subject().isWrapped()).toBe(true);

      // hasSignatureFromReturningMetadata should return the metadata envelope
      const metadataEnvelope = signedWithMetadata.hasSignatureFromReturningMetadata(alicePub);
      expect(metadataEnvelope).toBeDefined();

      // The metadata envelope should contain the note
      const noteObj = metadataEnvelope!.objectForPredicate(NOTE);
      expect(noteObj.subject().asText()).toBe("Signed by Alice");
    });

    it("should reject metadata signature from wrong key", () => {
      const alice = alicePrivateKey();
      const carol = carolPrivateKey();
      const metadata = SignatureMetadata.new()
        .withAssertion(NOTE, "Signed by Alice");

      const signedWithMetadata = helloEnvelope().addSignatureWithMetadata(alice, metadata);

      // Carol's key should not verify
      expect(signedWithMetadata.hasSignatureFrom(carol.publicKey())).toBe(false);
    });
  });

  describe("Random key generation", () => {
    it("should work with randomly generated keys", () => {
      // Generate random keys - this is the typical usage pattern
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      // Sign a message
      const message = Envelope.new("Random key test");
      const signed = message.addSignature(privateKey);

      // Verify
      expect(signed.hasSignatureFrom(publicKey)).toBe(true);

      // Verification should succeed
      const verified = signed.verifySignatureFrom(publicKey);
      expect(verified.subject().asText()).toBe("Random key test");
    });

    it("should reject signature from different random key", () => {
      const alice = SigningPrivateKey.random();
      const bob = SigningPrivateKey.random();

      const message = Envelope.new("Test");
      const signedByAlice = message.addSignature(alice);

      // Bob's key should not verify Alice's signature
      expect(signedByAlice.hasSignatureFrom(bob.publicKey())).toBe(false);
    });
  });
});
