/**
 * Post-Quantum Cryptography Tests
 *
 * Tests for ML-DSA (digital signatures) and ML-KEM (key encapsulation)
 * post-quantum cryptographic implementations.
 */

import { describe, it, expect } from "vitest";

import {
  // ML-DSA
  MLDSALevel,
  MLDSA_KEY_SIZES,
  mldsaPrivateKeySize,
  mldsaPublicKeySize,
  mldsaSignatureSize,
  mldsaLevelToString,
  mldsaLevelFromValue,
  MLDSAPrivateKey,
  MLDSAPublicKey,
  MLDSASignature,
  // ML-KEM
  MLKEMLevel,
  MLKEM_KEY_SIZES,
  mlkemPrivateKeySize,
  mlkemPublicKeySize,
  mlkemCiphertextSize,
  mlkemSharedSecretSize,
  mlkemLevelToString,
  mlkemLevelFromValue,
  MLKEMPrivateKey,
  MLKEMPublicKey,
  MLKEMCiphertext,
} from "../src/index.js";

// ============================================================================
// ML-DSA Tests
// ============================================================================

describe("MLDSALevel", () => {
  describe("enum values", () => {
    it("should have correct NIST level values", () => {
      expect(MLDSALevel.MLDSA44).toBe(2);
      expect(MLDSALevel.MLDSA65).toBe(3);
      expect(MLDSALevel.MLDSA87).toBe(5);
    });
  });

  describe("key sizes", () => {
    it("should have correct sizes for MLDSA44", () => {
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA44].privateKey).toBe(2560);
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA44].publicKey).toBe(1312);
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA44].signature).toBe(2420);
    });

    it("should have correct sizes for MLDSA65", () => {
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA65].privateKey).toBe(4032);
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA65].publicKey).toBe(1952);
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA65].signature).toBe(3309);
    });

    it("should have correct sizes for MLDSA87", () => {
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA87].privateKey).toBe(4896);
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA87].publicKey).toBe(2592);
      expect(MLDSA_KEY_SIZES[MLDSALevel.MLDSA87].signature).toBe(4627);
    });
  });

  describe("utility functions", () => {
    it("should convert level to string", () => {
      expect(mldsaLevelToString(MLDSALevel.MLDSA44)).toBe("MLDSA44");
      expect(mldsaLevelToString(MLDSALevel.MLDSA65)).toBe("MLDSA65");
      expect(mldsaLevelToString(MLDSALevel.MLDSA87)).toBe("MLDSA87");
    });

    it("should parse level from value", () => {
      expect(mldsaLevelFromValue(2)).toBe(MLDSALevel.MLDSA44);
      expect(mldsaLevelFromValue(3)).toBe(MLDSALevel.MLDSA65);
      expect(mldsaLevelFromValue(5)).toBe(MLDSALevel.MLDSA87);
    });

    it("should throw on invalid level value", () => {
      expect(() => mldsaLevelFromValue(4)).toThrow();
    });

    it("should return correct key sizes", () => {
      expect(mldsaPrivateKeySize(MLDSALevel.MLDSA44)).toBe(2560);
      expect(mldsaPublicKeySize(MLDSALevel.MLDSA44)).toBe(1312);
      expect(mldsaSignatureSize(MLDSALevel.MLDSA44)).toBe(2420);
    });
  });
});

