/**
 * Tests for symmetric encryption module
 *
 * Ported from bc-components-rust/src/symmetric/mod.rs
 */

import { describe, it, expect } from "@jest/globals";
import { SymmetricKey, AuthenticationTag, EncryptedMessage } from "../src/symmetric/index.js";
import { Nonce } from "../src/nonce.js";

describe("AuthenticationTag", () => {
  const TEST_HEX = "1ae10b594f09e26a7e902ecbd0600691";

  describe("creation", () => {
    it("should create from data", () => {
      const data = new Uint8Array(16);
      const tag = AuthenticationTag.fromData(data);

      expect(tag.data().length).toBe(AuthenticationTag.AUTHENTICATION_TAG_SIZE);
    });

    it("should create using fromDataRef", () => {
      const data = new Uint8Array(16);
      const tag = AuthenticationTag.fromDataRef(data);

      expect(tag.data().length).toBe(AuthenticationTag.AUTHENTICATION_TAG_SIZE);
    });

    it("should throw on wrong size with fromDataRef", () => {
      const wrongSizeData = new Uint8Array(15);

      expect(() => AuthenticationTag.fromDataRef(wrongSizeData)).toThrow();
    });

    it("should create using from (legacy alias)", () => {
      const data = new Uint8Array(16);
      const tag = AuthenticationTag.from(data);

      expect(tag.data().length).toBe(AuthenticationTag.AUTHENTICATION_TAG_SIZE);
    });

    it("should create from hex string", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);

      expect(tag.toHex()).toBe(TEST_HEX);
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);

      expect(tag.data()).toBeInstanceOf(Uint8Array);
      expect(tag.asBytes()).toBeInstanceOf(Uint8Array);
      expect(tag.toData()).toBeInstanceOf(Uint8Array);
    });

    it("should return hex representation", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);

      expect(tag.toHex()).toBe(TEST_HEX);
    });

    it("should return base64 representation", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);

      expect(typeof tag.toBase64()).toBe("string");
    });

    it("should return string representation", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);

      expect(tag.toString()).toBe(`AuthenticationTag(${TEST_HEX})`);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);

      expect(tag.equals(tag)).toBe(true);
    });

    it("should be equal to another tag with the same data", () => {
      const tag1 = AuthenticationTag.fromHex(TEST_HEX);
      const tag2 = AuthenticationTag.fromHex(TEST_HEX);

      expect(tag1.equals(tag2)).toBe(true);
    });

    it("should not be equal to a tag with different data", () => {
      const tag1 = AuthenticationTag.fromHex(TEST_HEX);
      const tag2 = AuthenticationTag.fromHex("1ae10b594f09e26a7e902ecbd0600692");

      expect(tag1.equals(tag2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should serialize to CBOR", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);
      const cbor = tag.toCbor();

      expect(cbor).toBeDefined();
    });

    it("should serialize to CBOR binary data", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);
      const data = tag.toCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through CBOR", () => {
      const tag = AuthenticationTag.fromHex(TEST_HEX);
      const data = tag.toCborData();
      const restored = AuthenticationTag.fromCborData(data);

      expect(restored.equals(tag)).toBe(true);
    });
  });
});

