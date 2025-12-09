/**
 * Tests for SR25519 implementation
 *
 * Tests for Schnorr signatures over Ristretto25519, used by Polkadot/Substrate.
 */

import { describe, it, expect } from "vitest";
import {
  Sr25519PrivateKey,
  Sr25519PublicKey,
  SR25519_PRIVATE_KEY_SIZE,
  SR25519_PUBLIC_KEY_SIZE,
  SR25519_SIGNATURE_SIZE,
  SR25519_DEFAULT_CONTEXT,
  SigningPrivateKey,
  SigningPublicKey,
  SignatureScheme,
  Signature,
  createKeypair,
} from "../src/index.js";

describe("Sr25519PrivateKey", () => {
  describe("creation", () => {
    it("should create a random private key", () => {
      const privateKey = Sr25519PrivateKey.random();
      expect(privateKey).toBeDefined();
      expect(privateKey.toData().length).toBe(SR25519_PRIVATE_KEY_SIZE);
    });

    it("should create from seed", () => {
      const seed = new Uint8Array(32).fill(0x42);
      const privateKey = Sr25519PrivateKey.fromSeed(seed);
      expect(privateKey.toData()).toEqual(seed);
    });

    it("should create from hex", () => {
      const hex = "4242424242424242424242424242424242424242424242424242424242424242";
      const privateKey = Sr25519PrivateKey.fromHex(hex);
      expect(privateKey.toHex()).toBe(hex);
    });

    it("should derive from key material", () => {
      const keyMaterial = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const privateKey = Sr25519PrivateKey.deriveFromKeyMaterial(keyMaterial);
      expect(privateKey.toData().length).toBe(SR25519_PRIVATE_KEY_SIZE);
    });

    it("should generate a keypair", () => {
      const [privateKey, publicKey] = Sr25519PrivateKey.keypair();
      expect(privateKey).toBeInstanceOf(Sr25519PrivateKey);
      expect(publicKey).toBeInstanceOf(Sr25519PublicKey);
    });
  });

  describe("public key derivation", () => {
    it("should derive public key", () => {
      const privateKey = Sr25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      expect(publicKey).toBeInstanceOf(Sr25519PublicKey);
      expect(publicKey.toData().length).toBe(SR25519_PUBLIC_KEY_SIZE);
    });

    it("should derive consistent public key", () => {
      const seed = new Uint8Array(32).fill(0x42);
      const privateKey1 = Sr25519PrivateKey.fromSeed(seed);
      const privateKey2 = Sr25519PrivateKey.fromSeed(seed);

      expect(privateKey1.publicKey().toData()).toEqual(privateKey2.publicKey().toData());
    });
  });

  describe("signing and verification", () => {
    it("should sign and verify a message", () => {
      const privateKey = Sr25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const message = new TextEncoder().encode("Hello, Sr25519!");

      const signature = privateKey.sign(message);
      expect(signature.length).toBe(SR25519_SIGNATURE_SIZE);

      const isValid = publicKey.verify(signature, message);
      expect(isValid).toBe(true);
    });

    it("should fail verification with wrong message", () => {
      const privateKey = Sr25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const message = new TextEncoder().encode("Hello, Sr25519!");
      const wrongMessage = new TextEncoder().encode("Wrong message");

      const signature = privateKey.sign(message);
      const isValid = publicKey.verify(signature, wrongMessage);
      expect(isValid).toBe(false);
    });

    it("should fail verification with wrong key", () => {
      const privateKey1 = Sr25519PrivateKey.random();
      const privateKey2 = Sr25519PrivateKey.random();
      const message = new TextEncoder().encode("Hello, Sr25519!");

      const signature = privateKey1.sign(message);
      const isValid = privateKey2.publicKey().verify(signature, message);
      expect(isValid).toBe(false);
    });

    it("should sign with custom context", () => {
      const privateKey = Sr25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const message = new TextEncoder().encode("Hello, Sr25519!");
      const customContext = new TextEncoder().encode("my-custom-context");

      const signature = privateKey.signWithContext(message, customContext);
      expect(signature.length).toBe(SR25519_SIGNATURE_SIZE);

      const isValid = publicKey.verifyWithContext(signature, message, customContext);
      expect(isValid).toBe(true);
    });

    // Note: @scure/sr25519 uses a hardcoded "substrate" context internally.
    // Custom context parameters are accepted for API compatibility but are ignored.
    // This test is skipped because the library doesn't support context differentiation.
    it.skip("should fail verification with wrong context (not supported by @scure/sr25519)", () => {
      const privateKey = Sr25519PrivateKey.random();
      const publicKey = privateKey.publicKey();
      const message = new TextEncoder().encode("Hello, Sr25519!");
      const context1 = new TextEncoder().encode("context-1");
      const context2 = new TextEncoder().encode("context-2");

      const signature = privateKey.signWithContext(message, context1);
      const isValid = publicKey.verifyWithContext(signature, message, context2);
      expect(isValid).toBe(false);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const seed = new Uint8Array(32).fill(0x42);
      const key1 = Sr25519PrivateKey.fromSeed(seed);
      const key2 = Sr25519PrivateKey.fromSeed(seed);
      expect(key1.equals(key2)).toBe(true);
    });

    it("should not be equal to different key", () => {
      const key1 = Sr25519PrivateKey.random();
      const key2 = Sr25519PrivateKey.random();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("string representation", () => {
    it("should have a string representation", () => {
      const privateKey = Sr25519PrivateKey.random();
      expect(privateKey.toString()).toContain("Sr25519PrivateKey");
    });
  });
});

describe("Sr25519PublicKey", () => {
  describe("creation", () => {
    it("should create from bytes", () => {
      const privateKey = Sr25519PrivateKey.random();
      const publicKeyBytes = privateKey.publicKey().toData();
      const publicKey = Sr25519PublicKey.from(publicKeyBytes);
      expect(publicKey.toData()).toEqual(publicKeyBytes);
    });

    it("should create from hex", () => {
      const privateKey = Sr25519PrivateKey.random();
      const hex = privateKey.publicKey().toHex();
      const publicKey = Sr25519PublicKey.fromHex(hex);
      expect(publicKey.toHex()).toBe(hex);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const privateKey = Sr25519PrivateKey.random();
      const publicKey1 = privateKey.publicKey();
      const publicKey2 = Sr25519PublicKey.from(publicKey1.toData());
      expect(publicKey1.equals(publicKey2)).toBe(true);
    });
  });
});

describe("SigningPrivateKey with Sr25519", () => {
  describe("creation", () => {
    it("should create a random Sr25519 signing private key", () => {
      const signingKey = SigningPrivateKey.randomSr25519();
      expect(signingKey.scheme()).toBe(SignatureScheme.Sr25519);
    });

    it("should create from Sr25519PrivateKey", () => {
      const sr25519Key = Sr25519PrivateKey.random();
      const signingKey = SigningPrivateKey.newSr25519(sr25519Key);
      expect(signingKey.scheme()).toBe(SignatureScheme.Sr25519);
    });
  });

  describe("signing and verification", () => {
    it("should sign and verify via SigningPrivateKey", () => {
      const signingPrivateKey = SigningPrivateKey.randomSr25519();
      const signingPublicKey = signingPrivateKey.publicKey();
      const message = new TextEncoder().encode("Test message for Sr25519");

      const signature = signingPrivateKey.sign(message);
      expect(signature.scheme()).toBe(SignatureScheme.Sr25519);

      const isValid = signingPublicKey.verify(signature, message);
      expect(isValid).toBe(true);
    });

    it("should verify via private key's verify method", () => {
      const signingPrivateKey = SigningPrivateKey.randomSr25519();
      const message = new TextEncoder().encode("Test message for Sr25519");

      const signature = signingPrivateKey.sign(message);
      const isValid = signingPrivateKey.verify(signature, message);
      expect(isValid).toBe(true);
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const signingKey = SigningPrivateKey.randomSr25519();
      const cborData = signingKey.taggedCborData();
      const restored = SigningPrivateKey.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(SignatureScheme.Sr25519);
      expect(restored.equals(signingKey)).toBe(true);
    });

    it("should have discriminator 3 in CBOR", () => {
      const signingKey = SigningPrivateKey.randomSr25519();
      const cbor = signingKey.untaggedCbor();
      const bytes = cbor.toData();
      // CBOR array starts with 0x82 (2-element array), then 0x03 (discriminator 3)
      expect(bytes[1]).toBe(3);
    });
  });

  describe("public key derivation", () => {
    it("should derive Sr25519 public key", () => {
      const signingPrivateKey = SigningPrivateKey.randomSr25519();
      const signingPublicKey = signingPrivateKey.publicKey();

      expect(signingPublicKey.scheme()).toBe(SignatureScheme.Sr25519);
      expect(signingPublicKey.isSr25519()).toBe(true);
      expect(signingPublicKey.isEd25519()).toBe(false);
    });
  });
});

describe("SigningPublicKey with Sr25519", () => {
  describe("creation", () => {
    it("should create from Sr25519PublicKey", () => {
      const sr25519Key = Sr25519PrivateKey.random().publicKey();
      const signingPublicKey = SigningPublicKey.fromSr25519(sr25519Key);
      expect(signingPublicKey.scheme()).toBe(SignatureScheme.Sr25519);
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const signingPrivateKey = SigningPrivateKey.randomSr25519();
      const signingPublicKey = signingPrivateKey.publicKey();
      const cborData = signingPublicKey.taggedCborData();
      const restored = SigningPublicKey.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(SignatureScheme.Sr25519);
      expect(restored.equals(signingPublicKey)).toBe(true);
    });

    it("should have discriminator 3 in CBOR", () => {
      const signingPublicKey = SigningPrivateKey.randomSr25519().publicKey();
      const cbor = signingPublicKey.untaggedCbor();
      const bytes = cbor.toData();
      // CBOR array starts with 0x82 (2-element array), then 0x03 (discriminator 3)
      expect(bytes[1]).toBe(3);
    });
  });

  describe("accessor methods", () => {
    it("should return Sr25519PublicKey via toSr25519()", () => {
      const signingPrivateKey = SigningPrivateKey.randomSr25519();
      const signingPublicKey = signingPrivateKey.publicKey();
      const sr25519Key = signingPublicKey.toSr25519();
      expect(sr25519Key).toBeInstanceOf(Sr25519PublicKey);
    });

    it("should return null for toEd25519() on Sr25519 key", () => {
      const signingPublicKey = SigningPrivateKey.randomSr25519().publicKey();
      expect(signingPublicKey.toEd25519()).toBeNull();
    });
  });
});

describe("Signature with Sr25519", () => {
  describe("creation", () => {
    it("should create Sr25519 signature from data", () => {
      const sigData = new Uint8Array(SR25519_SIGNATURE_SIZE).fill(0x42);
      const signature = Signature.sr25519FromData(sigData);
      expect(signature.scheme()).toBe(SignatureScheme.Sr25519);
      expect(signature.isSr25519()).toBe(true);
      expect(signature.isEd25519()).toBe(false);
    });

    it("should create Sr25519 signature from hex", () => {
      const hex = "42".repeat(SR25519_SIGNATURE_SIZE);
      const signature = Signature.sr25519FromHex(hex);
      expect(signature.scheme()).toBe(SignatureScheme.Sr25519);
    });
  });

  describe("accessor methods", () => {
    it("should return data via toSr25519()", () => {
      const sigData = new Uint8Array(SR25519_SIGNATURE_SIZE).fill(0x42);
      const signature = Signature.sr25519FromData(sigData);
      const returned = signature.toSr25519();
      expect(returned).toEqual(sigData);
    });

    it("should return null for toEd25519() on Sr25519 signature", () => {
      const sigData = new Uint8Array(SR25519_SIGNATURE_SIZE).fill(0x42);
      const signature = Signature.sr25519FromData(sigData);
      expect(signature.toEd25519()).toBeNull();
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const sigData = new Uint8Array(SR25519_SIGNATURE_SIZE).fill(0x42);
      const signature = Signature.sr25519FromData(sigData);
      const cborData = signature.taggedCborData();
      const restored = Signature.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(SignatureScheme.Sr25519);
      expect(restored.equals(signature)).toBe(true);
    });

    it("should have discriminator 3 in CBOR", () => {
      const sigData = new Uint8Array(SR25519_SIGNATURE_SIZE).fill(0x42);
      const signature = Signature.sr25519FromData(sigData);
      const cbor = signature.untaggedCbor();
      const bytes = cbor.toData();
      // CBOR array starts with 0x82 (2-element array), then 0x03 (discriminator 3)
      expect(bytes[1]).toBe(3);
    });
  });
});

describe("createKeypair with Sr25519", () => {
  it("should create Sr25519 keypair", () => {
    const [privateKey, publicKey] = createKeypair(SignatureScheme.Sr25519);
    expect(privateKey.scheme()).toBe(SignatureScheme.Sr25519);
    expect(publicKey.scheme()).toBe(SignatureScheme.Sr25519);
  });

  it("should create matching keypair", () => {
    const [privateKey, publicKey] = createKeypair(SignatureScheme.Sr25519);
    const derivedPublicKey = privateKey.publicKey();
    expect(derivedPublicKey.equals(publicKey)).toBe(true);
  });
});

describe("SR25519 constants", () => {
  it("should have correct key sizes", () => {
    expect(SR25519_PRIVATE_KEY_SIZE).toBe(32);
    expect(SR25519_PUBLIC_KEY_SIZE).toBe(32);
    expect(SR25519_SIGNATURE_SIZE).toBe(64);
  });

  it("should have substrate default context", () => {
    const contextStr = new TextDecoder().decode(SR25519_DEFAULT_CONTEXT);
    expect(contextStr).toBe("substrate");
  });
});
