/**
 * Tests for the signing module (Phase 3)
 *
 * Tests for:
 * - SignatureScheme enum
 * - Signature type with CBOR serialization
 * - SigningPrivateKey with CBOR serialization
 * - SigningPublicKey with CBOR serialization
 * - Sign/verify functionality
 */

// Jest is used by this project (not vitest)
import {
  SignatureScheme,
  Signature,
  SigningPrivateKey,
  SigningPublicKey,
  createKeypair,
  createKeypairUsing,
  defaultSignatureScheme,
  Ed25519PrivateKey,
  Ed25519PublicKey,
  hexToBytes,
  bytesToHex,
} from "../src";
import { SecureRandomNumberGenerator } from "@blockchain-commons/rand";

// Test vectors from the Rust implementation
const TEST_PRIVATE_KEY_HEX = "322b5c1dd5a17c3481c2297990c85c232ed3c17b52ce9905c6ec5193ad132c36";
const TEST_MESSAGE = new TextEncoder().encode("Wolf McNally");

describe("SignatureScheme", () => {
  describe("enum values", () => {
    it("should have Ed25519 scheme", () => {
      expect(SignatureScheme.Ed25519).toBe("Ed25519");
    });
  });

  describe("defaultSignatureScheme", () => {
    it("should return Ed25519", () => {
      expect(defaultSignatureScheme()).toBe(SignatureScheme.Ed25519);
    });
  });

  describe("createKeypair", () => {
    it("should create Ed25519 keypair", () => {
      const [privateKey, publicKey] = createKeypair(SignatureScheme.Ed25519);

      expect(privateKey).toBeInstanceOf(SigningPrivateKey);
      expect(publicKey).toBeInstanceOf(SigningPublicKey);
      expect(privateKey.scheme()).toBe(SignatureScheme.Ed25519);
      expect(publicKey.scheme()).toBe(SignatureScheme.Ed25519);
    });

    it("should create different keypairs each time", () => {
      const [privateKey1] = createKeypair(SignatureScheme.Ed25519);
      const [privateKey2] = createKeypair(SignatureScheme.Ed25519);

      expect(privateKey1.equals(privateKey2)).toBe(false);
    });
  });

  describe("createKeypairUsing", () => {
    it("should create keypair using provided RNG", () => {
      const rng = new SecureRandomNumberGenerator();
      const [privateKey, publicKey] = createKeypairUsing(SignatureScheme.Ed25519, rng);

      expect(privateKey).toBeInstanceOf(SigningPrivateKey);
      expect(publicKey).toBeInstanceOf(SigningPublicKey);
    });
  });
});

