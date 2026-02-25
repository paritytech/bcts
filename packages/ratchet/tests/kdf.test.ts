/**
 * KDF tests — HKDF-SHA256 and HMAC-SHA256 chain key derivation.
 */

import { describe, it, expect } from "vitest";
import { hkdfSha256, hmacSha256 } from "../src/crypto/kdf.js";

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

describe("HKDF-SHA256", () => {
  it("should derive key material with info parameter", () => {
    const ikm = new Uint8Array(32).fill(0x0b);
    const salt = new Uint8Array(32).fill(0x00);
    const info = new TextEncoder().encode("WhisperRatchet");
    const result = hkdfSha256(ikm, salt, info, 64);
    expect(result.length).toBe(64);
  });

  it("should derive key material without salt", () => {
    const ikm = new Uint8Array(32).fill(0x0b);
    const info = new TextEncoder().encode("WhisperMessageKeys");
    const result = hkdfSha256(ikm, undefined, info, 80);
    expect(result.length).toBe(80);
  });

  it("should produce different outputs for different info strings", () => {
    const ikm = new Uint8Array(32).fill(0x01);
    const info1 = new TextEncoder().encode("WhisperRatchet");
    const info2 = new TextEncoder().encode("WhisperMessageKeys");
    const result1 = hkdfSha256(ikm, undefined, info1, 32);
    const result2 = hkdfSha256(ikm, undefined, info2, 32);
    expect(bytesToHex(result1)).not.toBe(bytesToHex(result2));
  });
});

describe("HMAC-SHA256", () => {
  it("should compute chain key material", () => {
    const key = hexToBytes("8ab72d6f4cc5ac0d387eaf463378ddb28edd07385b1cb01250c715982e7ad48f");

    // Message key seed: HMAC-SHA256(key, 0x01)
    const messageKeySeed = hmacSha256(key, new Uint8Array([0x01]));
    expect(messageKeySeed.length).toBe(32);

    // Next chain key: HMAC-SHA256(key, 0x02)
    const nextChainKey = hmacSha256(key, new Uint8Array([0x02]));
    expect(nextChainKey.length).toBe(32);

    // Verify against Signal test vectors
    expect(bytesToHex(nextChainKey)).toBe(
      "28e8f8fee54b801eef7c5cfb2f17f32c7b334485bbb70fac6ec10342a246d15d",
    );
  });
});