describe("SymmetricKey", () => {
  const TEST_HEX = "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f";

  describe("creation", () => {
    it("should create a new random key", () => {
      const key = SymmetricKey.new();

      expect(key.data().length).toBe(SymmetricKey.SYMMETRIC_KEY_SIZE);
    });

    it("should create unique random keys", () => {
      const key1 = SymmetricKey.new();
      const key2 = SymmetricKey.new();

      expect(key1.equals(key2)).toBe(false);
    });

    it("should create using random (alias)", () => {
      const key = SymmetricKey.random();

      expect(key.data().length).toBe(SymmetricKey.SYMMETRIC_KEY_SIZE);
    });

    it("should create from raw data", () => {
      const data = new Uint8Array(32);
      const key = SymmetricKey.fromData(data);

      expect(key.data()).toEqual(data);
    });

    it("should create using fromDataRef", () => {
      const data = new Uint8Array(32);
      const key = SymmetricKey.fromDataRef(data);

      expect(key.data().length).toBe(SymmetricKey.SYMMETRIC_KEY_SIZE);
    });

    it("should throw on wrong size with fromDataRef", () => {
      const wrongSizeData = new Uint8Array(31);

      expect(() => SymmetricKey.fromDataRef(wrongSizeData)).toThrow();
    });

    it("should create using from (legacy alias)", () => {
      const data = new Uint8Array(32);
      const key = SymmetricKey.from(data);

      expect(key.data().length).toBe(SymmetricKey.SYMMETRIC_KEY_SIZE);
    });

    it("should create from hex string", () => {
      const key = SymmetricKey.fromHex(TEST_HEX);

      expect(key.toHex()).toBe(TEST_HEX);
    });
  });

  describe("accessors", () => {
    it("should return data as bytes", () => {
      const key = SymmetricKey.new();

      expect(key.data()).toBeInstanceOf(Uint8Array);
      expect(key.asBytes()).toBeInstanceOf(Uint8Array);
      expect(key.toData()).toBeInstanceOf(Uint8Array);
    });

    it("should return hex representation", () => {
      const key = SymmetricKey.fromHex(TEST_HEX);

      expect(key.hex()).toBe(TEST_HEX);
      expect(key.toHex()).toBe(TEST_HEX);
    });

    it("should return base64 representation", () => {
      const key = SymmetricKey.new();

      expect(typeof key.toBase64()).toBe("string");
    });

    it("should return string representation", () => {
      const key = SymmetricKey.fromHex(TEST_HEX);

      expect(key.toString()).toBe("SymmetricKey(80818283...)");
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const key = SymmetricKey.new();

      expect(key.equals(key)).toBe(true);
    });

    it("should be equal to another key with the same data", () => {
      const key1 = SymmetricKey.fromHex(TEST_HEX);
      const key2 = SymmetricKey.fromHex(TEST_HEX);

      expect(key1.equals(key2)).toBe(true);
    });

    it("should not be equal to a key with different data", () => {
      const key1 = SymmetricKey.fromHex(TEST_HEX);
      const key2 = SymmetricKey.new();

      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const key = SymmetricKey.new();
      const tags = key.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40023); // SYMMETRIC_KEY tag
    });

    it("should serialize to untagged CBOR", () => {
      const key = SymmetricKey.new();
      const untagged = key.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const key = SymmetricKey.new();
      const tagged = key.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const key = SymmetricKey.new();
      const data = key.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const key = SymmetricKey.new();
      const data = key.taggedCborData();
      const restored = SymmetricKey.fromTaggedCborData(data);

      expect(restored.equals(key)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const key = SymmetricKey.new();
      const data = key.untaggedCbor().toData();
      const restored = SymmetricKey.fromUntaggedCborData(data);

      expect(restored.equals(key)).toBe(true);
    });
  });
});