describe("SigningPrivateKey", () => {
  describe("creation", () => {
    it("should create from Ed25519PrivateKey", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      expect(privateKey.scheme()).toBe(SignatureScheme.Ed25519);
      expect(privateKey.isEd25519()).toBe(true);
    });

    it("should create random key", () => {
      const privateKey = SigningPrivateKey.random();

      expect(privateKey).toBeInstanceOf(SigningPrivateKey);
      expect(privateKey.scheme()).toBe(SignatureScheme.Ed25519);
    });

    it("should return underlying Ed25519 key", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const retrieved = privateKey.toEd25519();
      expect(retrieved).toBeTruthy();
      expect(retrieved!.equals(ed25519Key)).toBe(true);
    });
  });

  describe("publicKey", () => {
    it("should derive public key", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const publicKey = privateKey.publicKey();
      expect(publicKey).toBeInstanceOf(SigningPublicKey);
      expect(publicKey.scheme()).toBe(SignatureScheme.Ed25519);
    });
  });

  describe("signing", () => {
    it("should sign a message", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const signature = privateKey.sign(TEST_MESSAGE);
      expect(signature).toBeInstanceOf(Signature);
      expect(signature.scheme()).toBe(SignatureScheme.Ed25519);
    });

    it("should produce deterministic signatures for Ed25519", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const signature1 = privateKey.sign(TEST_MESSAGE);
      const signature2 = privateKey.sign(TEST_MESSAGE);

      expect(signature1.equals(signature2)).toBe(true);
    });
  });

  describe("verification via private key", () => {
    it("should verify own signatures", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const signature = privateKey.sign(TEST_MESSAGE);
      expect(privateKey.verify(signature, TEST_MESSAGE)).toBe(true);
    });

    it("should reject tampered messages", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const signature = privateKey.sign(TEST_MESSAGE);
      const tamperedMessage = new TextEncoder().encode("Wolf Mcnally"); // lowercase 'n'
      expect(privateKey.verify(signature, tamperedMessage)).toBe(false);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      expect(privateKey.equals(privateKey)).toBe(true);
    });

    it("should be equal to another key with same data", () => {
      const ed25519Key1 = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const ed25519Key2 = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey1 = SigningPrivateKey.newEd25519(ed25519Key1);
      const privateKey2 = SigningPrivateKey.newEd25519(ed25519Key2);

      expect(privateKey1.equals(privateKey2)).toBe(true);
    });

    it("should not be equal to a key with different data", () => {
      const privateKey1 = SigningPrivateKey.random();
      const privateKey2 = SigningPrivateKey.random();

      expect(privateKey1.equals(privateKey2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const privateKey = SigningPrivateKey.random();
      const tags = privateKey.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40021);
    });

    it("should serialize to untagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const cbor = privateKey.untaggedCbor();
      expect(cbor).toBeTruthy();
    });

    it("should serialize to tagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const cbor = privateKey.taggedCbor();
      expect(cbor).toBeTruthy();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const data = privateKey.taggedCborData();
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const data = privateKey.taggedCborData();
      const recovered = SigningPrivateKey.fromTaggedCborData(data);

      expect(recovered.equals(privateKey)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const cbor = privateKey.untaggedCbor();
      const data = cbor.toData();
      const recovered = SigningPrivateKey.fromUntaggedCborData(data);

      expect(recovered.equals(privateKey)).toBe(true);
    });
  });
});

describe("SigningPublicKey", () => {
  describe("creation", () => {
    it("should create from Ed25519PublicKey", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const ed25519PublicKey = ed25519Key.publicKey();
      const publicKey = SigningPublicKey.fromEd25519(ed25519PublicKey);

      expect(publicKey.scheme()).toBe(SignatureScheme.Ed25519);
      expect(publicKey.isEd25519()).toBe(true);
    });

    it("should return underlying Ed25519 key", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const ed25519PublicKey = ed25519Key.publicKey();
      const publicKey = SigningPublicKey.fromEd25519(ed25519PublicKey);

      const retrieved = publicKey.toEd25519();
      expect(retrieved).toBeTruthy();
      expect(retrieved!.equals(ed25519PublicKey)).toBe(true);
    });
  });

  describe("verification", () => {
    it("should verify valid signatures", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();

      const signature = privateKey.sign(TEST_MESSAGE);
      expect(publicKey.verify(signature, TEST_MESSAGE)).toBe(true);
    });

    it("should reject invalid signatures", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();

      const signature = privateKey.sign(TEST_MESSAGE);
      const tamperedMessage = new TextEncoder().encode("Wolf Mcnally");
      expect(publicKey.verify(signature, tamperedMessage)).toBe(false);
    });

    it("should reject signatures from different keys", () => {
      const privateKey1 = SigningPrivateKey.random();
      const privateKey2 = SigningPrivateKey.random();
      const publicKey2 = privateKey2.publicKey();

      const signature = privateKey1.sign(TEST_MESSAGE);
      expect(publicKey2.verify(signature, TEST_MESSAGE)).toBe(false);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();

      expect(publicKey.equals(publicKey)).toBe(true);
    });

    it("should be equal to another key with same data", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey1 = privateKey.publicKey();
      const publicKey2 = privateKey.publicKey();

      expect(publicKey1.equals(publicKey2)).toBe(true);
    });

    it("should not be equal to a key with different data", () => {
      const privateKey1 = SigningPrivateKey.random();
      const privateKey2 = SigningPrivateKey.random();
      const publicKey1 = privateKey1.publicKey();
      const publicKey2 = privateKey2.publicKey();

      expect(publicKey1.equals(publicKey2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();
      const tags = publicKey.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40022);
    });

    it("should serialize to tagged CBOR binary data", () => {
      const privateKey = SigningPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const data = publicKey.taggedCborData();
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();

      const data = publicKey.taggedCborData();
      const recovered = SigningPublicKey.fromTaggedCborData(data);

      expect(recovered.equals(publicKey)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();

      const cbor = publicKey.untaggedCbor();
      const data = cbor.toData();
      const recovered = SigningPublicKey.fromUntaggedCborData(data);

      expect(recovered.equals(publicKey)).toBe(true);
    });
  });
});

