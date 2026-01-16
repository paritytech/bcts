/**
 * Tests for encrypted-key module
 *
 * Ported from bc-components-rust/src/encrypted_key/encrypted_key_impl.rs
 */

import { describe, it, expect } from "vitest";
import {
  HashType,
  hashTypeToString,
  hashTypeToCbor,
  hashTypeFromCbor,
  KeyDerivationMethod,
  defaultKeyDerivationMethod,
  keyDerivationMethodIndex,
  keyDerivationMethodFromIndex,
  keyDerivationMethodToString,
  HKDFParams,
  PBKDF2Params,
  ScryptParams,
  Argon2idParams,
  SSHAgentParams,
  hkdfParams,
  pbkdf2Params,
  scryptParams,
  argon2idParams,
  sshAgentParams,
  keyDerivationParamsMethod,
  isPasswordBased,
  keyDerivationParamsToString,
  EncryptedKey,
} from "../src/encrypted-key/index.js";
import { SymmetricKey } from "../src/symmetric/symmetric-key.js";
import { Salt } from "../src/salt.js";

// Test helper functions (matching Rust tests)
function testSecret(): Uint8Array {
  return new TextEncoder().encode("correct horse battery staple");
}

function testContentKey(): SymmetricKey {
  return SymmetricKey.new();
}

describe("HashType", () => {
  describe("values", () => {
    it("should have correct values", () => {
      expect(HashType.SHA256).toBe(0);
      expect(HashType.SHA512).toBe(1);
    });
  });

  describe("hashTypeToString", () => {
    it("should return correct strings", () => {
      expect(hashTypeToString(HashType.SHA256)).toBe("SHA256");
      expect(hashTypeToString(HashType.SHA512)).toBe("SHA512");
    });
  });

  describe("CBOR roundtrip", () => {
    it("should roundtrip SHA256", () => {
      const cbor = hashTypeToCbor(HashType.SHA256);
      const restored = hashTypeFromCbor(cbor);
      expect(restored).toBe(HashType.SHA256);
    });

    it("should roundtrip SHA512", () => {
      const cbor = hashTypeToCbor(HashType.SHA512);
      const restored = hashTypeFromCbor(cbor);
      expect(restored).toBe(HashType.SHA512);
    });
  });
});

describe("KeyDerivationMethod", () => {
  describe("values", () => {
    it("should have correct values", () => {
      expect(KeyDerivationMethod.HKDF).toBe(0);
      expect(KeyDerivationMethod.PBKDF2).toBe(1);
      expect(KeyDerivationMethod.Scrypt).toBe(2);
      expect(KeyDerivationMethod.Argon2id).toBe(3);
      expect(KeyDerivationMethod.SSHAgent).toBe(4);
    });
  });

  describe("default", () => {
    it("should default to Argon2id", () => {
      expect(defaultKeyDerivationMethod()).toBe(KeyDerivationMethod.Argon2id);
    });
  });

  describe("index conversion", () => {
    it("should convert to index correctly", () => {
      expect(keyDerivationMethodIndex(KeyDerivationMethod.HKDF)).toBe(0);
      expect(keyDerivationMethodIndex(KeyDerivationMethod.PBKDF2)).toBe(1);
      expect(keyDerivationMethodIndex(KeyDerivationMethod.Scrypt)).toBe(2);
      expect(keyDerivationMethodIndex(KeyDerivationMethod.Argon2id)).toBe(3);
      expect(keyDerivationMethodIndex(KeyDerivationMethod.SSHAgent)).toBe(4);
    });

    it("should convert from index correctly", () => {
      expect(keyDerivationMethodFromIndex(0)).toBe(KeyDerivationMethod.HKDF);
      expect(keyDerivationMethodFromIndex(1)).toBe(KeyDerivationMethod.PBKDF2);
      expect(keyDerivationMethodFromIndex(2)).toBe(KeyDerivationMethod.Scrypt);
      expect(keyDerivationMethodFromIndex(3)).toBe(KeyDerivationMethod.Argon2id);
      expect(keyDerivationMethodFromIndex(4)).toBe(KeyDerivationMethod.SSHAgent);
    });

    it("should return undefined on invalid index", () => {
      expect(keyDerivationMethodFromIndex(99)).toBeUndefined();
    });
  });

  describe("toString", () => {
    it("should return correct strings", () => {
      expect(keyDerivationMethodToString(KeyDerivationMethod.HKDF)).toBe("HKDF");
      expect(keyDerivationMethodToString(KeyDerivationMethod.PBKDF2)).toBe("PBKDF2");
      expect(keyDerivationMethodToString(KeyDerivationMethod.Scrypt)).toBe("Scrypt");
      expect(keyDerivationMethodToString(KeyDerivationMethod.Argon2id)).toBe("Argon2id");
      expect(keyDerivationMethodToString(KeyDerivationMethod.SSHAgent)).toBe("SSHAgent");
    });
  });
});

