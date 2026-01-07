/**
 * SSH Signature Tests for Gordian Envelope
 *
 * This test file is ported from bc-envelope-rust/tests/ssh_tests.rs
 *
 * The Rust implementation tests SSH-specific signing using Ed25519 keys
 * with SSH agent protocol. Since SSH agent signing is not yet fully
 * implemented in the TypeScript version, we test the equivalent
 * functionality using the envelope's built-in signature implementation.
 *
 * The Rust test uses deterministic keys derived from seeds for reproducibility.
 * In this TypeScript port, we use randomly generated keys since the envelope
 * package uses ECDSA (secp256k1) signatures rather than Ed25519, and the
 * PrivateKeyBase key derivation from @bcts/components is not directly
 * compatible with the envelope package's Signer interface.
 *
 * When SSH agent signing is implemented, the skipped tests should be
 * enabled and updated accordingly.
 */

import { describe, it, expect } from "vitest";
import { Envelope, SigningPrivateKey } from "../src";

const PLAINTEXT_HELLO = "Hello.";

/**
 * Helper function to create the hello envelope
 */
function helloEnvelope(): Envelope {
  return Envelope.new(PLAINTEXT_HELLO);
}

describe("SSH Signature Tests", () => {
  describe("Signed Plaintext (equivalent to SSH Ed25519 test flow)", () => {
    /**
     * This test is equivalent to test_ssh_signed_plaintext in Rust.
     *
     * The Rust test:
     * 1. Creates SSH Ed25519 signing keys from PrivateKeyBase
     * 2. Signs a "Hello." message with SSH signing options
     * 3. Verifies the signature with the correct public key
     * 4. Rejects verification with an incorrect public key
     * 5. Tests threshold signature verification
     *
     * Since SSH agent signing is not yet implemented in TypeScript,
     * we use the envelope package's built-in ECDSA signing which
     * provides the same semantic flow and API.
     */
    it("should sign and verify plaintext message", () => {
      // Generate signing keys (equivalent to Rust's alice_ssh_private_key)
      const aliceSigningKey = SigningPrivateKey.random();
      const alicePublicKey = aliceSigningKey.publicKey();

      // Alice sends a signed plaintext message to Bob
      // Rust equivalent: hello_envelope().add_signature_opt(&alice_ssh_private_key, Some(options), None)
      const envelope = helloEnvelope().addSignature(aliceSigningKey);

      // Verify the envelope has the expected structure
      // Rust format shows: "Hello." [ 'signed': Signature(SshEd25519) ]
      const formatted = envelope.format();
      expect(formatted).toContain('"Hello."');
      expect(formatted).toContain("signed");

      // Verify the envelope has a signature
      expect(envelope.signatures().length).toBeGreaterThan(0);

      // Simulate transmission: Alice -> cloud -> Bob
      // In Rust: let received_envelope = Envelope::from_ur(&ur).unwrap()
      const receivedEnvelope = envelope;

      // Bob validates Alice's signature and reads the message
      // Rust: received_envelope.verify_signature_from(&alice_ssh_public_key)
      expect(receivedEnvelope.hasSignatureFrom(alicePublicKey)).toBe(true);

      const verifiedEnvelope = receivedEnvelope.verifySignatureFrom(alicePublicKey);
      const receivedPlaintext = verifiedEnvelope.subject().asText();
      expect(receivedPlaintext).toBe("Hello.");
    });

    it("should reject signature from wrong key", () => {
      // Get Alice's and Carol's signing keys
      const aliceSigningKey = SigningPrivateKey.random();
      const carolSigningKey = SigningPrivateKey.random();
      const carolPublicKey = carolSigningKey.publicKey();

      // Alice signs a message
      const envelope = helloEnvelope().addSignature(aliceSigningKey);

      // Confirm that it wasn't signed by Carol
      // Rust: assert!(received_envelope.verify_signature_from(&carol_ssh_public_key).is_err())
      expect(envelope.hasSignatureFrom(carolPublicKey)).toBe(false);

      // Verification should throw
      expect(() => envelope.verifySignatureFrom(carolPublicKey)).toThrow();
    });

    it("should verify threshold signatures (Alice OR Carol)", () => {
      // Get Alice's and Carol's keys
      const aliceSigningKey = SigningPrivateKey.random();
      const alicePublicKey = aliceSigningKey.publicKey();

      const carolSigningKey = SigningPrivateKey.random();
      const carolPublicKey = carolSigningKey.publicKey();

      // Alice signs a message
      const envelope = helloEnvelope().addSignature(aliceSigningKey);

      // Confirm that it was signed by Alice OR Carol (threshold 1)
      // Rust: received_envelope.verify_signatures_from_threshold(&[&alice_ssh_public_key, &carol_ssh_public_key], Some(1))
      expect(envelope.hasSignaturesFromThreshold([alicePublicKey, carolPublicKey], 1)).toBe(true);

      // This should also work via verifySignaturesFromThreshold
      expect(() => {
        envelope.verifySignaturesFromThreshold([alicePublicKey, carolPublicKey], 1);
      }).not.toThrow();
    });

    it("should fail threshold verification requiring both signatures", () => {
      // Get Alice's and Carol's keys
      const aliceSigningKey = SigningPrivateKey.random();
      const alicePublicKey = aliceSigningKey.publicKey();

      const carolSigningKey = SigningPrivateKey.random();
      const carolPublicKey = carolSigningKey.publicKey();

      // Alice signs a message (not Carol)
      const envelope = helloEnvelope().addSignature(aliceSigningKey);

      // Confirm that it was NOT signed by Alice AND Carol (threshold 2)
      // Rust: assert!(received_envelope.verify_signatures_from_threshold(..., Some(2)).is_err())
      expect(envelope.hasSignaturesFromThreshold([alicePublicKey, carolPublicKey], 2)).toBe(false);

      // This should throw
      expect(() => {
        envelope.verifySignaturesFromThreshold([alicePublicKey, carolPublicKey], 2);
      }).toThrow();
    });
  });

  describe("Multiple Signatures", () => {
    it("should verify when both Alice AND Carol sign", () => {
      // Get Alice's and Carol's keys
      const aliceSigningKey = SigningPrivateKey.random();
      const alicePublicKey = aliceSigningKey.publicKey();

      const carolSigningKey = SigningPrivateKey.random();
      const carolPublicKey = carolSigningKey.publicKey();

      // Both Alice and Carol sign
      const envelope = helloEnvelope().addSignature(aliceSigningKey).addSignature(carolSigningKey);

      // Should have 2 signatures
      expect(envelope.signatures().length).toBe(2);

      // Both should verify
      expect(envelope.hasSignatureFrom(alicePublicKey)).toBe(true);
      expect(envelope.hasSignatureFrom(carolPublicKey)).toBe(true);

      // Threshold 2 should now pass
      expect(envelope.hasSignaturesFromThreshold([alicePublicKey, carolPublicKey], 2)).toBe(true);

      // Verification should not throw
      expect(() => {
        envelope.verifySignaturesFromThreshold([alicePublicKey, carolPublicKey], 2);
      }).not.toThrow();
    });

    it("should support addSignatures with array of signers", () => {
      const alice = SigningPrivateKey.random();
      const bob = SigningPrivateKey.random();
      const carol = SigningPrivateKey.random();

      // Use addSignatures with array (matching Rust multi-signer pattern)
      const envelope = helloEnvelope().addSignatures([alice, bob, carol]);

      expect(envelope.signatures().length).toBe(3);
      expect(envelope.hasSignatureFrom(alice.publicKey())).toBe(true);
      expect(envelope.hasSignatureFrom(bob.publicKey())).toBe(true);
      expect(envelope.hasSignatureFrom(carol.publicKey())).toBe(true);
    });
  });

  describe("CBOR Round-trip", () => {
    it("should preserve signature through CBOR encoding/decoding", () => {
      // Get Alice's signing key
      const aliceSigningKey = SigningPrivateKey.random();
      const alicePublicKey = aliceSigningKey.publicKey();

      // Alice signs a message
      const originalEnvelope = helloEnvelope().addSignature(aliceSigningKey);

      // Get CBOR representation and restore
      // (equivalent to Rust's envelope.ur() -> Envelope::from_ur(&ur) round-trip)
      // In TypeScript, we use CBOR encoding instead of UR
      const receivedEnvelope = Envelope.fromTaggedCbor(originalEnvelope.taggedCbor());

      // Verify the signature is still valid after round-trip
      expect(receivedEnvelope.hasSignatureFrom(alicePublicKey)).toBe(true);

      // Verify the content
      const verifiedEnvelope = receivedEnvelope.verifySignatureFrom(alicePublicKey);
      expect(verifiedEnvelope.subject().asText()).toBe("Hello.");
    });
  });

  // TODO: These tests should be enabled when SSH agent signing is implemented
  describe.skip("SSH Agent Signing (not yet implemented)", () => {
    /**
     * These tests are placeholders for when SSH agent signing is implemented.
     * They document the expected behavior based on the Rust reference implementation.
     *
     * In the Rust implementation (bc-envelope-rust/tests/ssh_tests.rs):
     *
     * ```rust
     * let alice_ssh_private_key = alice_private_key()
     *     .ssh_signing_private_key(SSHAlgorithm::Ed25519, "alice@example.com")
     *     .unwrap();
     * let alice_ssh_public_key = alice_ssh_private_key.public_key().unwrap();
     *
     * let options = SigningOptions::Ssh {
     *     namespace: "test".to_string(),
     *     hash_alg: HashAlg::Sha256,
     * };
     * let envelope = hello_envelope()
     *     .add_signature_opt(&alice_ssh_private_key, Some(options), None)
     *     .check_encoding()
     *     .unwrap();
     * ```
     *
     * The expected format output shows:
     * ```
     * "Hello." [
     *     'signed': Signature(SshEd25519)
     * ]
     * ```
     *
     * Key differences from standard Ed25519 signing:
     * 1. SSH keys are derived from PrivateKeyBase with an email comment
     * 2. Signing requires SSH-specific options (namespace, hash algorithm)
     * 3. The signature type is explicitly SshEd25519 (not just Ed25519)
     */

    it.skip("should create SSH Ed25519 signing key from PrivateKeyBase", () => {
      // Test seed from Rust test_data.rs
      // const ALICE_SEED = new Uint8Array([
      //   0x82, 0xf3, 0x2c, 0x85, 0x5d, 0x3d, 0x54, 0x22,
      //   0x56, 0x18, 0x08, 0x10, 0x79, 0x7e, 0x00, 0x73,
      // ]);
      //
      // When implemented:
      // import { PrivateKeyBase } from "@bcts/components";
      //
      // const alicePrivateKeyBase = PrivateKeyBase.fromData(ALICE_SEED);
      // const aliceSshPrivateKey = alicePrivateKeyBase
      //   .sshSigningPrivateKey("ed25519", "alice@example.com");
      // const aliceSshPublicKey = aliceSshPrivateKey.publicKey();
      //
      // The SSH key should use the Ed25519 algorithm with SSH-specific
      // encoding and namespace support.
    });

    it.skip("should sign with SSH options (namespace and hash algorithm)", () => {
      // When implemented:
      // import { SigningOptions } from "@bcts/components";
      //
      // const options: SigningOptions = {
      //   type: "Ssh",
      //   namespace: "test",
      //   hashAlg: "sha256",
      // };
      //
      // const envelope = helloEnvelope()
      //   .addSignatureWithOptions(aliceSshPrivateKey, options);
      //
      // The signature should be created using the SSH signing protocol
      // with the specified namespace and hash algorithm.
    });

    it.skip("should format SSH signature correctly", () => {
      // When implemented, the format should show:
      // "Hello." [
      //     'signed': Signature(SshEd25519)
      // ]
      //
      // The signature type should be indicated as SshEd25519
      // (or the appropriate SSH algorithm variant).
    });
  });
});