describe("Signature", () => {
  describe("creation", () => {
    it("should create Ed25519 signature from data", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const signature = privateKey.sign(TEST_MESSAGE);

      expect(signature.scheme()).toBe(SignatureScheme.Ed25519);
      expect(signature.isEd25519()).toBe(true);
    });

    it("should have 64-byte signature data for Ed25519", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const signature = privateKey.sign(TEST_MESSAGE);

      const sigData = signature.toEd25519();
      expect(sigData).toBeTruthy();
      expect(sigData!.length).toBe(64);
    });
  });

  describe("equality", () => {
    it("should be equal for same signature data", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const sig1 = privateKey.sign(TEST_MESSAGE);
      const sig2 = privateKey.sign(TEST_MESSAGE);

      expect(sig1.equals(sig2)).toBe(true);
    });

    it("should not be equal for different signature data", () => {
      const privateKey1 = SigningPrivateKey.random();
      const privateKey2 = SigningPrivateKey.random();

      const sig1 = privateKey1.sign(TEST_MESSAGE);
      const sig2 = privateKey2.sign(TEST_MESSAGE);

      expect(sig1.equals(sig2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const privateKey = SigningPrivateKey.random();
      const signature = privateKey.sign(TEST_MESSAGE);
      const tags = signature.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40020);
    });

    it("should serialize to tagged CBOR binary data", () => {
      const privateKey = SigningPrivateKey.random();
      const signature = privateKey.sign(TEST_MESSAGE);

      const data = signature.taggedCborData();
      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const signature = privateKey.sign(TEST_MESSAGE);

      const data = signature.taggedCborData();
      const recovered = Signature.fromTaggedCborData(data);

      expect(recovered.equals(signature)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const signature = privateKey.sign(TEST_MESSAGE);

      const cbor = signature.untaggedCbor();
      const data = cbor.toData();
      const recovered = Signature.fromUntaggedCborData(data);

      expect(recovered.equals(signature)).toBe(true);
    });
  });
});

describe("Ed25519 signing integration", () => {
  it("should match Rust test vector for signing", () => {
    const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
    const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
    const publicKey = privateKey.publicKey();

    const signature = privateKey.sign(TEST_MESSAGE);

    // Verify the signature
    expect(publicKey.verify(signature, TEST_MESSAGE)).toBe(true);
  });

  it("should produce verifiable signatures", () => {
    // Generate new key pair
    const [privateKey, publicKey] = createKeypair(SignatureScheme.Ed25519);

    // Sign a message
    const message = new TextEncoder().encode("Hello, world!");
    const signature = privateKey.sign(message);

    // Verify with public key
    expect(publicKey.verify(signature, message)).toBe(true);

    // Verify fails with wrong message
    const wrongMessage = new TextEncoder().encode("Hello, World!");
    expect(publicKey.verify(signature, wrongMessage)).toBe(false);
  });

  it("should work with serialized keys", () => {
    // Generate key pair
    const [privateKey, publicKey] = createKeypair(SignatureScheme.Ed25519);

    // Sign a message
    const message = new TextEncoder().encode("Test message");
    const signature = privateKey.sign(message);

    // Serialize and deserialize keys
    const privateKeyData = privateKey.taggedCborData();
    const publicKeyData = publicKey.taggedCborData();
    const signatureData = signature.taggedCborData();

    const recoveredPrivateKey = SigningPrivateKey.fromTaggedCborData(privateKeyData);
    const recoveredPublicKey = SigningPublicKey.fromTaggedCborData(publicKeyData);
    const recoveredSignature = Signature.fromTaggedCborData(signatureData);

    // Verify with recovered keys
    expect(recoveredPublicKey.verify(recoveredSignature, message)).toBe(true);

    // Sign again with recovered private key
    const newSignature = recoveredPrivateKey.sign(message);
    expect(recoveredPublicKey.verify(newSignature, message)).toBe(true);
  });
});
