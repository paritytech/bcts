/**
 * Key pair tests.
 */

import { describe, it, expect } from "vitest";
import { KeyPair } from "../src/keys/key-pair.js";
import {
  IdentityKey,
  IdentityKeyPair,
  createAlternateIdentitySignature,
  verifyAlternateIdentitySignature,
} from "../src/keys/identity-key.js";
import { createTestRng } from "./test-utils.js";

describe("KeyPair", () => {
  it("should generate a valid key pair", () => {
    const rng = createTestRng();
    const kp = KeyPair.generate(rng);
    expect(kp.privateKey.length).toBe(32);
    expect(kp.publicKey.length).toBe(32);
  });

  it("should create from private key", () => {
    const rng = createTestRng();
    const kp1 = KeyPair.generate(rng);
    const kp2 = KeyPair.fromPrivateKey(kp1.privateKey);
    expect(kp2.publicKey).toEqual(kp1.publicKey);
  });

  it("should compute DH agreement", () => {
    const rng = createTestRng();
    const kp1 = KeyPair.generate(rng);
    const kp2 = KeyPair.generate(rng);
    const secret1 = kp1.calculateAgreement(kp2.publicKey);
    const secret2 = kp2.calculateAgreement(kp1.publicKey);
    expect(secret1).toEqual(secret2);
    expect(secret1.length).toBe(32);
  });
});

describe("IdentityKey", () => {
  it("should serialize with 0x05 prefix", () => {
    const rng = createTestRng();
    const idkp = IdentityKeyPair.generate(rng);
    const serialized = idkp.identityKey.serialize();
    expect(serialized.length).toBe(33);
    expect(serialized[0]).toBe(0x05);
  });

  it("should deserialize from 33-byte format", () => {
    const rng = createTestRng();
    const idkp = IdentityKeyPair.generate(rng);
    const serialized = idkp.identityKey.serialize();
    const deserialized = IdentityKey.deserialize(serialized);
    expect(deserialized.publicKey).toEqual(idkp.identityKey.publicKey);
  });

  it("should reject 32-byte format (strict: requires 0x05 prefix)", () => {
    const rng = createTestRng();
    const idkp = IdentityKeyPair.generate(rng);
    expect(() => IdentityKey.deserialize(idkp.identityKey.publicKey)).toThrow(
      /expected 33 bytes with 0x05 prefix/,
    );
  });

  it("should check equality", () => {
    const rng = createTestRng();
    const idkp1 = IdentityKeyPair.generate(rng);
    const idkp2 = IdentityKeyPair.generate(rng);
    expect(idkp1.identityKey.equals(idkp1.identityKey)).toBe(true);
    expect(idkp1.identityKey.equals(idkp2.identityKey)).toBe(false);
  });

  it("should sign and verify", () => {
    const rng = createTestRng();
    const idkp = IdentityKeyPair.generate(rng);
    const message = new TextEncoder().encode("test message");
    const signature = idkp.sign(message);
    expect(signature.length).toBe(64);
    expect(idkp.identityKey.verifySignature(message, signature)).toBe(true);
  });

  it("should reject invalid signature", () => {
    const rng = createTestRng();
    const idkp = IdentityKeyPair.generate(rng);
    const message = new TextEncoder().encode("test message");
    const signature = idkp.sign(message);
    // Corrupt signature
    const badSig = Uint8Array.from(signature);
    badSig[0] ^= 0xff;
    expect(idkp.identityKey.verifySignature(message, badSig)).toBe(false);
  });
});

describe("Alternate Identity Signatures (PNI)", () => {
  const rng = createTestRng();

  it("should create and verify alternate identity signature (class API)", () => {
    const primary = IdentityKeyPair.generate(rng);
    const secondary = IdentityKeyPair.generate(rng);

    // secondary signs a claim that primary is its alternate identity
    const signature = secondary.signAlternateIdentity(primary.identityKey);
    expect(signature.length).toBe(64);

    // secondary's public key can verify the claim
    expect(secondary.identityKey.verifyAlternateIdentity(primary.identityKey, signature)).toBe(
      true,
    );
  });

  it("should not be symmetric", () => {
    const primary = IdentityKeyPair.generate(rng);
    const secondary = IdentityKeyPair.generate(rng);

    const signature = secondary.signAlternateIdentity(primary.identityKey);

    // primary cannot verify the same signature in reverse
    expect(primary.identityKey.verifyAlternateIdentity(secondary.identityKey, signature)).toBe(
      false,
    );
  });

  it("should reject wrong other identity key", () => {
    const primary = IdentityKeyPair.generate(rng);
    const secondary = IdentityKeyPair.generate(rng);
    const unrelated = IdentityKeyPair.generate(rng);

    const signature = secondary.signAlternateIdentity(primary.identityKey);

    // unrelated identity should not verify
    expect(secondary.identityKey.verifyAlternateIdentity(unrelated.identityKey, signature)).toBe(
      false,
    );
  });

  it("should reject wrong signer identity key", () => {
    const primary = IdentityKeyPair.generate(rng);
    const secondary = IdentityKeyPair.generate(rng);
    const unrelated = IdentityKeyPair.generate(rng);

    const signature = secondary.signAlternateIdentity(primary.identityKey);

    // unrelated signer should not verify
    expect(unrelated.identityKey.verifyAlternateIdentity(primary.identityKey, signature)).toBe(
      false,
    );
  });

  it("should produce different signatures for same inputs (random nonce)", () => {
    const primary = IdentityKeyPair.generate(rng);
    const secondary = IdentityKeyPair.generate(rng);

    const sig1 = secondary.signAlternateIdentity(primary.identityKey);
    const sig2 = secondary.signAlternateIdentity(primary.identityKey);

    // Both should verify, but be distinct due to random nonce
    expect(sig1).not.toEqual(sig2);
    expect(secondary.identityKey.verifyAlternateIdentity(primary.identityKey, sig1)).toBe(true);
    expect(secondary.identityKey.verifyAlternateIdentity(primary.identityKey, sig2)).toBe(true);
  });

  it("should work with standalone functions (raw key API)", () => {
    const primary = IdentityKeyPair.generate(rng);
    const secondary = IdentityKeyPair.generate(rng);

    const signature = createAlternateIdentitySignature(
      { privateKey: secondary.privateKey, publicKey: secondary.identityKey.publicKey },
      primary.identityKey.publicKey,
    );
    expect(signature.length).toBe(64);

    const valid = verifyAlternateIdentitySignature(
      secondary.identityKey.publicKey,
      primary.identityKey.publicKey,
      signature,
    );
    expect(valid).toBe(true);
  });

  it("standalone verify should reject modified identity", () => {
    const primary = IdentityKeyPair.generate(rng);
    const secondary = IdentityKeyPair.generate(rng);
    const unrelated = IdentityKeyPair.generate(rng);

    const signature = createAlternateIdentitySignature(
      { privateKey: secondary.privateKey, publicKey: secondary.identityKey.publicKey },
      primary.identityKey.publicKey,
    );

    // Verify against a different other identity should fail
    expect(
      verifyAlternateIdentitySignature(
        secondary.identityKey.publicKey,
        unrelated.identityKey.publicKey,
        signature,
      ),
    ).toBe(false);
  });

  it("standalone verify should return false for invalid inputs", () => {
    // All-zeros key is a low-order point and should return false, not throw
    const result = verifyAlternateIdentitySignature(
      new Uint8Array(32),
      new Uint8Array(32),
      new Uint8Array(64),
    );
    expect(result).toBe(false);
  });
});