describe("MLDSAPrivateKey", () => {
  describe("keypair generation", () => {
    it("should generate MLDSA44 keypair", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      expect(privateKey).toBeInstanceOf(MLDSAPrivateKey);
      expect(publicKey).toBeInstanceOf(MLDSAPublicKey);
      expect(privateKey.level()).toBe(MLDSALevel.MLDSA44);
      expect(publicKey.level()).toBe(MLDSALevel.MLDSA44);
      expect(privateKey.size()).toBe(2560);
      expect(publicKey.size()).toBe(1312);
    });

    it("should generate MLDSA65 keypair", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      expect(privateKey.level()).toBe(MLDSALevel.MLDSA65);
      expect(publicKey.level()).toBe(MLDSALevel.MLDSA65);
      expect(privateKey.size()).toBe(4032);
      expect(publicKey.size()).toBe(1952);
    });

    it("should generate MLDSA87 keypair", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA87);
      expect(privateKey.level()).toBe(MLDSALevel.MLDSA87);
      expect(publicKey.level()).toBe(MLDSALevel.MLDSA87);
      expect(privateKey.size()).toBe(4896);
      expect(publicKey.size()).toBe(2592);
    });

    it("should default to MLDSA65", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair();
      expect(privateKey.level()).toBe(MLDSALevel.MLDSA65);
      expect(publicKey.level()).toBe(MLDSALevel.MLDSA65);
    });
  });

  describe("signing and verification", () => {
    // Test message from Rust implementation
    const testMessage = new TextEncoder().encode(
      "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
    );

    it("should sign and verify with MLDSA44", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const signature = privateKey.sign(testMessage);

      expect(signature).toBeInstanceOf(MLDSASignature);
      expect(signature.level()).toBe(MLDSALevel.MLDSA44);
      expect(signature.size()).toBe(2420);

      expect(publicKey.verify(signature, testMessage)).toBe(true);
    });

    it("should sign and verify with MLDSA65", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const signature = privateKey.sign(testMessage);

      expect(signature.level()).toBe(MLDSALevel.MLDSA65);
      expect(signature.size()).toBe(3309);

      expect(publicKey.verify(signature, testMessage)).toBe(true);
    });

    it("should sign and verify with MLDSA87", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA87);
      const signature = privateKey.sign(testMessage);

      expect(signature.level()).toBe(MLDSALevel.MLDSA87);
      expect(signature.size()).toBe(4627);

      expect(publicKey.verify(signature, testMessage)).toBe(true);
    });

    it("should fail verification with modified message", () => {
      const [privateKey, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const signature = privateKey.sign(testMessage);

      const modifiedMessage = new Uint8Array(testMessage);
      modifiedMessage[0] ^= 0xff;

      expect(publicKey.verify(signature, modifiedMessage)).toBe(false);
    });

    it("should fail verification with wrong key", () => {
      const [privateKey1] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const [, publicKey2] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);

      const signature = privateKey1.sign(testMessage);
      expect(publicKey2.verify(signature, testMessage)).toBe(false);
    });

    it("should fail verification with different security level", () => {
      const [privateKey44] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const [, publicKey65] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);

      const signature = privateKey44.sign(testMessage);
      // Level mismatch should fail
      expect(publicKey65.verify(signature, testMessage)).toBe(false);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      expect(privateKey.equals(privateKey)).toBe(true);
    });

    it("should not be equal to another key", () => {
      const [privateKey1] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const [privateKey2] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      expect(privateKey1.equals(privateKey2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const tags = privateKey.cborTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe(40103);
    });

    it("should roundtrip through tagged CBOR", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const cborData = privateKey.taggedCborData();
      const recovered = MLDSAPrivateKey.fromTaggedCborData(cborData);
      expect(recovered.equals(privateKey)).toBe(true);
      expect(recovered.level()).toBe(privateKey.level());
    });

    it("should preserve security level through CBOR", () => {
      for (const level of [MLDSALevel.MLDSA44, MLDSALevel.MLDSA65, MLDSALevel.MLDSA87]) {
        const [privateKey] = MLDSAPrivateKey.keypair(level);
        const cborData = privateKey.taggedCborData();
        const recovered = MLDSAPrivateKey.fromTaggedCborData(cborData);
        expect(recovered.level()).toBe(level);
      }
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const ur = privateKey.ur();
      expect(ur.urTypeStr()).toBe("mldsa-private-key");
    });

    it("should roundtrip through UR string", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const urString = privateKey.urString();
      const recovered = MLDSAPrivateKey.fromURString(urString);
      expect(recovered.equals(privateKey)).toBe(true);
    });
  });
});

describe("MLDSAPublicKey", () => {
  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const tags = publicKey.cborTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe(40104);
    });

    it("should roundtrip through tagged CBOR", () => {
      const [, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const cborData = publicKey.taggedCborData();
      const recovered = MLDSAPublicKey.fromTaggedCborData(cborData);
      expect(recovered.equals(publicKey)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const ur = publicKey.ur();
      expect(ur.urTypeStr()).toBe("mldsa-public-key");
    });

    it("should roundtrip through UR string", () => {
      const [, publicKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const urString = publicKey.urString();
      const recovered = MLDSAPublicKey.fromURString(urString);
      expect(recovered.equals(publicKey)).toBe(true);
    });
  });
});

