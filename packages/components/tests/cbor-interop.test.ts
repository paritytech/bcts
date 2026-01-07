/**
 * Cross-implementation CBOR Interoperability Tests
 *
 * These tests verify that the TypeScript implementation produces identical
 * CBOR output to the Rust bc-components implementation.
 *
 * Test vectors are derived from the Rust bc-components-rust implementation.
 */

import { describe, it, expect } from "vitest";
import {
  Signature,
  SigningPrivateKey,
  createKeypair,
  SignatureScheme,
  ECPrivateKey,
  Ed25519PrivateKey,
  Sr25519PrivateKey,
  EncapsulationPrivateKey,
  PrivateKeys,
} from "../src";
import { decodeCbor } from "@bcts/dcbor";
import { makeFakeRandomNumberGenerator } from "@bcts/rand";

// Test vectors from Rust bc-components-rust
const TEST_PRIVATE_KEY_HEX = "322b5c1dd5a17c3481c2297990c85c232ed3c17b52ce9905c6ec5193ad132c36";
const TEST_MESSAGE = new TextEncoder().encode("Wolf McNally");

/**
 * Helper to convert hex to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("CBOR Interoperability", () => {
  describe("SigningPrivateKey CBOR encoding", () => {
    it("should encode Schnorr private key as bare byte string (matching Rust)", () => {
      // In Rust: SigningPrivateKey::Schnorr encodes as just a byte string (not array)
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);

      const taggedCbor = privateKey.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      // Should be tagged with 40021 (SigningPrivateKey tag)
      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40021);

      // Content should be a byte string (not an array)
      expect(content.isByteString()).toBe(true);
      expect(bytesToHex(content.toByteString())).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should encode ECDSA private key as [1, byte_string] (matching Rust)", () => {
      // In Rust: SigningPrivateKey::ECDSA encodes as [1, private_key_bytes]
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);

      const taggedCbor = privateKey.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40021);

      // Content should be an array [1, byte_string]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(1); // ECDSA discriminator
      expect(bytesToHex(array[1].toByteString())).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should encode Ed25519 private key as [2, byte_string] (matching Rust)", () => {
      // In Rust: SigningPrivateKey::Ed25519 encodes as [2, private_key_bytes]
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);

      const taggedCbor = privateKey.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40021);

      // Content should be an array [2, byte_string]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(2); // Ed25519 discriminator
      expect(bytesToHex(array[1].toByteString())).toBe(TEST_PRIVATE_KEY_HEX);
    });

    it("should encode Sr25519 private key as [3, byte_string] (matching Rust)", () => {
      // In Rust: SigningPrivateKey::Sr25519 encodes as [3, seed_bytes]
      const sr25519Key = Sr25519PrivateKey.fromSeed(hexToBytes(TEST_PRIVATE_KEY_HEX));
      const privateKey = SigningPrivateKey.newSr25519(sr25519Key);

      const taggedCbor = privateKey.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40021);

      // Content should be an array [3, byte_string]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(3); // Sr25519 discriminator
      expect(bytesToHex(array[1].toByteString())).toBe(TEST_PRIVATE_KEY_HEX);
    });
  });

  describe("SigningPublicKey CBOR encoding", () => {
    it("should encode Schnorr public key as bare byte string (matching Rust)", () => {
      // Derive public key from private key
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);
      const publicKey = privateKey.publicKey();

      const taggedCbor = publicKey.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      // Should be tagged with 40022 (SigningPublicKey tag)
      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40022);

      // Content should be a byte string (not an array)
      expect(content.isByteString()).toBe(true);
      // Schnorr public key is 32 bytes (x-only)
      expect(content.toByteString().length).toBe(32);
    });

    it("should encode ECDSA public key as [1, byte_string] (matching Rust)", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);
      const publicKey = privateKey.publicKey();

      const taggedCbor = publicKey.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40022);

      // Content should be an array [1, byte_string]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(1); // ECDSA discriminator
      // ECDSA public key is 33 bytes (compressed)
      expect(array[1].toByteString().length).toBe(33);
    });

    it("should encode Ed25519 public key as [2, byte_string] (matching Rust)", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const publicKey = privateKey.publicKey();

      const taggedCbor = publicKey.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40022);

      // Content should be an array [2, byte_string]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(2); // Ed25519 discriminator
      // Ed25519 public key is 32 bytes
      expect(array[1].toByteString().length).toBe(32);
    });
  });

  describe("Signature CBOR encoding", () => {
    it("should encode ECDSA signature as [1, byte_string] (matching Rust test vector)", () => {
      /**
       * From Rust test_ecdsa_cbor:
       * 40020([1, h'1458d0f3d97e25109b38fd965782b43213134d02b01388a14e74ebf21e5dea4866f25a23866de9ecf0f9b72404d8192ed71fba4dc355cd89b47213e855cf6d23'])
       */
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);
      const signature = privateKey.sign(TEST_MESSAGE);

      // Verify the CBOR structure
      const taggedCbor = signature.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40020); // Signature tag

      // ECDSA should be [1, signature_bytes]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(1); // ECDSA discriminator
      expect(array[1].toByteString().length).toBe(64); // ECDSA signature is 64 bytes

      // ECDSA signatures are deterministic, so verify exact match with Rust
      const expectedSigHex =
        "1458d0f3d97e25109b38fd965782b43213134d02b01388a14e74ebf21e5dea4866f25a23866de9ecf0f9b72404d8192ed71fba4dc355cd89b47213e855cf6d23";
      expect(bytesToHex(array[1].toByteString())).toBe(expectedSigHex);
    });

    it("should encode Schnorr signature as bare byte_string (matching Rust)", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);
      const signature = privateKey.sign(TEST_MESSAGE);

      const taggedCbor = signature.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40020); // Signature tag

      // Schnorr should be a bare byte string (not array)
      expect(content.isByteString()).toBe(true);
      expect(content.toByteString().length).toBe(64); // Schnorr signature is 64 bytes
    });

    it("should produce deterministic Schnorr signature with fake RNG (matching Rust)", () => {
      /**
       * From Rust test_schnorr_cbor with make_fake_random_number_generator():
       * 40020(h'9d113392074dd52dfb7f309afb3698a1993cd14d32bc27c00070407092c9ec8c096643b5b1b535bb5277c44f256441ac660cd600739aa910b150d4f94757cf95')
       */
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);

      // Use fake RNG for deterministic signature
      const fakeRng = makeFakeRandomNumberGenerator();
      const signature = privateKey.signWithOptions(TEST_MESSAGE, {
        type: "Schnorr",
        rng: fakeRng,
      });

      const taggedCbor = signature.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      const [, content] = decoded.toTagged();
      const expectedSigHex =
        "9d113392074dd52dfb7f309afb3698a1993cd14d32bc27c00070407092c9ec8c096643b5b1b535bb5277c44f256441ac660cd600739aa910b150d4f94757cf95";
      expect(bytesToHex(content.toByteString())).toBe(expectedSigHex);
    });

    it("should encode Ed25519 signature as [2, byte_string] (matching Rust)", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEd25519(ed25519Key);
      const signature = privateKey.sign(TEST_MESSAGE);

      const taggedCbor = signature.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40020); // Signature tag

      // Ed25519 should be [2, signature_bytes]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(2); // Ed25519 discriminator
      expect(array[1].toByteString().length).toBe(64); // Ed25519 signature is 64 bytes
    });

    it("should encode Sr25519 signature as [3, byte_string] (matching Rust)", () => {
      const sr25519Key = Sr25519PrivateKey.fromSeed(hexToBytes(TEST_PRIVATE_KEY_HEX));
      const privateKey = SigningPrivateKey.newSr25519(sr25519Key);
      const signature = privateKey.sign(TEST_MESSAGE);

      const taggedCbor = signature.taggedCborData();
      const decoded = decodeCbor(taggedCbor);

      expect(decoded.isTagged()).toBe(true);
      const [tag, content] = decoded.toTagged();
      expect(Number(tag.value)).toBe(40020); // Signature tag

      // Sr25519 should be [3, signature_bytes]
      expect(content.isArray()).toBe(true);
      const array = content.toArray();
      expect(array.length).toBe(2);
      expect(Number(array[0].toInteger())).toBe(3); // Sr25519 discriminator
      expect(array[1].toByteString().length).toBe(64); // Sr25519 signature is 64 bytes
    });
  });

  describe("CBOR roundtrip", () => {
    it("should roundtrip Schnorr private key through CBOR", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const original = SigningPrivateKey.newSchnorr(ecKey);

      const cborData = original.taggedCborData();
      const restored = SigningPrivateKey.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(original.scheme());
      expect(restored.equals(original)).toBe(true);
    });

    it("should roundtrip ECDSA private key through CBOR", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const original = SigningPrivateKey.newEcdsa(ecKey);

      const cborData = original.taggedCborData();
      const restored = SigningPrivateKey.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(original.scheme());
      expect(restored.equals(original)).toBe(true);
    });

    it("should roundtrip Ed25519 private key through CBOR", () => {
      const ed25519Key = Ed25519PrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const original = SigningPrivateKey.newEd25519(ed25519Key);

      const cborData = original.taggedCborData();
      const restored = SigningPrivateKey.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(original.scheme());
      expect(restored.equals(original)).toBe(true);
    });

    it("should roundtrip Sr25519 private key through CBOR", () => {
      const sr25519Key = Sr25519PrivateKey.fromSeed(hexToBytes(TEST_PRIVATE_KEY_HEX));
      const original = SigningPrivateKey.newSr25519(sr25519Key);

      const cborData = original.taggedCborData();
      const restored = SigningPrivateKey.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(original.scheme());
      expect(restored.equals(original)).toBe(true);
    });

    it("should roundtrip Schnorr signature through CBOR", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);
      const original = privateKey.sign(TEST_MESSAGE);

      const cborData = original.taggedCborData();
      const restored = Signature.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(original.scheme());
      expect(restored.equals(original)).toBe(true);

      // Verify the restored signature still works
      const publicKey = privateKey.publicKey();
      expect(publicKey.verify(restored, TEST_MESSAGE)).toBe(true);
    });

    it("should roundtrip ECDSA signature through CBOR", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newEcdsa(ecKey);
      const original = privateKey.sign(TEST_MESSAGE);

      const cborData = original.taggedCborData();
      const restored = Signature.fromTaggedCborData(cborData);

      expect(restored.scheme()).toBe(original.scheme());
      expect(restored.equals(original)).toBe(true);

      // Verify the restored signature still works
      const publicKey = privateKey.publicKey();
      expect(publicKey.verify(restored, TEST_MESSAGE)).toBe(true);
    });
  });

  describe("ReferenceProvider", () => {
    it("SigningPrivateKey should provide reference", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);

      const ref = privateKey.reference();
      expect(ref.refHexShort()).toBeTruthy();
      expect(ref.refHexShort().length).toBe(8); // 4 bytes = 8 hex chars
    });

    it("SigningPublicKey should provide reference", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey = SigningPrivateKey.newSchnorr(ecKey);
      const publicKey = privateKey.publicKey();

      const ref = publicKey.reference();
      expect(ref.refHexShort()).toBeTruthy();
      expect(ref.refHexShort().length).toBe(8);
    });

    it("EncapsulationPrivateKey should provide reference", () => {
      const privateKey = EncapsulationPrivateKey.random();

      const ref = privateKey.reference();
      expect(ref.refHexShort()).toBeTruthy();
      expect(ref.refHexShort().length).toBe(8);
    });

    it("EncapsulationPublicKey should provide reference", () => {
      const privateKey = EncapsulationPrivateKey.random();
      const publicKey = privateKey.publicKey();

      const ref = publicKey.reference();
      expect(ref.refHexShort()).toBeTruthy();
      expect(ref.refHexShort().length).toBe(8);
    });

    it("PrivateKeys should provide reference", () => {
      const privateKeys = PrivateKeys.new();

      const ref = privateKeys.reference();
      expect(ref.refHexShort()).toBeTruthy();
      expect(ref.refHexShort().length).toBe(8);
    });

    it("PublicKeys should provide reference", () => {
      const privateKeys = PrivateKeys.new();
      const publicKeys = privateKeys.publicKeys();

      const ref = publicKeys.reference();
      expect(ref.refHexShort()).toBeTruthy();
      expect(ref.refHexShort().length).toBe(8);
    });

    it("reference should be deterministic from CBOR", () => {
      const ecKey = ECPrivateKey.fromHex(TEST_PRIVATE_KEY_HEX);
      const privateKey1 = SigningPrivateKey.newSchnorr(ecKey);
      const privateKey2 = SigningPrivateKey.newSchnorr(ecKey);

      const ref1 = privateKey1.reference();
      const ref2 = privateKey2.reference();

      expect(ref1.refHexShort()).toBe(ref2.refHexShort());
      expect(ref1.fullReference()).toBe(ref2.fullReference());
    });
  });

  describe("Signature schemes default", () => {
    it("default signature scheme should be Schnorr (matching Rust)", () => {
      // Rust: impl Default for SignatureScheme { fn default() -> Self { Self::Schnorr } }
      const [privateKey] = createKeypair(SignatureScheme.Schnorr);
      expect(privateKey.scheme()).toBe(SignatureScheme.Schnorr);
    });
  });
});
