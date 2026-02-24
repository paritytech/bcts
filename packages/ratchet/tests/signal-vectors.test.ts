/**
 * Signal test vector compatibility tests.
 *
 * Verifies our implementation produces the exact same outputs as Signal's Rust code.
 */

import { describe, it, expect } from "vitest";
import { ChainKey } from "../src/ratchet/chain-key.js";
import { MessageKeys } from "../src/ratchet/message-keys.js";
import { aes256CbcEncrypt, aes256CbcDecrypt } from "../src/crypto/aes-cbc.js";
import { hmacSha256 } from "../src/crypto/kdf.js";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("Signal Test Vectors", () => {
  describe("Chain Key Derivation (keys.rs test_chain_key_derivation)", () => {
    const seed = hexToBytes(
      "8ab72d6f4cc5ac0d387eaf463378ddb28edd07385b1cb01250c715982e7ad48f",
    );
    const expectedCipherKey =
      "bf51e9d75e0e31031051f82a2491ffc084fa298b7793bd9db620056febf45217";
    const expectedMacKey =
      "c6c77d6a73a354337a56435e34607dfe48e3ace14e77314dc6abc172e7a7030b";
    const expectedNextChainKey =
      "28e8f8fee54b801eef7c5cfb2f17f32c7b334485bbb70fac6ec10342a246d15d";

    it("should produce correct message cipher key", () => {
      const chainKey = new ChainKey(seed, 0);
      const messageKeySeed = chainKey.messageKeySeed();
      const messageKeys = MessageKeys.deriveFrom(messageKeySeed, 0);
      expect(bytesToHex(messageKeys.cipherKey)).toBe(expectedCipherKey);
    });

    it("should produce correct message MAC key", () => {
      const chainKey = new ChainKey(seed, 0);
      const messageKeySeed = chainKey.messageKeySeed();
      const messageKeys = MessageKeys.deriveFrom(messageKeySeed, 0);
      expect(bytesToHex(messageKeys.macKey)).toBe(expectedMacKey);
    });

    it("should produce correct next chain key", () => {
      const chainKey = new ChainKey(seed, 0);
      const next = chainKey.nextChainKey();
      expect(bytesToHex(next.key)).toBe(expectedNextChainKey);
    });

    it("should have correct indices", () => {
      const chainKey = new ChainKey(seed, 0);
      expect(chainKey.index).toBe(0);

      const messageKeys = MessageKeys.deriveFrom(
        chainKey.messageKeySeed(),
        chainKey.index,
      );
      expect(messageKeys.counter).toBe(0);

      const next = chainKey.nextChainKey();
      expect(next.index).toBe(1);

      const nextMessageKeys = MessageKeys.deriveFrom(
        next.messageKeySeed(),
        next.index,
      );
      expect(nextMessageKeys.counter).toBe(1);
    });

    it("should match HMAC-SHA256 calculation directly", () => {
      // Message key seed = HMAC-SHA256(seed, [0x01])
      const messageKeySeed = hmacSha256(seed, new Uint8Array([0x01]));
      const chainKeySeed = hmacSha256(seed, new Uint8Array([0x02]));

      expect(bytesToHex(chainKeySeed)).toBe(expectedNextChainKey);

      // The message key seed goes through HKDF to produce cipher_key, mac_key, iv
      const keys = MessageKeys.deriveFrom(messageKeySeed, 0);
      expect(bytesToHex(keys.cipherKey)).toBe(expectedCipherKey);
      expect(bytesToHex(keys.macKey)).toBe(expectedMacKey);
    });
  });

  describe("AES-256-CBC (aes_cbc.rs aes_cbc_test)", () => {
    const key = hexToBytes(
      "4e22eb16d964779994222e82192ce9f747da72dc4abe49dfdeeb71d0ffe3796e",
    );
    const iv = hexToBytes("6f8a557ddc0a140c878063a6d5f31d3d");
    const plaintext = hexToBytes("30736294a124482a4159");
    const expectedCiphertext = "dd3f573ab4508b9ed0e45e0baf5608f3";

    it("should encrypt matching Signal test vector", () => {
      const ciphertext = aes256CbcEncrypt(plaintext, key, iv);
      expect(bytesToHex(ciphertext)).toBe(expectedCiphertext);
    });

    it("should decrypt matching Signal test vector", () => {
      const ciphertext = hexToBytes(expectedCiphertext);
      const decrypted = aes256CbcDecrypt(ciphertext, key, iv);
      expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
    });

    it("should detect IV bitflip (Signal behavior)", () => {
      const ciphertext = hexToBytes(expectedCiphertext);
      const badIv = hexToBytes("ef8a557ddc0a140c878063a6d5f31d3d");
      const decrypted = aes256CbcDecrypt(ciphertext, key, badIv);
      expect(bytesToHex(decrypted)).toBe("b0736294a124482a4159");
    });
  });
});