describe("MLDSASignature", () => {
  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA44);
      const signature = privateKey.sign(new Uint8Array([1, 2, 3]));
      const tags = signature.cborTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe(40105);
    });

    it("should roundtrip through tagged CBOR", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const signature = privateKey.sign(new Uint8Array([1, 2, 3]));
      const cborData = signature.taggedCborData();
      const recovered = MLDSASignature.fromTaggedCborData(cborData);
      expect(recovered.equals(signature)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const signature = privateKey.sign(new Uint8Array([1, 2, 3]));
      const ur = signature.ur();
      expect(ur.urTypeStr()).toBe("mldsa-signature");
    });

    it("should roundtrip through UR string", () => {
      const [privateKey] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
      const signature = privateKey.sign(new Uint8Array([1, 2, 3]));
      const urString = signature.urString();
      const recovered = MLDSASignature.fromURString(urString);
      expect(recovered.equals(signature)).toBe(true);
    });
  });
});

// ============================================================================
// ML-KEM Tests
// ============================================================================

describe("MLKEMLevel", () => {
  describe("enum values", () => {
    it("should have correct parameter set values", () => {
      expect(MLKEMLevel.MLKEM512).toBe(512);
      expect(MLKEMLevel.MLKEM768).toBe(768);
      expect(MLKEMLevel.MLKEM1024).toBe(1024);
    });
  });

  describe("key sizes", () => {
    it("should have correct sizes for MLKEM512", () => {
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM512].privateKey).toBe(1632);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM512].publicKey).toBe(800);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM512].ciphertext).toBe(768);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM512].sharedSecret).toBe(32);
    });

    it("should have correct sizes for MLKEM768", () => {
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM768].privateKey).toBe(2400);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM768].publicKey).toBe(1184);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM768].ciphertext).toBe(1088);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM768].sharedSecret).toBe(32);
    });

    it("should have correct sizes for MLKEM1024", () => {
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM1024].privateKey).toBe(3168);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM1024].publicKey).toBe(1568);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM1024].ciphertext).toBe(1568);
      expect(MLKEM_KEY_SIZES[MLKEMLevel.MLKEM1024].sharedSecret).toBe(32);
    });
  });

  describe("utility functions", () => {
    it("should convert level to string", () => {
      expect(mlkemLevelToString(MLKEMLevel.MLKEM512)).toBe("MLKEM512");
      expect(mlkemLevelToString(MLKEMLevel.MLKEM768)).toBe("MLKEM768");
      expect(mlkemLevelToString(MLKEMLevel.MLKEM1024)).toBe("MLKEM1024");
    });

    it("should parse level from value", () => {
      expect(mlkemLevelFromValue(512)).toBe(MLKEMLevel.MLKEM512);
      expect(mlkemLevelFromValue(768)).toBe(MLKEMLevel.MLKEM768);
      expect(mlkemLevelFromValue(1024)).toBe(MLKEMLevel.MLKEM1024);
    });

    it("should throw on invalid level value", () => {
      expect(() => mlkemLevelFromValue(256)).toThrow();
    });

    it("should return correct key sizes", () => {
      expect(mlkemPrivateKeySize(MLKEMLevel.MLKEM512)).toBe(1632);
      expect(mlkemPublicKeySize(MLKEMLevel.MLKEM512)).toBe(800);
      expect(mlkemCiphertextSize(MLKEMLevel.MLKEM512)).toBe(768);
      expect(mlkemSharedSecretSize(MLKEMLevel.MLKEM512)).toBe(32);
    });
  });
});

