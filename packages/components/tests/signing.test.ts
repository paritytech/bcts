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
  isSshScheme,
  Ed25519PrivateKey,
  ECPrivateKey,
} from "../src";
import { SecureRandomNumberGenerator } from "@bcts/rand";

// Test vectors from the Rust implementation
const TEST_PRIVATE_KEY_HEX = "322b5c1dd5a17c3481c2297990c85c232ed3c17b52ce9905c6ec5193ad132c36";
const TEST_MESSAGE = new TextEncoder().encode("Wolf McNally");

describe("SignatureScheme", () => {
  describe("enum values", () => {
    it("should have Ed25519 scheme", () => {
      expect(SignatureScheme.Ed25519).toBe("Ed25519");
    });

    it("should have SSH signature schemes", () => {
      expect(SignatureScheme.SshEd25519).toBe("SshEd25519");
      expect(SignatureScheme.SshDsa).toBe("SshDsa");
      expect(SignatureScheme.SshEcdsaP256).toBe("SshEcdsaP256");
      expect(SignatureScheme.SshEcdsaP384).toBe("SshEcdsaP384");
    });
  });

  describe("defaultSignatureScheme", () => {
    it("should return Ed25519", () => {
      expect(defaultSignatureScheme()).toBe(SignatureScheme.Ed25519);
    });
  });

  describe("isSshScheme", () => {
    it("should return false for non-SSH schemes", () => {
      expect(isSshScheme(SignatureScheme.Ed25519)).toBe(false);
      expect(isSshScheme(SignatureScheme.Sr25519)).toBe(false);
      expect(isSshScheme(SignatureScheme.Schnorr)).toBe(false);
      expect(isSshScheme(SignatureScheme.Ecdsa)).toBe(false);
    });

    it("should return true for SSH schemes", () => {
      expect(isSshScheme(SignatureScheme.SshEd25519)).toBe(true);
      expect(isSshScheme(SignatureScheme.SshDsa)).toBe(true);
      expect(isSshScheme(SignatureScheme.SshEcdsaP256)).toBe(true);
      expect(isSshScheme(SignatureScheme.SshEcdsaP384)).toBe(true);
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

    it("should throw error for SSH schemes (not yet implemented)", () => {
      expect(() => createKeypair(SignatureScheme.SshEd25519)).toThrow("SSH agent");
      expect(() => createKeypair(SignatureScheme.SshDsa)).toThrow("SSH agent");
      expect(() => createKeypair(SignatureScheme.SshEcdsaP256)).toThrow("SSH agent");
      expect(() => createKeypair(SignatureScheme.SshEcdsaP384)).toThrow("SSH agent");
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
      expect(retrieved).not.toBeNull();
      expect(retrieved?.equals(ed25519Key)).toBe(true);
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
      expect(retrieved).not.toBeNull();
      expect(retrieved?.equals(ed25519PublicKey)).toBe(true);
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
      expect(sigData).not.toBeNull();
      expect(sigData?.length).toBe(64);
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

describe("Schnorr signing (secp256k1)", () => {
  describe("key creation", () => {
    it("should create Schnorr keypair", () => {
      const [privateKey, publicKey] = createKeypair(SignatureScheme.Schnorr);

      expect(privateKey).toBeInstanceOf(SigningPrivateKey);
      expect(publicKey).toBeInstanceOf(SigningPublicKey);
      expect(privateKey.scheme()).toBe(SignatureScheme.Schnorr);
      expect(publicKey.scheme()).toBe(SignatureScheme.Schnorr);
      expect(privateKey.isSchnorr()).toBe(true);
      expect(publicKey.isSchnorr()).toBe(true);
    });

    it("should create from ECPrivateKey", () => {
      const ecKey = ECPrivateKey.random();
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);

      expect(privateKey.scheme()).toBe(SignatureScheme.Schnorr);
      expect(privateKey.toEc()?.equals(ecKey)).toBe(true);
    });

    it("should create random Schnorr key", () => {
      const privateKey = SigningPrivateKey.randomSchnorr();

      expect(privateKey.scheme()).toBe(SignatureScheme.Schnorr);
      expect(privateKey.isSchnorr()).toBe(true);
    });
  });

  describe("signing and verification", () => {
    it("should sign and verify messages", () => {
      const [privateKey, publicKey] = createKeypair(SignatureScheme.Schnorr);
      const message = new TextEncoder().encode("Hello Schnorr!");

      const signature = privateKey.sign(message);
      expect(signature.scheme()).toBe(SignatureScheme.Schnorr);
      expect(signature.isSchnorr()).toBe(true);

      expect(publicKey.verify(signature, message)).toBe(true);
    });

    it("should reject tampered messages", () => {
      const [privateKey, publicKey] = createKeypair(SignatureScheme.Schnorr);
      const message = new TextEncoder().encode("Original message");

      const signature = privateKey.sign(message);
      const tamperedMessage = new TextEncoder().encode("Tampered message");

      expect(publicKey.verify(signature, tamperedMessage)).toBe(false);
    });

    it("should reject signatures from different keys", () => {
      const [privateKey1] = createKeypair(SignatureScheme.Schnorr);
      const [, publicKey2] = createKeypair(SignatureScheme.Schnorr);
      const message = new TextEncoder().encode("Test message");

      const signature = privateKey1.sign(message);
      expect(publicKey2.verify(signature, message)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip private key through CBOR", () => {
      const ecKey = ECPrivateKey.random();
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);

      const data = privateKey.taggedCborData();
      const recovered = SigningPrivateKey.fromTaggedCborData(data);

      expect(recovered.equals(privateKey)).toBe(true);
      expect(recovered.scheme()).toBe(SignatureScheme.Schnorr);
    });

    it("should roundtrip public key through CBOR", () => {
      const [privateKey] = createKeypair(SignatureScheme.Schnorr);
      const publicKey = privateKey.publicKey();

      const data = publicKey.taggedCborData();
      const recovered = SigningPublicKey.fromTaggedCborData(data);

      expect(recovered.equals(publicKey)).toBe(true);
      expect(recovered.scheme()).toBe(SignatureScheme.Schnorr);
    });

    it("should roundtrip signature through CBOR", () => {
      const [privateKey] = createKeypair(SignatureScheme.Schnorr);
      const message = new TextEncoder().encode("Test");
      const signature = privateKey.sign(message);

      const data = signature.taggedCborData();
      const recovered = Signature.fromTaggedCborData(data);

      expect(recovered.equals(signature)).toBe(true);
      expect(recovered.scheme()).toBe(SignatureScheme.Schnorr);
    });
  });
});

describe("ECDSA signing (secp256k1)", () => {
  describe("key creation", () => {
    it("should create ECDSA keypair", () => {
      const [privateKey, publicKey] = createKeypair(SignatureScheme.Ecdsa);

      expect(privateKey).toBeInstanceOf(SigningPrivateKey);
      expect(publicKey).toBeInstanceOf(SigningPublicKey);
      expect(privateKey.scheme()).toBe(SignatureScheme.Ecdsa);
      expect(publicKey.scheme()).toBe(SignatureScheme.Ecdsa);
      expect(privateKey.isEcdsa()).toBe(true);
      expect(publicKey.isEcdsa()).toBe(true);
    });

    it("should create from ECPrivateKey", () => {
      const ecKey = ECPrivateKey.random();
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);

      expect(privateKey.scheme()).toBe(SignatureScheme.Ecdsa);
      expect(privateKey.toEc()?.equals(ecKey)).toBe(true);
    });

    it("should create random ECDSA key", () => {
      const privateKey = SigningPrivateKey.randomEcdsa();

      expect(privateKey.scheme()).toBe(SignatureScheme.Ecdsa);
      expect(privateKey.isEcdsa()).toBe(true);
    });
  });

  describe("signing and verification", () => {
    it("should sign and verify messages", () => {
      const [privateKey, publicKey] = createKeypair(SignatureScheme.Ecdsa);
      const message = new TextEncoder().encode("Hello ECDSA!");

      const signature = privateKey.sign(message);
      expect(signature.scheme()).toBe(SignatureScheme.Ecdsa);
      expect(signature.isEcdsa()).toBe(true);

      expect(publicKey.verify(signature, message)).toBe(true);
    });

    it("should reject tampered messages", () => {
      const [privateKey, publicKey] = createKeypair(SignatureScheme.Ecdsa);
      const message = new TextEncoder().encode("Original message");

      const signature = privateKey.sign(message);
      const tamperedMessage = new TextEncoder().encode("Tampered message");

      expect(publicKey.verify(signature, tamperedMessage)).toBe(false);
    });

    it("should reject signatures from different keys", () => {
      const [privateKey1] = createKeypair(SignatureScheme.Ecdsa);
      const [, publicKey2] = createKeypair(SignatureScheme.Ecdsa);
      const message = new TextEncoder().encode("Test message");

      const signature = privateKey1.sign(message);
      expect(publicKey2.verify(signature, message)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip private key through CBOR", () => {
      const ecKey = ECPrivateKey.random();
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);

      const data = privateKey.taggedCborData();
      const recovered = SigningPrivateKey.fromTaggedCborData(data);

      expect(recovered.equals(privateKey)).toBe(true);
      expect(recovered.scheme()).toBe(SignatureScheme.Ecdsa);
    });

    it("should roundtrip public key through CBOR", () => {
      const [privateKey] = createKeypair(SignatureScheme.Ecdsa);
      const publicKey = privateKey.publicKey();

      const data = publicKey.taggedCborData();
      const recovered = SigningPublicKey.fromTaggedCborData(data);

      expect(recovered.equals(publicKey)).toBe(true);
      expect(recovered.scheme()).toBe(SignatureScheme.Ecdsa);
    });

    it("should roundtrip signature through CBOR", () => {
      const [privateKey] = createKeypair(SignatureScheme.Ecdsa);
      const message = new TextEncoder().encode("Test");
      const signature = privateKey.sign(message);

      const data = signature.taggedCborData();
      const recovered = Signature.fromTaggedCborData(data);

      expect(recovered.equals(signature)).toBe(true);
      expect(recovered.scheme()).toBe(SignatureScheme.Ecdsa);
    });
  });
});

describe("Cross-scheme compatibility", () => {
  it("should not verify Ed25519 signature with Schnorr public key", () => {
    const [ed25519PrivateKey] = createKeypair(SignatureScheme.Ed25519);
    const [, schnorrPublicKey] = createKeypair(SignatureScheme.Schnorr);
    const message = new TextEncoder().encode("Test");

    const signature = ed25519PrivateKey.sign(message);
    expect(schnorrPublicKey.verify(signature, message)).toBe(false);
  });

  it("should not verify Schnorr signature with ECDSA public key", () => {
    const [schnorrPrivateKey] = createKeypair(SignatureScheme.Schnorr);
    const [, ecdsaPublicKey] = createKeypair(SignatureScheme.Ecdsa);
    const message = new TextEncoder().encode("Test");

    const signature = schnorrPrivateKey.sign(message);
    expect(ecdsaPublicKey.verify(signature, message)).toBe(false);
  });

  it("should not verify ECDSA signature with Ed25519 public key", () => {
    const [ecdsaPrivateKey] = createKeypair(SignatureScheme.Ecdsa);
    const [, ed25519PublicKey] = createKeypair(SignatureScheme.Ed25519);
    const message = new TextEncoder().encode("Test");

    const signature = ecdsaPrivateKey.sign(message);
    expect(ed25519PublicKey.verify(signature, message)).toBe(false);
  });
});
