/**
 * XEdDSA signing tests.
 *
 * Verifies that X25519 keys can produce and verify Ed25519-compatible signatures
 * using the XEdDSA algorithm.
 */

import { describe, it, expect } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";
import { xeddsaSign, xeddsaVerify } from "../src/crypto/xeddsa.js";
import { IdentityKeyPair } from "../src/keys/identity-key.js";
import { createTestRng } from "./test-utils.js";

describe("XEdDSA", () => {
  it("should sign and verify a message round-trip", () => {
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKey = x25519.getPublicKey(privateKey);
    const message = new TextEncoder().encode("hello xeddsa");

    const signature = xeddsaSign(privateKey, message);
    expect(signature.length).toBe(64);

    const valid = xeddsaVerify(publicKey, message, signature);
    expect(valid).toBe(true);
  });

  it("should fail verification with wrong message", () => {
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKey = x25519.getPublicKey(privateKey);
    const message = new TextEncoder().encode("correct message");

    const signature = xeddsaSign(privateKey, message);

    const wrongMessage = new TextEncoder().encode("wrong message");
    expect(xeddsaVerify(publicKey, wrongMessage, signature)).toBe(false);
  });

  it("should fail verification with wrong key", () => {
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const message = new TextEncoder().encode("test message");

    const signature = xeddsaSign(privateKey, message);

    const otherPrivateKey = crypto.getRandomValues(new Uint8Array(32));
    const otherPublicKey = x25519.getPublicKey(otherPrivateKey);
    expect(xeddsaVerify(otherPublicKey, message, signature)).toBe(false);
  });

  it("should work with multiple random key pairs (even/odd Y coverage)", () => {
    const message = new TextEncoder().encode("deterministic test content");

    for (let i = 0; i < 20; i++) {
      const privateKey = crypto.getRandomValues(new Uint8Array(32));
      const publicKey = x25519.getPublicKey(privateKey);

      const signature = xeddsaSign(privateKey, message);
      const valid = xeddsaVerify(publicKey, message, signature);

      expect(valid).toBe(true);
    }
  });

  it("should produce deterministic signatures with explicit randomness", () => {
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const message = new TextEncoder().encode("deterministic");
    const random = new Uint8Array(64).fill(0x42);

    const sig1 = xeddsaSign(privateKey, message, random);
    const sig2 = xeddsaSign(privateKey, message, random);

    expect(sig1).toEqual(sig2);
  });

  it("should work with empty message", () => {
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKey = x25519.getPublicKey(privateKey);
    const message = new Uint8Array(0);

    const signature = xeddsaSign(privateKey, message);
    expect(xeddsaVerify(publicKey, message, signature)).toBe(true);
  });

  it("should work with large message", () => {
    const privateKey = crypto.getRandomValues(new Uint8Array(32));
    const publicKey = x25519.getPublicKey(privateKey);
    const message = crypto.getRandomValues(new Uint8Array(10000));

    const signature = xeddsaSign(privateKey, message);
    expect(xeddsaVerify(publicKey, message, signature)).toBe(true);
  });
});

describe("IdentityKeyPair XEdDSA integration", () => {
  it("should sign and verify via IdentityKeyPair", () => {
    const rng = createTestRng();
    const pair = IdentityKeyPair.generate(rng);
    const message = new TextEncoder().encode("identity key signing test");

    const signature = pair.sign(message);
    expect(signature.length).toBe(64);

    const valid = pair.identityKey.verifySignature(message, signature);
    expect(valid).toBe(true);
  });

  it("should fail verification with different identity key", () => {
    const rng = createTestRng();
    const pair1 = IdentityKeyPair.generate(rng);
    const pair2 = IdentityKeyPair.generate(rng);
    const message = new TextEncoder().encode("cross-key test");

    const signature = pair1.sign(message);
    expect(pair2.identityKey.verifySignature(message, signature)).toBe(false);
  });

  it("should generate X25519 keys (not Ed25519)", () => {
    const rng = createTestRng();
    const pair = IdentityKeyPair.generate(rng);

    // The public key should be a valid X25519 public key:
    // deriving the public from the private should match
    const derived = x25519.getPublicKey(pair.privateKey);
    expect(pair.identityKey.publicKey).toEqual(derived);
  });

  it("toKeyPair should return the same X25519 keys", () => {
    const rng = createTestRng();
    const pair = IdentityKeyPair.generate(rng);
    const kp = pair.toKeyPair();

    // KeyPair clamps the private key, so compare with clamped version
    const clamped = new Uint8Array(pair.privateKey);
    clamped[0] &= 248;
    clamped[31] &= 127;
    clamped[31] |= 64;

    expect(kp.privateKey).toEqual(clamped);
    expect(kp.publicKey).toEqual(pair.identityKey.publicKey);
  });
});