describe("MLKEMPrivateKey", () => {
  describe("keypair generation", () => {
    it("should generate MLKEM512 keypair", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      expect(privateKey).toBeInstanceOf(MLKEMPrivateKey);
      expect(publicKey).toBeInstanceOf(MLKEMPublicKey);
      expect(privateKey.level()).toBe(MLKEMLevel.MLKEM512);
      expect(publicKey.level()).toBe(MLKEMLevel.MLKEM512);
      expect(privateKey.size()).toBe(1632);
      expect(publicKey.size()).toBe(800);
    });

    it("should generate MLKEM768 keypair", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      expect(privateKey.level()).toBe(MLKEMLevel.MLKEM768);
      expect(publicKey.level()).toBe(MLKEMLevel.MLKEM768);
      expect(privateKey.size()).toBe(2400);
      expect(publicKey.size()).toBe(1184);
    });

    it("should generate MLKEM1024 keypair", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM1024);
      expect(privateKey.level()).toBe(MLKEMLevel.MLKEM1024);
      expect(publicKey.level()).toBe(MLKEMLevel.MLKEM1024);
      expect(privateKey.size()).toBe(3168);
      expect(publicKey.size()).toBe(1568);
    });

    it("should default to MLKEM768", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair();
      expect(privateKey.level()).toBe(MLKEMLevel.MLKEM768);
      expect(publicKey.level()).toBe(MLKEMLevel.MLKEM768);
    });
  });

  describe("encapsulation and decapsulation", () => {
    it("should encapsulate and decapsulate with MLKEM512", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const { sharedSecret: encapsulatedSecret, ciphertext } = publicKey.encapsulate();

      expect(ciphertext).toBeInstanceOf(MLKEMCiphertext);
      expect(ciphertext.level()).toBe(MLKEMLevel.MLKEM512);
      expect(ciphertext.size()).toBe(768);

      const decapsulatedSecret = privateKey.decapsulate(ciphertext);
      expect(decapsulatedSecret.asBytes()).toEqual(encapsulatedSecret.asBytes());
    });

    it("should encapsulate and decapsulate with MLKEM768", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const { sharedSecret: encapsulatedSecret, ciphertext } = publicKey.encapsulate();

      expect(ciphertext.level()).toBe(MLKEMLevel.MLKEM768);
      expect(ciphertext.size()).toBe(1088);

      const decapsulatedSecret = privateKey.decapsulate(ciphertext);
      expect(decapsulatedSecret.asBytes()).toEqual(encapsulatedSecret.asBytes());
    });

    it("should encapsulate and decapsulate with MLKEM1024", () => {
      const [privateKey, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM1024);
      const { sharedSecret: encapsulatedSecret, ciphertext } = publicKey.encapsulate();

      expect(ciphertext.level()).toBe(MLKEMLevel.MLKEM1024);
      expect(ciphertext.size()).toBe(1568);

      const decapsulatedSecret = privateKey.decapsulate(ciphertext);
      expect(decapsulatedSecret.asBytes()).toEqual(encapsulatedSecret.asBytes());
    });

    it("should produce 32-byte shared secrets", () => {
      for (const level of [MLKEMLevel.MLKEM512, MLKEMLevel.MLKEM768, MLKEMLevel.MLKEM1024]) {
        const [privateKey, publicKey] = MLKEMPrivateKey.keypair(level);
        const { sharedSecret, ciphertext } = publicKey.encapsulate();
        const decapsulated = privateKey.decapsulate(ciphertext);

        expect(sharedSecret.asBytes().length).toBe(32);
        expect(decapsulated.asBytes().length).toBe(32);
      }
    });

    it("should fail decapsulation with wrong private key", () => {
      const [_privateKey1, publicKey1] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const [privateKey2] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);

      const { sharedSecret: original, ciphertext } = publicKey1.encapsulate();
      const wrongDecapsulated = privateKey2.decapsulate(ciphertext);

      // Wrong key produces different shared secret
      expect(wrongDecapsulated.asBytes()).not.toEqual(original.asBytes());
    });

    it("should fail decapsulation with level mismatch", () => {
      const [privateKey512] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const [, publicKey768] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);

      const { ciphertext } = publicKey768.encapsulate();

      expect(() => privateKey512.decapsulate(ciphertext)).toThrow();
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const [privateKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      expect(privateKey.equals(privateKey)).toBe(true);
    });

    it("should not be equal to another key", () => {
      const [privateKey1] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const [privateKey2] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      expect(privateKey1.equals(privateKey2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [privateKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const tags = privateKey.cborTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe(40100);
    });

    it("should roundtrip through tagged CBOR", () => {
      const [privateKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const cborData = privateKey.taggedCborData();
      const recovered = MLKEMPrivateKey.fromTaggedCborData(cborData);
      expect(recovered.equals(privateKey)).toBe(true);
      expect(recovered.level()).toBe(privateKey.level());
    });

    it("should preserve security level through CBOR", () => {
      for (const level of [MLKEMLevel.MLKEM512, MLKEMLevel.MLKEM768, MLKEMLevel.MLKEM1024]) {
        const [privateKey] = MLKEMPrivateKey.keypair(level);
        const cborData = privateKey.taggedCborData();
        const recovered = MLKEMPrivateKey.fromTaggedCborData(cborData);
        expect(recovered.level()).toBe(level);
      }
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [privateKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const ur = privateKey.ur();
      expect(ur.urTypeStr()).toBe("mlkem-private-key");
    });

    it("should roundtrip through UR string", () => {
      const [privateKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const urString = privateKey.urString();
      const recovered = MLKEMPrivateKey.fromURString(urString);
      expect(recovered.equals(privateKey)).toBe(true);
    });
  });
});

describe("MLKEMPublicKey", () => {
  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const tags = publicKey.cborTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe(40101);
    });

    it("should roundtrip through tagged CBOR", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const cborData = publicKey.taggedCborData();
      const recovered = MLKEMPublicKey.fromTaggedCborData(cborData);
      expect(recovered.equals(publicKey)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const ur = publicKey.ur();
      expect(ur.urTypeStr()).toBe("mlkem-public-key");
    });

    it("should roundtrip through UR string", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const urString = publicKey.urString();
      const recovered = MLKEMPublicKey.fromURString(urString);
      expect(recovered.equals(publicKey)).toBe(true);
    });
  });
});