describe("HKDFParams", () => {
  describe("creation", () => {
    it("should create with defaults", () => {
      const params = HKDFParams.new();
      expect(params.salt()).toBeDefined();
      expect(params.hashType()).toBe(HashType.SHA256);
      expect(params.index()).toBe(0);
    });

    it("should create with custom settings", () => {
      const salt = Salt.newWithLen(16);
      const params = HKDFParams.newOpt(salt, HashType.SHA512);
      expect(params.salt().equals(salt)).toBe(true);
      expect(params.hashType()).toBe(HashType.SHA512);
    });
  });

  describe("toString", () => {
    it("should return correct string", () => {
      const params = HKDFParams.new();
      expect(params.toString()).toBe("HKDF(SHA256)");
    });
  });

  describe("equality", () => {
    it("should be equal with same salt and hash type", () => {
      const salt = Salt.newWithLen(16);
      const params1 = HKDFParams.newOpt(salt, HashType.SHA256);
      const params2 = HKDFParams.newOpt(salt, HashType.SHA256);
      expect(params1.equals(params2)).toBe(true);
    });

    it("should not be equal with different hash type", () => {
      const salt = Salt.newWithLen(16);
      const params1 = HKDFParams.newOpt(salt, HashType.SHA256);
      const params2 = HKDFParams.newOpt(salt, HashType.SHA512);
      expect(params1.equals(params2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const params = HKDFParams.new();
      const cborValue = params.toCbor();
      const restored = HKDFParams.fromCbor(cborValue);
      expect(restored.equals(params)).toBe(true);
    });
  });
});

describe("PBKDF2Params", () => {
  describe("creation", () => {
    it("should create with defaults", () => {
      const params = PBKDF2Params.new();
      expect(params.salt()).toBeDefined();
      expect(params.iterations()).toBe(100_000);
      expect(params.hashType()).toBe(HashType.SHA256);
      expect(params.index()).toBe(1);
    });

    it("should create with custom settings", () => {
      const salt = Salt.newWithLen(16);
      const params = PBKDF2Params.newOpt(salt, 50_000, HashType.SHA512);
      expect(params.salt().equals(salt)).toBe(true);
      expect(params.iterations()).toBe(50_000);
      expect(params.hashType()).toBe(HashType.SHA512);
    });
  });

  describe("toString", () => {
    it("should return correct string", () => {
      const params = PBKDF2Params.new();
      expect(params.toString()).toBe("PBKDF2(SHA256)");
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const params = PBKDF2Params.new();
      const cborValue = params.toCbor();
      const restored = PBKDF2Params.fromCbor(cborValue);
      expect(restored.equals(params)).toBe(true);
    });
  });
});

describe("ScryptParams", () => {
  describe("creation", () => {
    it("should create with defaults", () => {
      const params = ScryptParams.new();
      expect(params.salt()).toBeDefined();
      expect(params.logN()).toBe(15);
      expect(params.r()).toBe(8);
      expect(params.p()).toBe(1);
      expect(params.index()).toBe(2);
    });

    it("should create with custom settings", () => {
      const salt = Salt.newWithLen(16);
      const params = ScryptParams.newOpt(salt, 14, 16, 2);
      expect(params.salt().equals(salt)).toBe(true);
      expect(params.logN()).toBe(14);
      expect(params.r()).toBe(16);
      expect(params.p()).toBe(2);
    });
  });

  describe("toString", () => {
    it("should return correct string", () => {
      const params = ScryptParams.new();
      expect(params.toString()).toBe("Scrypt");
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const params = ScryptParams.new();
      const cborValue = params.toCbor();
      const restored = ScryptParams.fromCbor(cborValue);
      expect(restored.equals(params)).toBe(true);
    });
  });
});

describe("Argon2idParams", () => {
  describe("creation", () => {
    it("should create with defaults", () => {
      const params = Argon2idParams.new();
      expect(params.salt()).toBeDefined();
      expect(params.index()).toBe(3);
    });

    it("should create with custom salt", () => {
      const salt = Salt.newWithLen(16);
      const params = Argon2idParams.newOpt(salt);
      expect(params.salt().equals(salt)).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return correct string", () => {
      const params = Argon2idParams.new();
      expect(params.toString()).toBe("Argon2id");
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const params = Argon2idParams.new();
      const cborValue = params.toCbor();
      const restored = Argon2idParams.fromCbor(cborValue);
      expect(restored.equals(params)).toBe(true);
    });
  });
});

describe("SSHAgentParams", () => {
  describe("creation", () => {
    it("should create with default salt and ID", () => {
      const params = SSHAgentParams.new("test-key-id");
      expect(params.salt()).toBeDefined();
      expect(params.id()).toBe("test-key-id");
      expect(params.index()).toBe(4);
    });

    it("should create with custom salt and ID", () => {
      const salt = Salt.newWithLen(16);
      const params = SSHAgentParams.newOpt(salt, "custom-key");
      expect(params.salt().equals(salt)).toBe(true);
      expect(params.id()).toBe("custom-key");
    });
  });

  describe("toString", () => {
    it("should return correct string", () => {
      const params = SSHAgentParams.new("my-ssh-key");
      expect(params.toString()).toBe('SSHAgent(id: "my-ssh-key")');
    });
  });

  describe("equality", () => {
    it("should be equal with same salt and id", () => {
      const salt = Salt.newWithLen(16);
      const params1 = SSHAgentParams.newOpt(salt, "key-id");
      const params2 = SSHAgentParams.newOpt(salt, "key-id");
      expect(params1.equals(params2)).toBe(true);
    });

    it("should not be equal with different id", () => {
      const salt = Salt.newWithLen(16);
      const params1 = SSHAgentParams.newOpt(salt, "key-id-1");
      const params2 = SSHAgentParams.newOpt(salt, "key-id-2");
      expect(params1.equals(params2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should roundtrip through CBOR", () => {
      const params = SSHAgentParams.new("test-key");
      const cborValue = params.toCbor();
      const restored = SSHAgentParams.fromCbor(cborValue);
      expect(restored.equals(params)).toBe(true);
      expect(restored.id()).toBe("test-key");
    });
  });

  describe("lock/unlock (not implemented)", () => {
    it("should throw error on lock attempt", () => {
      const params = SSHAgentParams.new("test-key");
      const contentKey = SymmetricKey.new();
      const secret = new Uint8Array(32);

      expect(() => params.lock(contentKey, secret)).toThrow("SSH agent");
    });
  });
});

describe("KeyDerivationParams", () => {
  describe("factory functions", () => {
    it("should create HKDF params", () => {
      const params = hkdfParams();
      expect(params.type).toBe("hkdf");
      expect(params.params).toBeInstanceOf(HKDFParams);
    });

    it("should create PBKDF2 params", () => {
      const params = pbkdf2Params();
      expect(params.type).toBe("pbkdf2");
      expect(params.params).toBeInstanceOf(PBKDF2Params);
    });

    it("should create Scrypt params", () => {
      const params = scryptParams();
      expect(params.type).toBe("scrypt");
      expect(params.params).toBeInstanceOf(ScryptParams);
    });

    it("should create Argon2id params", () => {
      const params = argon2idParams();
      expect(params.type).toBe("argon2id");
      expect(params.params).toBeInstanceOf(Argon2idParams);
    });

    it("should create SSH agent params from string", () => {
      const params = sshAgentParams("test-key-id");
      expect(params.type).toBe("sshagent");
      expect(params.params).toBeInstanceOf(SSHAgentParams);
      expect((params.params as SSHAgentParams).id()).toBe("test-key-id");
    });

    it("should create SSH agent params from instance", () => {
      const sshParams = SSHAgentParams.new("my-key");
      const params = sshAgentParams(sshParams);
      expect(params.type).toBe("sshagent");
      expect(params.params).toBe(sshParams);
    });
  });

  describe("method detection", () => {
    it("should detect HKDF method", () => {
      const params = hkdfParams();
      expect(keyDerivationParamsMethod(params)).toBe(KeyDerivationMethod.HKDF);
    });

    it("should detect PBKDF2 method", () => {
      const params = pbkdf2Params();
      expect(keyDerivationParamsMethod(params)).toBe(KeyDerivationMethod.PBKDF2);
    });

    it("should detect Scrypt method", () => {
      const params = scryptParams();
      expect(keyDerivationParamsMethod(params)).toBe(KeyDerivationMethod.Scrypt);
    });

    it("should detect Argon2id method", () => {
      const params = argon2idParams();
      expect(keyDerivationParamsMethod(params)).toBe(KeyDerivationMethod.Argon2id);
    });

    it("should detect SSHAgent method", () => {
      const params = sshAgentParams("test-key");
      expect(keyDerivationParamsMethod(params)).toBe(KeyDerivationMethod.SSHAgent);
    });
  });

  describe("isPasswordBased", () => {
    it("should return false for HKDF", () => {
      expect(isPasswordBased(hkdfParams())).toBe(false);
    });

    it("should return true for PBKDF2", () => {
      expect(isPasswordBased(pbkdf2Params())).toBe(true);
    });

    it("should return true for Scrypt", () => {
      expect(isPasswordBased(scryptParams())).toBe(true);
    });

    it("should return true for Argon2id", () => {
      expect(isPasswordBased(argon2idParams())).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return correct strings", () => {
      expect(keyDerivationParamsToString(hkdfParams())).toBe("HKDF(SHA256)");
      expect(keyDerivationParamsToString(pbkdf2Params())).toBe("PBKDF2(SHA256)");
      expect(keyDerivationParamsToString(scryptParams())).toBe("Scrypt");
      expect(keyDerivationParamsToString(argon2idParams())).toBe("Argon2id");
    });
  });
});

describe("EncryptedKey", () => {
  describe("HKDF roundtrip", () => {
    it("should encrypt and decrypt with HKDF", () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      const encrypted = EncryptedKey.lock(KeyDerivationMethod.HKDF, secret, contentKey);
      expect(encrypted.toString()).toBe("EncryptedKey(HKDF(SHA256))");
      expect(encrypted.method()).toBe(KeyDerivationMethod.HKDF);
      expect(encrypted.isPasswordBased()).toBe(false);

      const decrypted = encrypted.unlock(secret);
      expect(decrypted.equals(contentKey)).toBe(true);
    });

    it("should roundtrip HKDF through CBOR", () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      const encrypted = EncryptedKey.lock(KeyDerivationMethod.HKDF, secret, contentKey);
      const cborData = encrypted.taggedCborData();
      const restored = EncryptedKey.fromTaggedCborData(cborData);
      const decrypted = restored.unlock(secret);

      expect(decrypted.equals(contentKey)).toBe(true);
    });
  });

  describe("PBKDF2 roundtrip", () => {
    it("should encrypt and decrypt with PBKDF2", () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      // Use fewer iterations for faster tests
      const salt = Salt.newWithLen(16);
      const pbkdf2 = PBKDF2Params.newOpt(salt, 1000, HashType.SHA256);
      const params = pbkdf2Params(pbkdf2);
      const encrypted = EncryptedKey.lockOpt(params, secret, contentKey);
      expect(encrypted.toString()).toBe("EncryptedKey(PBKDF2(SHA256))");
      expect(encrypted.method()).toBe(KeyDerivationMethod.PBKDF2);
      expect(encrypted.isPasswordBased()).toBe(true);

      const decrypted = encrypted.unlock(secret);
      expect(decrypted.equals(contentKey)).toBe(true);
    });

    it("should roundtrip PBKDF2 through CBOR", () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      const salt = Salt.newWithLen(16);
      const pbkdf2 = PBKDF2Params.newOpt(salt, 1000, HashType.SHA256);
      const params = pbkdf2Params(pbkdf2);
      const encrypted = EncryptedKey.lockOpt(params, secret, contentKey);
      const cborData = encrypted.taggedCborData();
      const restored = EncryptedKey.fromTaggedCborData(cborData);
      const decrypted = restored.unlock(secret);

      expect(decrypted.equals(contentKey)).toBe(true);
    });
  });

  describe("Scrypt roundtrip", () => {
    it("should encrypt and decrypt with Scrypt", () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      // Use lower params for faster tests (logN=10 instead of 15)
      const salt = Salt.newWithLen(16);
      const scrypt = ScryptParams.newOpt(salt, 10, 8, 1);
      const params = scryptParams(scrypt);
      const encrypted = EncryptedKey.lockOpt(params, secret, contentKey);
      expect(encrypted.toString()).toBe("EncryptedKey(Scrypt)");
      expect(encrypted.method()).toBe(KeyDerivationMethod.Scrypt);
      expect(encrypted.isPasswordBased()).toBe(true);

      const decrypted = encrypted.unlock(secret);
      expect(decrypted.equals(contentKey)).toBe(true);
    });

    it("should roundtrip Scrypt through CBOR", () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      const salt = Salt.newWithLen(16);
      const scrypt = ScryptParams.newOpt(salt, 10, 8, 1);
      const params = scryptParams(scrypt);
      const encrypted = EncryptedKey.lockOpt(params, secret, contentKey);
      const cborData = encrypted.taggedCborData();
      const restored = EncryptedKey.fromTaggedCborData(cborData);
      const decrypted = restored.unlock(secret);

      expect(decrypted.equals(contentKey)).toBe(true);
    });
  });

  describe("Argon2id roundtrip", () => {
    it("should encrypt and decrypt with Argon2id", { timeout: 60000 }, () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      const encrypted = EncryptedKey.lock(KeyDerivationMethod.Argon2id, secret, contentKey);
      expect(encrypted.toString()).toBe("EncryptedKey(Argon2id)");
      expect(encrypted.method()).toBe(KeyDerivationMethod.Argon2id);
      expect(encrypted.isPasswordBased()).toBe(true);

      const decrypted = encrypted.unlock(secret);
      expect(decrypted.equals(contentKey)).toBe(true);
    });

    it("should roundtrip Argon2id through CBOR", { timeout: 30000 }, () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      const encrypted = EncryptedKey.lock(KeyDerivationMethod.Argon2id, secret, contentKey);
      const cborData = encrypted.taggedCborData();
      const restored = EncryptedKey.fromTaggedCborData(cborData);
      const decrypted = restored.unlock(secret);

      expect(decrypted.equals(contentKey)).toBe(true);
    });
  });

  describe("wrong secret fails", () => {
    it("should fail with wrong secret for HKDF", () => {
      const secret = testSecret();
      const wrongSecret = new TextEncoder().encode("wrong secret");
      const contentKey = testContentKey();

      const encrypted = EncryptedKey.lock(KeyDerivationMethod.HKDF, secret, contentKey);
      expect(() => encrypted.unlock(wrongSecret)).toThrow();
    });

    it("should fail with wrong secret for PBKDF2", () => {
      const secret = testSecret();
      const wrongSecret = new TextEncoder().encode("wrong secret");
      const contentKey = testContentKey();

      const salt = Salt.newWithLen(16);
      const pbkdf2 = PBKDF2Params.newOpt(salt, 1000, HashType.SHA256);
      const params = pbkdf2Params(pbkdf2);
      const encrypted = EncryptedKey.lockOpt(params, secret, contentKey);
      expect(() => encrypted.unlock(wrongSecret)).toThrow();
    });

    it("should fail with wrong secret for Scrypt", () => {
      const secret = testSecret();
      const wrongSecret = new TextEncoder().encode("wrong secret");
      const contentKey = testContentKey();

      const salt = Salt.newWithLen(16);
      const scrypt = ScryptParams.newOpt(salt, 10, 8, 1);
      const params = scryptParams(scrypt);
      const encrypted = EncryptedKey.lockOpt(params, secret, contentKey);
      expect(() => encrypted.unlock(wrongSecret)).toThrow();
    });

    it("should fail with wrong secret for Argon2id", { timeout: 30000 }, () => {
      const secret = testSecret();
      const wrongSecret = new TextEncoder().encode("wrong secret");
      const contentKey = testContentKey();

      const encrypted = EncryptedKey.lock(KeyDerivationMethod.Argon2id, secret, contentKey);
      expect(() => encrypted.unlock(wrongSecret)).toThrow();
    });
  });

  describe("params variant", () => {
    it("should have correct params type for each method", { timeout: 30000 }, () => {
      const secret = testSecret();
      const contentKey = testContentKey();

      const hkdf = EncryptedKey.lock(KeyDerivationMethod.HKDF, secret, contentKey);
      expect(hkdf.params().type).toBe("hkdf");

      const salt = Salt.newWithLen(16);
      const pbkdf2P = PBKDF2Params.newOpt(salt, 1000, HashType.SHA256);
      const pbkdf2 = EncryptedKey.lockOpt(pbkdf2Params(pbkdf2P), secret, contentKey);
      expect(pbkdf2.params().type).toBe("pbkdf2");

      const scryptP = ScryptParams.newOpt(salt, 10, 8, 1);
      const scrypt = EncryptedKey.lockOpt(scryptParams(scryptP), secret, contentKey);
      expect(scrypt.params().type).toBe("scrypt");

      const argon2id = EncryptedKey.lock(KeyDerivationMethod.Argon2id, secret, contentKey);
      expect(argon2id.params().type).toBe("argon2id");
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const secret = testSecret();
      const contentKey = testContentKey();
      const encrypted = EncryptedKey.lock(KeyDerivationMethod.HKDF, secret, contentKey);
      expect(encrypted.equals(encrypted)).toBe(true);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR string", () => {
      const secret = testSecret();
      const contentKey = testContentKey();
      const encrypted = EncryptedKey.lock(KeyDerivationMethod.HKDF, secret, contentKey);
      const urString = encrypted.urString();

      expect(urString.startsWith("ur:encrypted-key/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const secret = testSecret();
      const contentKey = testContentKey();
      const encrypted = EncryptedKey.lock(KeyDerivationMethod.HKDF, secret, contentKey);
      const urString = encrypted.urString();
      const restored = EncryptedKey.fromURString(urString);
      const decrypted = restored.unlock(secret);

      expect(decrypted.equals(contentKey)).toBe(true);
    });
  });
});
