/**
 * V1: PQXDH deriveKeys() known-answer tests.
 *
 * Verifies that deriveKeys() produces the correct 96-byte HKDF output
 * (rootKey + chainKey + pqrAuthKey) for known secret inputs.
 *
 * The HKDF parameters match Rust libsignal's derive_keys():
 *   HKDF-SHA256(salt=None, ikm=secretInput,
 *               info="WhisperText_X25519_SHA-256_CRYSTALS-KYBER-1024", len=96)
 *
 * Reference: libsignal/rust/protocol/src/ratchet.rs (derive_keys, derive_keys_with_label)
 */

import { describe, it, expect } from "vitest";
import { deriveKeys, spqrChainParams } from "../src/session-init.js";
import { V1a, V1b } from "./fixtures/rust-vectors.js";

describe("deriveKeys — PQXDH known-answer vectors", () => {
  describe("V1a: without DH4 (160-byte secret input)", () => {
    it("should produce the expected root key", () => {
      const result = deriveKeys(V1a.secretInput);
      expect(result.rootKey).toEqual(V1a.rootKey);
    });

    it("should produce the expected chain key", () => {
      const result = deriveKeys(V1a.secretInput);
      expect(result.chainKey).toEqual(V1a.chainKey);
    });

    it("should produce the expected PQR auth key", () => {
      const result = deriveKeys(V1a.secretInput);
      expect(result.pqrAuthKey).toEqual(V1a.pqrAuthKey);
    });

    it("should produce exactly 96 bytes total", () => {
      const result = deriveKeys(V1a.secretInput);
      expect(result.rootKey.length).toBe(32);
      expect(result.chainKey.length).toBe(32);
      expect(result.pqrAuthKey.length).toBe(32);
    });
  });

  describe("V1b: with DH4 (192-byte secret input)", () => {
    it("should produce the expected root key", () => {
      const result = deriveKeys(V1b.secretInput);
      expect(result.rootKey).toEqual(V1b.rootKey);
    });

    it("should produce the expected chain key", () => {
      const result = deriveKeys(V1b.secretInput);
      expect(result.chainKey).toEqual(V1b.chainKey);
    });

    it("should produce the expected PQR auth key", () => {
      const result = deriveKeys(V1b.secretInput);
      expect(result.pqrAuthKey).toEqual(V1b.pqrAuthKey);
    });
  });

  describe("different inputs produce different outputs", () => {
    it("V1a and V1b should differ (DH4 changes everything)", () => {
      const a = deriveKeys(V1a.secretInput);
      const b = deriveKeys(V1b.secretInput);
      expect(a.rootKey).not.toEqual(b.rootKey);
      expect(a.chainKey).not.toEqual(b.chainKey);
      expect(a.pqrAuthKey).not.toEqual(b.pqrAuthKey);
    });

    it("single byte change in secret input should change all outputs", () => {
      const modified = Uint8Array.from(V1a.secretInput);
      modified[50] ^= 0x01; // flip one bit in DH1 region
      const original = deriveKeys(V1a.secretInput);
      const changed = deriveKeys(modified);
      expect(changed.rootKey).not.toEqual(original.rootKey);
      expect(changed.chainKey).not.toEqual(original.chainKey);
      expect(changed.pqrAuthKey).not.toEqual(original.pqrAuthKey);
    });
  });

  describe("secret input layout matches Rust", () => {
    it("should start with 32 bytes of 0xFF (discontinuity bytes)", () => {
      // Verify the test vector layout
      for (let i = 0; i < 32; i++) {
        expect(V1a.secretInput[i]).toBe(0xff);
      }
    });

    it("V1a should be 160 bytes (32 + 4*32 = no DH4)", () => {
      expect(V1a.secretInput.length).toBe(160);
    });

    it("V1b should be 192 bytes (32 + 5*32 = with DH4)", () => {
      expect(V1b.secretInput.length).toBe(192);
    });
  });
});

describe("spqrChainParams — matches Rust constants", () => {
  it("non-self-session: maxJump=25000, maxOooKeys=2000", () => {
    const params = spqrChainParams(false);
    expect(params.maxJump).toBe(25000);
    expect(params.maxOooKeys).toBe(2000);
  });

  it("self-session: maxJump=0xFFFFFFFF, maxOooKeys=2000", () => {
    const params = spqrChainParams(true);
    expect(params.maxJump).toBe(0xffffffff);
    expect(params.maxOooKeys).toBe(2000);
  });
});