describe("MLKEMCiphertext", () => {
  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM512);
      const { ciphertext } = publicKey.encapsulate();
      const tags = ciphertext.cborTags();
      expect(tags).toHaveLength(1);
      expect(tags[0].value).toBe(40102);
    });

    it("should roundtrip through tagged CBOR", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const { ciphertext } = publicKey.encapsulate();
      const cborData = ciphertext.taggedCborData();
      const recovered = MLKEMCiphertext.fromTaggedCborData(cborData);
      expect(recovered.equals(ciphertext)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const { ciphertext } = publicKey.encapsulate();
      const ur = ciphertext.ur();
      expect(ur.urTypeStr()).toBe("mlkem-ciphertext");
    });

    it("should roundtrip through UR string", () => {
      const [, publicKey] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);
      const { ciphertext } = publicKey.encapsulate();
      const urString = ciphertext.urString();
      const recovered = MLKEMCiphertext.fromURString(urString);
      expect(recovered.equals(ciphertext)).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Post-Quantum Integration", () => {
  it("should work together: ML-KEM for key exchange, ML-DSA for signing", () => {
    // Alice generates ML-KEM keypair
    const [aliceKemPrivate, aliceKemPublic] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);

    // Alice generates ML-DSA keypair (not used in this test, but demonstrates typical usage)
    const [_aliceDsaPrivate, _aliceDsaPublic] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);

    // Bob uses Alice's public KEM key to encapsulate a shared secret
    const { sharedSecret: bobSecret, ciphertext } = aliceKemPublic.encapsulate();

    // Bob signs the ciphertext with his own DSA key
    const [bobDsaPrivate, bobDsaPublic] = MLDSAPrivateKey.keypair(MLDSALevel.MLDSA65);
    const signature = bobDsaPrivate.sign(ciphertext.asBytes());

    // Alice verifies Bob's signature
    expect(bobDsaPublic.verify(signature, ciphertext.asBytes())).toBe(true);

    // Alice decapsulates the shared secret
    const aliceSecret = aliceKemPrivate.decapsulate(ciphertext);

    // Both have the same shared secret
    expect(aliceSecret.asBytes()).toEqual(bobSecret.asBytes());
  });

  it("should serialize and deserialize a complete key exchange", () => {
    // Generate keypairs
    const [kemPrivate, kemPublic] = MLKEMPrivateKey.keypair(MLKEMLevel.MLKEM768);

    // Encapsulate
    const { sharedSecret: original, ciphertext } = kemPublic.encapsulate();

    // Serialize everything
    const privateKeyUr = kemPrivate.urString();
    const publicKeyUr = kemPublic.urString();
    const ciphertextUr = ciphertext.urString();

    // Deserialize
    const recoveredPrivate = MLKEMPrivateKey.fromURString(privateKeyUr);
    const recoveredPublic = MLKEMPublicKey.fromURString(publicKeyUr);
    const recoveredCiphertext = MLKEMCiphertext.fromURString(ciphertextUr);

    // Verify keys match
    expect(recoveredPrivate.equals(kemPrivate)).toBe(true);
    expect(recoveredPublic.equals(kemPublic)).toBe(true);
    expect(recoveredCiphertext.equals(ciphertext)).toBe(true);

    // Decapsulate with recovered private key
    const decapsulated = recoveredPrivate.decapsulate(recoveredCiphertext);
    expect(decapsulated.asBytes()).toEqual(original.asBytes());
  });
});
