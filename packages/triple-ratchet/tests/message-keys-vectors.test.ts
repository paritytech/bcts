/**
 * V2: Message key derivation known-answer tests.
 *
 * Verifies deriveMessageKeys() produces the correct HKDF output for:
 *   - Classical mode (pqRatchetKey = null) — MUST match Rust test_chain_key_derivation()
 *   - PQ mode (pqRatchetKey as HKDF salt) — deterministic vectors
 *
 * The message key seed is HMAC-SHA256(chainKey, [0x01]), matching Rust's
 * ChainKey::message_keys() → calculate_base_material(MESSAGE_KEY_SEED).
 *
 * HKDF-SHA256(salt=pqKey, ikm=msgKeySeed, info="WhisperMessageKeys", len=80)
 * → cipherKey[0:32] + macKey[32:64] + iv[64:80]
 *
 * Cross-validated against:
 *   libsignal/rust/protocol/src/ratchet/keys.rs test_chain_key_derivation() lines 219-265
 */

import { describe, it, expect } from "vitest";
import { hmacSha256 } from "@bcts/double-ratchet";
import { deriveMessageKeys } from "../src/message-keys.js";
import { RUST_CHAIN_KEY, RUST_MSG_KEY_SEED, V2a, V2b, V2c } from "./fixtures/rust-vectors.js";

describe("message key derivation — Rust cross-validated vectors", () => {
  // -------------------------------------------------------------------------
  // Verify the chain key → message key seed derivation matches Rust
  // -------------------------------------------------------------------------
  describe("chain key seed derivation", () => {
    it("HMAC-SHA256(chainKey, [0x01]) should produce the known message key seed", () => {
      const seed = hmacSha256(RUST_CHAIN_KEY, new Uint8Array([0x01]));
      expect(seed).toEqual(RUST_MSG_KEY_SEED);
    });

    it("HMAC-SHA256(chainKey, [0x02]) should produce the next chain key", () => {
      const nextChainKey = hmacSha256(RUST_CHAIN_KEY, new Uint8Array([0x02]));
      // From Rust test_chain_key_derivation():
      const expected = Uint8Array.from([
        0x28, 0xe8, 0xf8, 0xfe, 0xe5, 0x4b, 0x80, 0x1e, 0xef, 0x7c, 0x5c, 0xfb, 0x2f, 0x17, 0xf3,
        0x2c, 0x7b, 0x33, 0x44, 0x85, 0xbb, 0xb7, 0x0f, 0xac, 0x6e, 0xc1, 0x03, 0x42, 0xa2, 0x46,
        0xd1, 0x5d,
      ]);
      expect(nextChainKey).toEqual(expected);
    });
  });

  // -------------------------------------------------------------------------
  // V2a: Classical mode (pqRatchetKey = null) — matches Rust EXACTLY
  // -------------------------------------------------------------------------
  describe("V2a: classical mode (pqRatchetKey = null)", () => {
    it("cipher key should match Rust test_chain_key_derivation()", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, null, 0);
      expect(result.cipherKey).toEqual(V2a.cipherKey);
    });

    it("MAC key should match Rust test_chain_key_derivation()", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, null, 0);
      expect(result.macKey).toEqual(V2a.macKey);
    });

    it("IV should match computed HKDF output", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, null, 0);
      expect(result.iv).toEqual(V2a.iv);
    });

    it("counter should be preserved", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, null, 42);
      expect(result.counter).toBe(42);
    });
  });

  // -------------------------------------------------------------------------
  // V2b: PQ mode (pqRatchetKey = 0xAA*32 as HKDF salt)
  // -------------------------------------------------------------------------
  describe("V2b: PQ mode (pqRatchetKey = 0xAA*32)", () => {
    it("cipher key should match known vector", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, V2b.pqKey, 0);
      expect(result.cipherKey).toEqual(V2b.cipherKey);
    });

    it("MAC key should match known vector", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, V2b.pqKey, 0);
      expect(result.macKey).toEqual(V2b.macKey);
    });

    it("IV should match known vector", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, V2b.pqKey, 0);
      expect(result.iv).toEqual(V2b.iv);
    });

    it("should differ from classical mode (V2a)", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, V2b.pqKey, 0);
      expect(result.cipherKey).not.toEqual(V2a.cipherKey);
      expect(result.macKey).not.toEqual(V2a.macKey);
      expect(result.iv).not.toEqual(V2a.iv);
    });
  });

  // -------------------------------------------------------------------------
  // V2c: Different PQ key (0xBB*32) — proves salt matters
  // -------------------------------------------------------------------------
  describe("V2c: different PQ key (0xBB*32)", () => {
    it("cipher key should match known vector", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, V2c.pqKey, 0);
      expect(result.cipherKey).toEqual(V2c.cipherKey);
    });

    it("should differ from V2b (different PQ key = different salt)", () => {
      const v2b = deriveMessageKeys(RUST_MSG_KEY_SEED, V2b.pqKey, 0);
      const v2c = deriveMessageKeys(RUST_MSG_KEY_SEED, V2c.pqKey, 0);
      expect(v2b.cipherKey).not.toEqual(v2c.cipherKey);
      expect(v2b.macKey).not.toEqual(v2c.macKey);
    });
  });

  // -------------------------------------------------------------------------
  // Output sizes
  // -------------------------------------------------------------------------
  describe("output sizes", () => {
    it("cipher key should be 32 bytes", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, null, 0);
      expect(result.cipherKey.length).toBe(32);
    });

    it("MAC key should be 32 bytes", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, null, 0);
      expect(result.macKey.length).toBe(32);
    });

    it("IV should be 16 bytes", () => {
      const result = deriveMessageKeys(RUST_MSG_KEY_SEED, null, 0);
      expect(result.iv.length).toBe(16);
    });
  });
});