describe("EncryptedMessage", () => {
  // RFC 8439 test vectors
  const PLAINTEXT = new TextEncoder().encode("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const AAD = Uint8Array.from([0x50, 0x51, 0x52, 0x53, 0xc0, 0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7]);
  const KEY_HEX = "808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f";
  const NONCE_HEX = "070000004041424344454647";
  const CIPHERTEXT_HEX = "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b6116";
  const AUTH_HEX = "1ae10b594f09e26a7e902ecbd0600691";

  describe("RFC test vector", () => {
    it("should encrypt to expected ciphertext", () => {
      const key = SymmetricKey.fromHex(KEY_HEX);
      const nonce = Nonce.fromHex(NONCE_HEX);
      const encrypted = key.encrypt(PLAINTEXT, AAD, nonce);

      expect(bytesToHex(encrypted.ciphertext())).toBe(CIPHERTEXT_HEX);
      expect(bytesToHex(encrypted.aad())).toBe(bytesToHex(AAD));
      expect(encrypted.nonce().toHex()).toBe(NONCE_HEX);
      expect(encrypted.authenticationTag().toHex()).toBe(AUTH_HEX);
    });

    it("should decrypt to original plaintext", () => {
      const key = SymmetricKey.fromHex(KEY_HEX);
      const nonce = Nonce.fromHex(NONCE_HEX);
      const encrypted = key.encrypt(PLAINTEXT, AAD, nonce);
      const decrypted = key.decrypt(encrypted);

      expect(decrypted).toEqual(PLAINTEXT);
    });
  });

  describe("random key and nonce", () => {
    it("should encrypt and decrypt correctly", () => {
      const key = SymmetricKey.new();
      const nonce = Nonce.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD, nonce);
      const decrypted = key.decrypt(encrypted);

      expect(decrypted).toEqual(PLAINTEXT);
    });
  });

  describe("empty data", () => {
    it("should encrypt and decrypt empty data", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(new Uint8Array(0));
      const decrypted = key.decrypt(encrypted);

      expect(decrypted.length).toBe(0);
    });
  });

  describe("accessors", () => {
    it("should return ciphertext", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT);

      expect(encrypted.ciphertext()).toBeInstanceOf(Uint8Array);
      expect(encrypted.ciphertext().length).toBe(PLAINTEXT.length);
    });

    it("should return nonce", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT);

      expect(encrypted.nonce()).toBeInstanceOf(Nonce);
    });

    it("should return authentication tag", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT);

      expect(encrypted.authenticationTag()).toBeInstanceOf(AuthenticationTag);
    });

    it("should return AAD", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);

      expect(encrypted.aad()).toEqual(AAD);
    });

    it("should return empty AAD when not provided", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT);

      expect(encrypted.aad().length).toBe(0);
    });
  });

  describe("equality", () => {
    it("should be equal to itself", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);

      expect(encrypted.equals(encrypted)).toBe(true);
    });

    it("should be equal to another message with same components", () => {
      const key = SymmetricKey.fromHex(KEY_HEX);
      const nonce = Nonce.fromHex(NONCE_HEX);
      const encrypted1 = key.encrypt(PLAINTEXT, AAD, nonce);
      const encrypted2 = key.encrypt(PLAINTEXT, AAD, nonce);

      expect(encrypted1.equals(encrypted2)).toBe(true);
    });

    it("should not be equal with different nonce", () => {
      const key = SymmetricKey.new();
      const encrypted1 = key.encrypt(PLAINTEXT, AAD);
      const encrypted2 = key.encrypt(PLAINTEXT, AAD);

      // Different random nonces mean different encrypted messages
      expect(encrypted1.equals(encrypted2)).toBe(false);
    });
  });

  describe("CBOR serialization", () => {
    it("should return correct CBOR tags", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const tags = encrypted.cborTags();

      expect(tags.length).toBe(1);
      expect(tags[0].value).toBe(40002); // ENCRYPTED tag
    });

    it("should serialize to untagged CBOR", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const untagged = encrypted.untaggedCbor();

      expect(untagged).toBeDefined();
    });

    it("should serialize to tagged CBOR", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const tagged = encrypted.taggedCbor();

      expect(tagged).toBeDefined();
    });

    it("should serialize to tagged CBOR binary data", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const data = encrypted.taggedCborData();

      expect(data).toBeInstanceOf(Uint8Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should roundtrip through tagged CBOR", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const data = encrypted.taggedCborData();
      const restored = EncryptedMessage.fromTaggedCborData(data);

      expect(restored.equals(encrypted)).toBe(true);
    });

    it("should roundtrip through untagged CBOR", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const data = encrypted.untaggedCbor().toData();
      const restored = EncryptedMessage.fromUntaggedCborData(data);

      expect(restored.equals(encrypted)).toBe(true);
    });

    it("should match expected CBOR encoding from Rust", () => {
      const key = SymmetricKey.fromHex(KEY_HEX);
      const nonce = Nonce.fromHex(NONCE_HEX);
      const encrypted = key.encrypt(PLAINTEXT, AAD, nonce);
      const data = encrypted.taggedCborData();

      // Expected from Rust test
      const expectedHex = "d99c42845872d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b61164c070000004041424344454647501ae10b594f09e26a7e902ecbd06006914c50515253c0c1c2c3c4c5c6c7";
      expect(bytesToHex(data)).toBe(expectedHex);
    });
  });

  describe("UR serialization", () => {
    it("should serialize to UR", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const ur = encrypted.ur();

      expect(ur).toBeDefined();
    });

    it("should serialize to UR string", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const urString = encrypted.urString();

      expect(urString.startsWith("ur:encrypted/")).toBe(true);
    });

    it("should roundtrip through UR string", () => {
      const key = SymmetricKey.new();
      const encrypted = key.encrypt(PLAINTEXT, AAD);
      const urString = encrypted.urString();
      const restored = EncryptedMessage.fromURString(urString);

      expect(restored.equals(encrypted)).toBe(true);
    });

    it("should match expected UR string from Rust", () => {
      const key = SymmetricKey.fromHex(KEY_HEX);
      const nonce = Nonce.fromHex(NONCE_HEX);
      const encrypted = key.encrypt(PLAINTEXT, AAD, nonce);
      const urString = encrypted.urString();

      // Expected from Rust test
      const expectedUR = "ur:encrypted/lrhdjptecylgeeiemnhnuykglnperfguwskbsaoxpmwegydtjtayzeptvoreosenwyidtbfsrnoxhylkptiobglfzszointnmojplucyjsuebknnambddtahtbonrpkbsnfrenmoutrylbdpktlulkmkaxplvldeascwhdzsqddkvezstbkpmwgolplalufdehtsrffhwkuewtmngrknntvwkotdihlntoswgrhscmgsataeaeaefzfpfwfxfyfefgflgdcyvybdhkgwasvoimkbmhdmsbtihnammegsgdgygmgurtsesasrssskswstcfnbpdct";
      expect(urString).toBe(expectedUR);
    });

    it("should throw on invalid UR type", () => {
      const invalidUr = "ur:not_encrypted/invalid";

      expect(() => EncryptedMessage.fromURString(invalidUr)).toThrow();
    });
  });
});

// Helper function to convert bytes to hex
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
